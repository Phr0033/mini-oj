const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { enqueueSubmission } = require('../judgeQueue');

router.post('/submit', authenticateToken, async (req, res) => {
    const { code, problemId } = req.body || {};
    if (typeof code !== 'string' || !code.trim() || Buffer.byteLength(code, 'utf8') > 100000 ||
        !Number.isInteger(problemId) || problemId < 1) {
        return res.status(400).json({ status: 'error', message: '提交参数无效' });
    }
    try {
        const [problems] = await db.query('SELECT id FROM problems WHERE id = ?', [problemId]);
        if (!problems.length) return res.status(404).json({ status: 'error', message: '题目不存在' });
        const [tests] = await db.query('SELECT id FROM test_cases WHERE problem_id = ? LIMIT 1', [problemId]);
        if (!tests.length) return res.status(400).json({ status: 'error', message: '题目未配置测试点' });

        const [rows] = await db.query(
            "INSERT INTO submissions (user_id, problem_id, code, result) VALUES (?, ?, ?, 'Pending') RETURNING id",
            [req.user.id, problemId, code]
        );
        const id = rows[0].id;
        try {
            await enqueueSubmission(id);
        } catch (error) {
            console.error('加入判题队列失败:', error);
            await db.query(
                "UPDATE submissions SET result = 'Judge Error', output = '判题队列暂时不可用' WHERE id = ? AND result = 'Pending'",
                [id]
            );
            return res.status(503).json({ status: 'error', message: '判题队列暂时不可用，请稍后重试' });
        }
        res.status(202).json({ status: 'success', submissionId: id, type: 'Pending' });
    } catch (error) {
        console.error('创建提交失败:', error);
        res.status(500).json({ status: 'error', message: '创建提交失败' });
    }
});

router.get('/submission/:id', authenticateToken, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) {
        return res.status(400).json({ status: 'error', message: '提交编号无效' });
    }
    try {
        const [rows] = await db.query(
            'SELECT id, problem_id, result, output, created_at FROM submissions WHERE id = ? AND user_id = ?',
            [id, req.user.id]
        );
        if (!rows.length) return res.status(404).json({ status: 'error', message: '提交不存在' });
        res.json({ status: 'success', data: rows[0] });
    } catch (error) {
        console.error('查询提交失败:', error);
        res.status(500).json({ status: 'error', message: '查询提交失败' });
    }
});

module.exports = router;
