const { Worker } = require('bullmq');
const db = require('./config/db');
const { JUDGE_QUEUE_NAME, redisConnection, redisPrefix, judgeQueue, enqueueSubmission } = require('./judgeQueue');
const { judgeSubmission } = require('./judge');

const concurrency = Math.max(1, Math.min(4, Number(process.env.JUDGE_CONCURRENCY) || 2));
const worker = new Worker(JUDGE_QUEUE_NAME, async job => {
    const id = Number(job.data.submissionId);
    try {
        return await judgeSubmission(id);
    } catch (error) {
        if (job.attemptsMade + 1 >= (job.opts.attempts || 1)) {
            try {
                await db.query(
                    "UPDATE submissions SET result = 'Judge Error', output = ? WHERE id = ? AND result IN ('Pending', 'Running')",
                    [String(error.message || '评测服务异常').slice(0, 8000), id]
                );
            } catch (dbError) {
                console.error('保存判题错误失败:', dbError);
            }
        }
        throw error;
    }
}, {
    connection: { ...redisConnection, maxRetriesPerRequest: null },
    prefix: redisPrefix,
    concurrency
});

worker.on('completed', job => console.log(`提交 ${job.data.submissionId} 评测完成`));
worker.on('failed', (job, error) => console.error(`提交 ${job?.data.submissionId} 评测失败:`, error));
worker.on('error', error => console.error('判题 Worker 错误:', error));

const recoverUnfinished = async () => {
    const [rows] = await db.query("SELECT id FROM submissions WHERE result IN ('Pending', 'Running') ORDER BY id LIMIT 1000");
    for (const row of rows) {
        const oldJob = await judgeQueue.getJob('submission-' + row.id);
        if (oldJob) {
            const state = await oldJob.getState();
            if (state === 'completed' || state === 'failed') await oldJob.remove();
            else continue;
        }
        await enqueueSubmission(row.id);
    }
    console.log(`判题 Worker 已启动，并检查了 ${rows.length} 条未完成提交`);
};

worker.waitUntilReady().then(recoverUnfinished).catch(error => console.error('恢复未完成提交失败:', error));

const shutdown = async () => {
    await worker.close();
    await judgeQueue.close();
    process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);


