const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

const isAdmin = async (req, res, next) => {
    try {
        const [rows] = await pool.query('SELECT is_admin FROM users WHERE id = ?', [req.user.id]);
        if (!rows[0]?.is_admin) {
            return res.status(403).json({ status: 'error', message: '权限不足' });
        }
        next();
    } catch (error) {
        next(error);
    }
};

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

router.get('/admin/problem/:id', authenticateToken, isAdmin, async (req, res) => {
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

router.post('/admin/problem', authenticateToken, isAdmin, async (req, res) => {
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

router.put('/admin/problem/:id', authenticateToken, isAdmin, async (req, res) => {
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

router.delete('/admin/problem/:id', authenticateToken, isAdmin, async (req, res) => {
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

const parseContestTime = (value) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
    const date = new Date(value);
    const [year, month, day, hour, minute] = value.match(/\d+/g).map(Number);
    if (Number.isNaN(date.getTime()) || date.getFullYear() !== year ||
        date.getMonth() + 1 !== month || date.getDate() !== day ||
        date.getHours() !== hour || date.getMinutes() !== minute) return null;
    return date;
};

router.post('/admin/contest', authenticateToken, isAdmin, async (req, res) => {
    const { title, start_time, end_time, problem_ids } = req.body || {};
    const start = parseContestTime(start_time);
    const end = parseContestTime(end_time);
    const validIds = Array.isArray(problem_ids) && problem_ids.length >= 1 && problem_ids.length <= 100 &&
        problem_ids.every(id => Number.isInteger(id) && id > 0) &&
        new Set(problem_ids).size === problem_ids.length;
    if (typeof title !== 'string' || !title.trim() || title.trim().length > 255 ||
        !start || !end || end <= start || !validIds) {
        return res.status(400).json({ status: 'error', message: '请填写有效的比赛名称、时间和赛题' });
    }
    try {
        const contest = await pool.withTransaction(async (tx) => {
            const [problems] = await tx.query('SELECT id FROM problems WHERE id = ANY(?::int[])', [problem_ids]);
            if (problems.length !== problem_ids.length) return null;
            const [rows] = await tx.query(
                'INSERT INTO contests (title, start_time, end_time) VALUES (?, ?, ?) RETURNING id, title, start_time, end_time',
                [title.trim(), start_time, end_time]
            );
            for (const problemId of problem_ids) {
                await tx.query('INSERT INTO contest_problems (contest_id, problem_id) VALUES (?, ?)', [rows[0].id, problemId]);
            }
            return rows[0];
        });
        if (!contest) return res.status(400).json({ status: 'error', message: '所选赛题有不存在的题目，请刷新题库' });
        res.status(201).json({ status: 'success', message: '比赛发布成功', data: contest });
    } catch (error) {
        console.error('发布比赛失败:', error);
        res.status(500).json({ status: 'error', message: '发布比赛失败' });
    }
});

router.delete('/admin/contest/:id', authenticateToken, isAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ status: 'error', message: '比赛编号无效' });
    try {
        const found = await pool.withTransaction(async (tx) => {
            const [rows] = await tx.query('SELECT id FROM contests WHERE id = ? FOR UPDATE', [id]);
            if (!rows.length) return false;
            await tx.query('DELETE FROM contest_problems WHERE contest_id = ?', [id]);
            await tx.query('DELETE FROM contests WHERE id = ?', [id]);
            return true;
        });
        if (!found) return res.status(404).json({ status: 'error', message: '比赛不存在' });
        res.json({ status: 'success', message: '比赛已删除' });
    } catch (error) {
        console.error('删除比赛失败:', error);
        res.status(500).json({ status: 'error', message: '删除比赛失败' });
    }
});
const parsePositiveId = (value) => {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
};

router.get('/admin/posts', authenticateToken, isAdmin, async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT p.id, p.title, p.content, p.created_at, u.username,
                   COUNT(c.id)::int AS comment_count
            FROM posts p
            JOIN users u ON u.id = p.user_id
            LEFT JOIN comments c ON c.post_id = p.id
            GROUP BY p.id, u.username
            ORDER BY p.created_at DESC, p.id DESC
        `);
        res.json({ status: 'success', data: rows });
    } catch (error) {
        console.error('获取讨论区管理列表失败:', error);
        res.status(500).json({ status: 'error', message: '获取帖子失败' });
    }
});

router.get('/admin/posts/:id/comments', authenticateToken, isAdmin, async (req, res) => {
    const id = parsePositiveId(req.params.id);
    if (!id) return res.status(400).json({ status: 'error', message: '帖子编号无效' });
    try {
        const [posts] = await pool.query('SELECT id FROM posts WHERE id = ?', [id]);
        if (!posts.length) return res.status(404).json({ status: 'error', message: '帖子不存在' });
        const [rows] = await pool.query(`
            SELECT c.id, c.post_id, c.content, c.created_at, u.username
            FROM comments c
            JOIN users u ON u.id = c.user_id
            WHERE c.post_id = ?
            ORDER BY c.created_at ASC, c.id ASC
        `, [id]);
        res.json({ status: 'success', data: rows });
    } catch (error) {
        console.error('获取评论管理列表失败:', error);
        res.status(500).json({ status: 'error', message: '获取评论失败' });
    }
});

router.delete('/admin/posts/:id', authenticateToken, isAdmin, async (req, res) => {
    const id = parsePositiveId(req.params.id);
    if (!id) return res.status(400).json({ status: 'error', message: '帖子编号无效' });
    try {
        const found = await pool.withTransaction(async (tx) => {
            const [posts] = await tx.query('SELECT id FROM posts WHERE id = ? FOR UPDATE', [id]);
            if (!posts.length) return false;
            await tx.query('DELETE FROM comments WHERE post_id = ?', [id]);
            await tx.query('DELETE FROM posts WHERE id = ?', [id]);
            return true;
        });
        if (!found) return res.status(404).json({ status: 'error', message: '帖子不存在' });
        res.json({ status: 'success', message: '帖子及其评论已删除' });
    } catch (error) {
        console.error('删除帖子失败:', error);
        res.status(500).json({ status: 'error', message: '删除帖子失败' });
    }
});

router.delete('/admin/comments/:id', authenticateToken, isAdmin, async (req, res) => {
    const id = parsePositiveId(req.params.id);
    if (!id) return res.status(400).json({ status: 'error', message: '评论编号无效' });
    try {
        const [rows] = await pool.query('DELETE FROM comments WHERE id = ? RETURNING id', [id]);
        if (!rows.length) return res.status(404).json({ status: 'error', message: '评论不存在' });
        res.json({ status: 'success', message: '评论已删除' });
    } catch (error) {
        console.error('删除评论失败:', error);
        res.status(500).json({ status: 'error', message: '删除评论失败' });
    }
});
module.exports = router;


