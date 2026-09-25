const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// ================= API 1：获取题目列表 =================
router.get('/problems', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, title FROM problems');
        res.json({ status: 'success', data: rows });

    } catch (err) {
        console.error("查询题目列表失败:", err);
        res.status(500).json({ status: 'error', message: '获取题目列表失败' });
    }
});

// =================  API 2：获取单题详细信息 =================
router.get('/problem/:id', async (req, res) => {
    try {
        const problemId = req.params.id;
       
        const [rows] = await pool.query('SELECT id, title, description, time_limit, memory_limit FROM problems WHERE id = ?', [problemId]);
        
        if (rows.length === 0) {
            return res.status(404).json({ status: 'error', message: '题目不存在' });
        }
        res.json({ status: 'success', data: rows[0] });
    } catch (err) {
        console.error("查询题目详情失败:", err);
        res.status(500).json({ status: 'error', message: '获取题目详情失败' });
    }
});

module.exports = router;