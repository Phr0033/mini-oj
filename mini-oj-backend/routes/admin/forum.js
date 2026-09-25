const express = require('express');
const router = express.Router();
const pool = require('../../config/db');

const parsePositiveId = (value) => {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
};

router.get('/admin/posts', async (req, res) => {
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

router.get('/admin/posts/:id/comments', async (req, res) => {
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

router.delete('/admin/posts/:id', async (req, res) => {
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

router.delete('/admin/comments/:id', async (req, res) => {
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
