require('../config/env');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const SECRET_KEY = process.env.JWT_SECRET;
if (!SECRET_KEY || SECRET_KEY.length < 32) {
    throw new Error('JWT_SECRET must be set to at least 32 characters');
}

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ status: 'error', message: '请先登录' });

    jwt.verify(token, SECRET_KEY, async (err, user) => {
        if (err) return res.status(403).json({ status: 'error', message: '登录已过期' });
        try {
            const [rows] = await pool.query('SELECT id, username, is_admin FROM users WHERE id = ?', [user.id]);
            if (rows.length !== 1) {
                return res.status(403).json({ status: 'error', message: '账号已失效，请重新登录' });
            }
            req.user = rows[0];
            next();
        } catch (error) {
            next(error);
        }
    });
};

module.exports = { authenticateToken, SECRET_KEY };
