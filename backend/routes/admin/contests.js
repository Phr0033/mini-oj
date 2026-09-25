const express = require('express');
const router = express.Router();
const pool = require('../../config/db');

const parseContestTime = (value) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
    const date = new Date(value);
    const [year, month, day, hour, minute] = value.match(/\d+/g).map(Number);
    if (Number.isNaN(date.getTime()) || date.getFullYear() !== year ||
        date.getMonth() + 1 !== month || date.getDate() !== day ||
        date.getHours() !== hour || date.getMinutes() !== minute) return null;
    return date;
};

router.post('/admin/contest', async (req, res) => {
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

router.delete('/admin/contest/:id', async (req, res) => {
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

module.exports = router;
