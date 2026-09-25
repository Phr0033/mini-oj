const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { randomUUID } = require('crypto');
const db = require('./config/db');

const MAX_OUTPUT_BYTES = 1024 * 1024;
const COMPILE_TIMEOUT_MS = 60000;
const MAX_STORED_OUTPUT = 8000;
const image = process.env.JUDGE_IMAGE || 'gcc:latest';

const removeContainer = (name) => new Promise(resolve => {
    execFile('docker', ['rm', '-f', name], { timeout: 5000, windowsHide: true }, () => resolve());
});

const runDocker = (jobDir, memoryMb, command, timeoutMs) => new Promise(resolve => {
    const name = 'mini-oj-' + randomUUID();
    const args = [
        'run', '--rm', '--name', name, '--label', 'mini-oj.judge=1',
        '--network', 'none', '--cpus', '1', '--memory', `${memoryMb}m`,
        '--memory-swap', `${memoryMb}m`, '--pids-limit', '64',
        '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges=true',
        '--read-only', '--tmpfs', '/tmp:rw,nosuid,noexec,size=64m',
        '--user', '10001:10001', '-v', `${jobDir}:/app:rw`,
        '-w', '/app', image, ...command
    ];
    execFile('docker', args, {
        timeout: timeoutMs,
        maxBuffer: MAX_OUTPUT_BYTES,
        windowsHide: true
    }, async (error, stdout, stderr) => {
        if (error) await removeContainer(name);
        resolve({ error, stdout, stderr });
    });
});

const infrastructureError = (error) =>
    error?.killed || error?.code === 'ENOENT' || error?.code === 125;

const finish = async (id, result, output) => {
    await db.query(
        "UPDATE submissions SET result = ?, output = ? WHERE id = ? AND result IN ('Pending', 'Running')",
        [result, String(output || '').slice(0, MAX_STORED_OUTPUT), id]
    );
    return result;
};

const judgeSubmission = async (id) => {
    const [claimed] = await db.query(
        "UPDATE submissions SET result = 'Running' WHERE id = ? AND result IN ('Pending', 'Running') RETURNING id, problem_id, code",
        [id]
    );
    if (!claimed.length) return 'Skipped';

    const submission = claimed[0];
    const [problems] = await db.query('SELECT time_limit, memory_limit FROM problems WHERE id = ?', [submission.problem_id]);
    if (!problems.length) return finish(id, 'Judge Error', '题目已删除');
    const [tests] = await db.query(
        'SELECT input_data, output_data FROM test_cases WHERE problem_id = ? ORDER BY id',
        [submission.problem_id]
    );
    if (!tests.length) return finish(id, 'Judge Error', '题目未配置测试点');

    const timeLimitMs = Number(problems[0].time_limit) || 1000;
    const memoryLimitMb = Number(problems[0].memory_limit) || 256;
    const jobDir = path.join(__dirname, 'sandbox', 'job_' + randomUUID());
    fs.mkdirSync(jobDir, { recursive: true });
    fs.chmodSync(jobDir, 0o777); // 容器内的非 root 用户只可写自己的评测目录
    try {
        fs.writeFileSync(path.join(jobDir, 'main.cpp'), submission.code);
        const compile = await runDocker(jobDir, Math.max(512, memoryLimitMb),
            ['g++', '-pipe', 'main.cpp', '-o', 'main'], COMPILE_TIMEOUT_MS);
        if (infrastructureError(compile.error)) throw new Error('编译容器不可用或超时');
        if (compile.error?.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
            return finish(id, 'Compile Error', '编译输出超过 1 MB');
        }
        if (compile.error) return finish(id, 'Compile Error', compile.stderr || compile.error.message);

        for (let i = 0; i < tests.length; i++) {
            const test = tests[i];
            fs.writeFileSync(path.join(jobDir, 'input.txt'), test.input_data || '');
            const seconds = (timeLimitMs / 1000).toFixed(3);
            const execution = await runDocker(jobDir, memoryLimitMb,
                ['bash', '-c', `timeout ${seconds}s ./main < input.txt`], timeLimitMs + 10000);
            const error = execution.error;
            if (infrastructureError(error)) throw new Error(`测试点 ${i + 1} 容器不可用或超时`);
            if (error?.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
                return finish(id, 'Output Limit Exceeded', `测试点 ${i + 1} 输出超过 1 MB`);
            }
            if (error?.code === 124) return finish(id, 'Time Limit Exceeded', `测试点 ${i + 1} 运行超时`);
            if (error?.code === 137) return finish(id, 'Memory Limit Exceeded', `测试点 ${i + 1} 内存超限`);
            if (error) return finish(id, 'Runtime Error', execution.stderr || error.message);
            if (execution.stdout.trim() !== (test.output_data || '').trim()) {
                return finish(id, 'Wrong Answer', `测试点 ${i + 1} 答案错误！\n期望输出:\n${(test.output_data || '').trim()}\n实际输出:\n${execution.stdout.trim()}`);
            }
        }
        return finish(id, 'Accepted', 'All Test Cases Passed.');
    } finally {
        try {
            fs.rmSync(jobDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
        } catch (error) {
            console.error('清理评测目录失败:', error);
        }
    }
};

module.exports = { judgeSubmission };

