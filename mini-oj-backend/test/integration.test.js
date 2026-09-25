const test = require('node:test');
const assert = require('node:assert/strict');
const { before, after } = require('node:test');
const { randomUUID } = require('node:crypto');
const { spawn, execFileSync } = require('node:child_process');
const { createServer } = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
const { Queue } = require('bullmq');
require('../config/env');

const backendDir = path.join(__dirname, '..');
const dbName = 'mini_oj_test_' + randomUUID().replace(/-/g, '').slice(0, 12);
const redisPrefix = 'mini-oj-test-' + randomUUID().replace(/-/g, '').slice(0, 12);
const dbOptions = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD
};
const redisOptions = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT) || 6379,
    ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {})
};
let adminDb;
let testDb;
let apiProcess;
let workerProcess;
let apiLog = '';
let workerLog = '';
let baseUrl;
let adminToken;
let normalToken;
let adminId;
let normalId;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const freePort = () => new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        server.close(() => resolve(port));
    });
});
const waitFor = async (check, timeoutMs = 15000) => {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
        if (await check()) return;
        await sleep(150);
    }
    throw new Error('服务启动或判题超时。API 日志：' + apiLog.slice(-1500) + ' Worker 日志：' + workerLog.slice(-1500));
};
const request = async (route, { token, method = 'GET', body } = {}) => {
    const response = await fetch(baseUrl + route, {
        method,
        headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(body ? { 'Content-Type': 'application/json' } : {})
        },
        ...(body ? { body: JSON.stringify(body) } : {})
    });
    return { code: response.status, body: await response.json() };
};
const startChild = (file, env, record) => {
    const child = spawn(process.execPath, [file], {
        cwd: backendDir, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']
    });
    child.stdout.on('data', chunk => record(chunk.toString()));
    child.stderr.on('data', chunk => record(chunk.toString()));
    return child;
};
const stopChild = child => new Promise(resolve => {
    if (!child || child.exitCode !== null || child.signalCode !== null) return resolve();
    const timer = setTimeout(() => { child.kill('SIGKILL'); resolve(); }, 5000);
    child.once('exit', () => { clearTimeout(timer); resolve(); });
    child.kill();
});
const login = async (username, password) => {
    const result = await request('/login', { method: 'POST', body: { username, password } });
    assert.equal(result.code, 200);
    return result.body.token;
};
const submitAndWait = async (code, expected) => {
    const submitted = await request('/submit', {
        token: adminToken, method: 'POST', body: { problemId: 1, code }
    });
    assert.equal(submitted.code, 202, JSON.stringify(submitted.body));
    assert.equal(submitted.body.type, 'Pending');
    const id = submitted.body.submissionId;
    assert.ok(Number.isInteger(id));
    await waitFor(async () => {
        const result = await request(`/submission/${id}`, { token: adminToken });
        assert.equal(result.code, 200);
        if (['Pending', 'Running'].includes(result.body.data.result)) return false;
        assert.equal(result.body.data.result, expected, JSON.stringify(result.body));
        return true;
    }, 45000);
    return id;
};

before(async () => {
    execFileSync('docker', ['info', '--format', '{{.ServerVersion}}'], { stdio: 'ignore' });
    adminDb = new Client({ ...dbOptions, database: process.env.DB_ADMIN_DATABASE || 'postgres' });
    await adminDb.connect();
    await adminDb.query(`CREATE DATABASE "${dbName}"`);
    testDb = new Client({ ...dbOptions, database: dbName });
    await testDb.connect();
    await testDb.query(fs.readFileSync(path.join(backendDir, 'db', 'schema.sql'), 'utf8'));
    await testDb.query(fs.readFileSync(path.join(backendDir, 'db', 'seeds', 'demo_seed.sql'), 'utf8'));

    const port = await freePort();
    baseUrl = `http://127.0.0.1:${port}`;
    const env = {
        ...process.env, DB_NAME: dbName, REDIS_PREFIX: redisPrefix,
        PORT: String(port), JUDGE_CONCURRENCY: '1',
        JWT_SECRET: process.env.JWT_SECRET || 'integration-test-secret-at-least-32-characters'
    };
    apiProcess = startChild('index.js', env, value => { apiLog += value; });
    workerProcess = startChild('worker.js', env, value => { workerLog += value; });
    await waitFor(async () => {
        try {
            const response = await fetch(baseUrl + '/problems');
            return response.ok && workerLog.includes('判题 Worker 已启动');
        } catch { return false; }
    });
    for (const username of ['admin_test', 'normal_test']) {
        const result = await request('/register', {
            method: 'POST', body: { username, password: 'TestPassword123!' }
        });
        assert.equal(result.code, 200, JSON.stringify(result.body));
    }
    const users = await testDb.query('SELECT id, username FROM users');
    adminId = users.rows.find(user => user.username === 'admin_test').id;
    normalId = users.rows.find(user => user.username === 'normal_test').id;
    await testDb.query('UPDATE users SET is_admin = TRUE WHERE id = $1', [adminId]);
    adminToken = await login('admin_test', 'TestPassword123!');
    normalToken = await login('normal_test', 'TestPassword123!');
});

