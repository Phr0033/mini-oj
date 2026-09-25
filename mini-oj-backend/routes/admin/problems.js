const express = require('express');
const router = express.Router();
const pool = require('../../config/db');

const parseProblem = (body = {}) => {
    const { title, description, test_cases, time_limit, memory_limit } = body;
    const timeLimit = Number(time_limit);
    const memoryLimit = Number(memory_limit);
    if (typeof title !== 'string' || !title.trim() ||
        typeof description !== 'string' ||
        !Number.isInteger(timeLimit) || timeLimit < 100 || timeLimit > 30000 ||
        !Number.isInteger(memoryLimit) || memoryLimit < 16 || memoryLimit > 1024 ||
        !Array.isArray(test_cases) || test_cases.length < 1 || test_cases.length > 50 ||
        test_cases.some(test => typeof test?.input_data !== 'string' || typeof test?.output_data !== 'string')) {
        return null;
    }
    return { title: title.trim(), description, testCases: test_cases, timeLimit, memoryLimit };
};

router.get('/admin/problem/:id', async (req, res) => {
    try {
        const [problems] = await pool.query(
            'SELECT id, title, description, time_limit, memory_limit FROM problems WHERE id = ?',
            [req.params.id]
        );
        if (!problems.length) return res.status(404).json({ status: 'error', message: '题目不存在' });
        const [testCases] = await pool.query(
            'SELECT id, input_data, output_data FROM test_cases WHERE problem_id = ? ORDER BY id',
            [req.params.id]
        );
        res.json({ status: 'success', data: { ...problems[0], test_cases: testCases } });
    } catch (error) {
        console.error('获取题目管理详情失败:', error);
        res.status(500).json({ status: 'error', message: '获取题目详情失败' });
    }
});

router.post('/admin/problem', async (req, res) => {
    const problem = parseProblem(req.body);
    if (!problem) return res.status(400).json({ status: 'error', message: '题目信息或测试点无效' });
    try {
        await pool.withTransaction(async (tx) => {
            const first = problem.testCases[0];
            const [rows] = await tx.query(
                'INSERT INTO problems (title, description, test_input, expected_output, time_limit, memory_limit) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
                [problem.title, problem.description, first.input_data, first.output_data, problem.timeLimit, problem.memoryLimit]
            );
            for (const test of problem.testCases) {
                await tx.query(
                    'INSERT INTO test_cases (problem_id, input_data, output_data) VALUES (?, ?, ?)',
                    [rows[0].id, test.input_data, test.output_data]
                );
            }
        });
        res.json({ status: 'success', message: '题目发布成功' });
    } catch (error) {
        console.error('发布题目失败:', error);
        res.status(500).json({ status: 'error', message: '发布失败' });
    }
});

router.put('/admin/problem/:id', async (req, res) => {
    const problem = parseProblem(req.body);
    if (!problem) return res.status(400).json({ status: 'error', message: '题目信息或测试点无效' });
    try {
        const found = await pool.withTransaction(async (tx) => {
            const first = problem.testCases[0];
            const [rows] = await tx.query(
                'UPDATE problems SET title = ?, description = ?, test_input = ?, expected_output = ?, time_limit = ?, memory_limit = ? WHERE id = ? RETURNING id',
                [problem.title, problem.description, first.input_data, first.output_data, problem.timeLimit, problem.memoryLimit, req.params.id]
            );
            if (!rows.length) return false;
            await tx.query('DELETE FROM test_cases WHERE problem_id = ?', [req.params.id]);
            for (const test of problem.testCases) {
                await tx.query(
                    'INSERT INTO test_cases (problem_id, input_data, output_data) VALUES (?, ?, ?)',
                    [req.params.id, test.input_data, test.output_data]
                );
            }
            return true;
        });
        if (!found) return res.status(404).json({ status: 'error', message: '题目不存在' });
        res.json({ status: 'success', message: '题目修改已保存' });
    } catch (error) {
        console.error('修改题目失败:', error);
        res.status(500).json({ status: 'error', message: '修改失败' });
    }
});

router.delete('/admin/problem/:id', async (req, res) => {
    try {
        const found = await pool.withTransaction(async (tx) => {
            const [rows] = await tx.query('SELECT id FROM problems WHERE id = ? FOR UPDATE', [req.params.id]);
            if (!rows.length) return false;
            await tx.query('DELETE FROM submissions WHERE problem_id = ?', [req.params.id]);
            await tx.query('DELETE FROM test_cases WHERE problem_id = ?', [req.params.id]);
            await tx.query('DELETE FROM contest_problems WHERE problem_id = ?', [req.params.id]);
            await tx.query('UPDATE posts SET problem_id = NULL WHERE problem_id = ?', [req.params.id]);
            await tx.query('DELETE FROM problems WHERE id = ?', [req.params.id]);
            return true;
        });
        if (!found) return res.status(404).json({ status: 'error', message: '题目不存在' });
        res.json({ status: 'success', message: '题目已删除' });
    } catch (error) {
        console.error('删除题目失败:', error);
        res.status(500).json({ status: 'error', message: '删除失败' });
    }
});

module.exports = router;
