// routes/records.js
const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// 1. 获取全站最新提交记录 (Status 页面)
router.get('/status', async (req, res) => {
    try {
        // 连表查询：把 submissions, users, problems 三张表缝合起来
        const [rows] = await pool.query(`
            SELECT s.id, u.username, p.id as problem_id, p.title as problem_title, s.result, s.created_at
            FROM submissions s
            JOIN users u ON s.user_id = u.id
            JOIN problems p ON s.problem_id = p.id
            ORDER BY s.created_at DESC
            LIMIT 50
        `);
        res.json({ status: 'success', data: rows });
    } catch (err) {
        console.error('获取状态记录失败:', err);
        res.status(500).json({ status: 'error', message: '获取状态失败' });
    }
});

// 2. 获取全站排行榜 (Leaderboard 页面)
router.get('/leaderboard', async (req, res) => {
    try {
        // SQL 魔法：按用户分组，统计每个人 AC 的【去重】题目数（同一道题 AC 多次只算 1 次）
        const [rows] = await pool.query(`
            SELECT u.username, 
                   COUNT(DISTINCT CASE WHEN s.result = 'Accepted' THEN s.problem_id END) as ac_count,
                   COUNT(DISTINCT CASE WHEN s.result NOT IN ('Pending', 'Running', 'Judge Error') THEN s.problem_id END) as attempted_count,
                   COUNT(s.id) as total_submissions
            FROM users u
            LEFT JOIN submissions s ON u.id = s.user_id
            GROUP BY u.id
            ORDER BY ac_count DESC, total_submissions ASC
        `);
        res.json({ status: 'success', data: rows });
    } catch (err) {
        console.error('获取排行榜失败:', err);
        res.status(500).json({ status: 'error', message: '获取排行榜失败' });
    }
});

module.exports = router;
