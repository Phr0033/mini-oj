// routes/forum.js
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

// 1. 【查】获取所有帖子列表 (包含发帖人的用户名)
router.get('/posts', async (req, res) => {
    try {
        // 使用 LEFT JOIN 连表查询，把用户的 username 一并带出来，按时间倒序排列
        const [rows] = await pool.query(`
            SELECT posts.*, users.username 
            FROM posts 
            LEFT JOIN users ON posts.user_id = users.id 
            ORDER BY posts.created_at DESC
        `);
        res.json({ status: 'success', data: rows });
    } catch (err) {
        console.error('获取帖子列表失败:', err);
        res.status(500).json({ status: 'error', message: '服务异常，获取列表失败' });
    }
});

// 2. 【增】发布新帖子 (需要登录鉴权)
router.post('/posts', authenticateToken, async (req, res) => {
    const { title, content, problemId } = req.body;
    const userId = req.user.id; // 从 Token 中解析出来的当前登录用户 ID

    if (!title || !content) {
        return res.status(400).json({ status: 'error', message: '标题和内容不能为空' });
    }

    try {
        await pool.query(
            'INSERT INTO posts (user_id, title, content, problem_id) VALUES (?, ?, ?, ?)',
            [userId, title, content, problemId || null]
        );
        res.json({ status: 'success', message: '🎉 帖子发布成功！' });
    } catch (err) {
        console.error('发帖失败:', err);
        res.status(500).json({ status: 'error', message: '发帖失败' });
    }
});

// 3. 【查】获取单个帖子详情及旗下所有评论 (同时增加浏览量)
router.get('/posts/:id', async (req, res) => {
    const postId = req.params.id;

    try {
        // 1. 增加一次浏览量 (View Count)
        await pool.query('UPDATE posts SET view_count = view_count + 1 WHERE id = ?', [postId]);

        // 2. 查询帖子详情和作者名
        const [postRows] = await pool.query(`
            SELECT posts.*, users.username 
            FROM posts 
            LEFT JOIN users ON posts.user_id = users.id 
            WHERE posts.id = ?
        `, [postId]);

        if (postRows.length === 0) {
            return res.status(404).json({ status: 'error', message: '该帖子已不存在' });
        }

        // 3. 查询该帖子底下的所有评论和评论者名 (按时间正序，先聊的在上面)
        const [commentRows] = await pool.query(`
            SELECT comments.*, users.username 
            FROM comments 
            LEFT JOIN users ON comments.user_id = users.id 
            WHERE comments.post_id = ? 
            ORDER BY comments.created_at ASC
        `, [postId]);

        res.json({
            status: 'success',
            data: {
                post: postRows[0],
                comments: commentRows
            }
        });
    } catch (err) {
        console.error('获取帖子详情失败:', err);
        res.status(500).json({ status: 'error', message: '获取帖子详情失败' });
    }
});

// 4. 【增】发表评论 (需要登录鉴权)
router.post('/posts/:id/comments', authenticateToken, async (req, res) => {
    const postId = req.params.id;
    const { content } = req.body;
    const userId = req.user.id;

    if (!content) {
        return res.status(400).json({ status: 'error', message: '评论内容不能为空' });
    }

    try {
        const [rows] = await pool.query(
            'INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?) RETURNING id, post_id, user_id, content, created_at',
            [postId, userId, content]
        );
        res.json({ status: 'success', message: '评论发表成功', data: { ...rows[0], username: req.user.username } });
    } catch (err) {
        console.error('发表评论失败:', err);
        res.status(500).json({ status: 'error', message: '评论失败' });
    }
});

module.exports = router;