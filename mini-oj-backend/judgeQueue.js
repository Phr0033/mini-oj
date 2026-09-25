require('./config/env');
const { Queue } = require('bullmq');

const JUDGE_QUEUE_NAME = 'mini-oj-judge';
const redisPrefix = process.env.REDIS_PREFIX || 'bull';
const redisConnection = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT) || 6379,
    ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {})
};

const judgeQueue = new Queue(JUDGE_QUEUE_NAME, {
    prefix: redisPrefix,
    connection: { ...redisConnection, maxRetriesPerRequest: 1, enableOfflineQueue: false },
    defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'fixed', delay: 1000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 1000 }
    }
});
judgeQueue.on('error', error => console.error('判题队列连接失败:', error.message));

const enqueueSubmission = (submissionId) =>
    judgeQueue.add('judge', { submissionId }, { jobId: 'submission-' + submissionId });

module.exports = { JUDGE_QUEUE_NAME, redisConnection, redisPrefix, judgeQueue, enqueueSubmission };


