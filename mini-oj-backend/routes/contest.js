// routes/contest.js
const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// ================= API 1：获取全站竞赛/作业列表 =================
router.get('/list', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, title, start_time, end_time FROM contests ORDER BY start_time DESC');
        res.json({ status: 'success', data: rows });
    } catch (err) {
        console.error("获取竞赛列表失败:", err);
        res.status(500).json({ status: 'error', message: '获取竞赛列表失败' });
    }
});

// ================= API 2：获取特定竞赛包含的题目集合 (多表关联查询) =================
router.get('/:id/problems', async (req, res) => {
    const contestId = req.params.id;
    try {
        const sql = `
            SELECT p.id, p.title, p.time_limit, p.memory_limit 
            FROM contest_problems cp
            JOIN problems p ON cp.problem_id = p.id
            WHERE cp.contest_id = ?
            ORDER BY p.id ASC
        `;
        const [rows] = await pool.query(sql, [contestId]);
        res.json({ status: 'success', data: rows });
    } catch (err) {
        console.error("查询竞赛关联题目失败:", err);
        res.status(500).json({ status: 'error', message: '获取竞赛题目失败' });
    }
});

module.exports = router;