after(async () => {
    await Promise.all([stopChild(workerProcess), stopChild(apiProcess)]);
    try {
        const queue = new Queue('mini-oj-judge', {
            prefix: redisPrefix,
            connection: { ...redisOptions, maxRetriesPerRequest: 1, enableOfflineQueue: false }
        });
        try { await queue.obliterate({ force: true }); } finally { await queue.close(); }
    } catch (error) { console.error('清理测试队列失败:', error); }
    if (testDb) await testDb.end();
    if (adminDb) {
        try { await adminDb.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`); }
        finally { await adminDb.end(); }
    }
});

test('排行榜按已通过题目去重，排队记录不改变通过率', async () => {
    const insert = (problemId, result) => testDb.query(
        'INSERT INTO submissions (user_id, problem_id, code, result) VALUES ($1, $2, $3, $4)',
        [normalId, problemId, 'int main(){}', result]
    );
    try {
        await insert(1, 'Accepted');
        await insert(1, 'Accepted');
        await insert(2, 'Wrong Answer');
        await insert(3, 'Pending');
        await insert(4, 'Judge Error');
        const board = (await request('/leaderboard')).body.data.find(row => row.username === 'normal_test');
        assert.equal(Number(board.ac_count), 1);
        assert.equal(Number(board.attempted_count), 2);
        assert.equal(Number(board.total_submissions), 5);
        await insert(1, 'Accepted');
        const again = (await request('/leaderboard')).body.data.find(row => row.username === 'normal_test');
        assert.equal(Number(again.ac_count), 1);
        assert.equal(Number(again.attempted_count), 2);
        const status = await request('/user/status', { token: normalToken });
        const pending = status.body.data.find(row => row.problem_id === 3);
        assert.equal(Number(pending.pending_count), 1);
        assert.equal(Number(pending.total_attempts), 0);
    } finally {
        await testDb.query('DELETE FROM submissions WHERE user_id = $1', [normalId]);
    }
});

test('管理员接口拒绝普通用户，允许题目和讨论区管理', async () => {
    const payload = {
        title: '权限测试题', description: '输出 1', time_limit: 1000, memory_limit: 256,
        test_cases: [{ input_data: '', output_data: '1' }]
    };
    assert.equal((await request('/admin/contest', { method: 'POST', body: {} })).code, 401);
    assert.equal((await request('/admin/contest', { token: normalToken, method: 'POST', body: {} })).code, 403);
    assert.equal((await request('/admin/contest', { token: adminToken, method: 'POST', body: {} })).code, 400);
    assert.equal((await request('/admin/problem', { method: 'POST', body: payload })).code, 401);
    assert.equal((await request('/admin/problem', { token: normalToken, method: 'POST', body: payload })).code, 403);
    assert.equal((await request('/admin/problem', { token: adminToken, method: 'POST', body: payload })).code, 200);
    const found = await testDb.query('SELECT id FROM problems WHERE title = $1', [payload.title]);
    assert.equal(found.rows.length, 1);
    const problemId = found.rows[0].id;
    try {
        assert.equal((await request(`/admin/problem/${problemId}`, { token: normalToken, method: 'DELETE' })).code, 403);
        assert.equal((await request(`/admin/problem/${problemId}`, { token: adminToken, method: 'DELETE' })).code, 200);
        assert.equal((await request(`/problem/${problemId}`)).code, 404);
    } finally {
        await testDb.query('DELETE FROM test_cases WHERE problem_id = $1', [problemId]);
        await testDb.query('DELETE FROM problems WHERE id = $1', [problemId]);
    }

    assert.equal((await request('/posts', {
        token: normalToken, method: 'POST', body: { title: '测试帖子', content: '测试内容' }
    })).code, 200);
    const post = (await testDb.query('SELECT id FROM posts WHERE title = $1', ['测试帖子'])).rows[0];
    try {
        assert.equal((await request(`/posts/${post.id}/comments`, {
            token: normalToken, method: 'POST', body: { content: '测试评论' }
        })).code, 200);
        const comment = (await testDb.query('SELECT id FROM comments WHERE post_id = $1', [post.id])).rows[0];
        assert.equal((await request('/admin/posts', { token: normalToken })).code, 403);
        assert.equal((await request(`/admin/comments/${comment.id}`, { token: normalToken, method: 'DELETE' })).code, 403);
        assert.equal((await request(`/admin/comments/${comment.id}`, { token: adminToken, method: 'DELETE' })).code, 200);
        assert.equal((await request(`/admin/posts/${post.id}`, { token: adminToken, method: 'DELETE' })).code, 200);
        assert.equal((await testDb.query('SELECT COUNT(*)::int AS n FROM comments WHERE post_id = $1', [post.id])).rows[0].n, 0);
    } finally {
        await testDb.query('DELETE FROM comments WHERE post_id = $1', [post.id]);
        await testDb.query('DELETE FROM posts WHERE id = $1', [post.id]);
    }
});

test('真实 Docker 判题给出 AC、编译错误和超时结果', async () => {
    const ac = await submitAndWait('#include <iostream>\nint main(){int a,b;std::cin>>a>>b;std::cout<<a+b;} ', 'Accepted');
    assert.equal((await request(`/submission/${ac}`, { token: normalToken })).code, 404);
    await submitAndWait('int main( {', 'Compile Error');
    await submitAndWait('int main(){while(true){}}', 'Time Limit Exceeded');
    const status = await request('/status');
    assert.equal(status.code, 200);
    assert.ok(status.body.data.some(row => row.result === 'Accepted'));
    assert.ok(status.body.data.some(row => row.result === 'Compile Error'));
    assert.ok(status.body.data.some(row => row.result === 'Time Limit Exceeded'));
});
