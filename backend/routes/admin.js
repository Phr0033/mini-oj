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

router.use('/admin', authenticateToken, isAdmin);
router.use(require('./admin/problems'));
router.use(require('./admin/contests'));
router.use(require('./admin/forum'));

module.exports = router;
