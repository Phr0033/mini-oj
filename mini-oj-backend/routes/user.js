const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db'); // 引入刚刚拆出去的 db
const { authenticateToken, SECRET_KEY } = require('../middleware/auth');

// ================= API 1：用户注册接口 =================
router.post('/register', async (req, res) => {
    const { username, password } = req.body || {};

    if (typeof username !== 'string' || !username.trim() || typeof password !== 'string' || !password) {
        return res.status(400).json({ status: 'error', message: '用户名和密码不能为空' });
    }

    try {
        // 密码加盐加密 (算力消耗设定为 10)
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // 存入数据库
        await pool.query('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword]);
        
        res.json({ status: 'success', message: '注册成功，去登录吧！' });
    } catch (err) {
        // 如果错误码是 ER_DUP_ENTRY，说明用户名被抢占了
        if (err.code === '23505') {
            return res.status(409).json({ status: 'error', message: '用户名已被注册' });
        }
        console.error('注册报错:', err);
        res.status(500).json({ status: 'error', message: '服务器错误' });
    }
});

// ================= API 2：用户登录接口 =================
router.post('/login', async (req, res) => {
    const { username, password } = req.body || {};
    if (typeof username !== 'string' || !username || typeof password !== 'string' || !password) {
        return res.status(400).json({ status: 'error', message: '用户名和密码不能为空' });
    }

    try {
        // 去数据库找这个人
        const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
        if (rows.length === 0) {
            return res.status(401).json({ status: 'error', message: '用户名或密码错误' });
        }

        const user = rows[0];

        // 验证密码对不对
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ status: 'error', message: '用户名或密码错误' });
        }

        // 密码正确！颁发 JWT 电子通行证 (有效期 24 小时)

        // jwt.sign(payload, secretOrPrivateKey, [options])

        const token = jwt.sign(
            { id: user.id, username: user.username }, 
            SECRET_KEY, 
            { expiresIn: '24h' }
        );

        res.json({ 
            status: 'success', 
            message: '登录成功', 
            token: token, 
            username: user.username,
            isAdmin: Boolean(user.is_admin)
        });

    } catch (err) {
        console.error('登录报错:', err);
        res.status(500).json({ status: 'error', message: '服务器错误' });
    }
});


// ================= API: 获取当前用户的做题状态 =================
router.get('/user/status', authenticateToken, async (req, res) => {
    try {
        //按题目分组，统计通过次数和总提交次数
        const [rows] = await pool.query(`
            SELECT problem_id,
                   SUM(CASE WHEN result = 'Accepted' THEN 1 ELSE 0 END) as ac_count,
                   COUNT(*) FILTER (WHERE result NOT IN ('Pending', 'Running', 'Judge Error')) as total_attempts,
                   COUNT(*) FILTER (WHERE result IN ('Pending', 'Running')) as pending_count
            FROM submissions
            WHERE user_id = ?
            GROUP BY problem_id
        `, [req.user.id]);
        
        res.json({ status: 'success', data: rows });
    } catch (err) {
        res.status(500).json({ status: 'error', message: '获取状态失败' });
    }
});

module.exports = router;
