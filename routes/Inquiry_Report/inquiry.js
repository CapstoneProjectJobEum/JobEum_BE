const router = require('express').Router();
const db = require('../../db');
const { requireAuth } = require('../Middleware/auth');

// 문의 API

// 문의 생성 (개인/기업 공통)(post)
router.post('/', requireAuth, async (req, res) => {
    const { type = 'OTHER', title, content } = req.body;
    if (!title || !content) {
        return res.status(400).json({ success: false, message: 'title, content는 필수입니다.' });
    }
    if (!['SERVICE', 'BUG', 'PRAISE', 'OTHER'].includes(type)) {
        return res.status(400).json({ success: false, message: 'type 값이 올바르지 않습니다.' });
    }

    try {
        const [r] = await db.query(
            'INSERT INTO inquiry (user_id, type, title, content) VALUES (?, ?, ?, ?)',
            [req.user.id, type, title, content]
        );
        res.status(201).json({ success: true, id: r.insertId });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// 내 문의 목록 (삭제되지 않은 것만)(get)
router.get('/me', requireAuth, async (req, res) => {
    try {
        const [items] = await db.query(
            `SELECT id, type, title, content, answer, answered_at, status, created_at
             FROM inquiry
             WHERE user_id=? AND deleted_at IS NULL
             ORDER BY created_at DESC`,
            [req.user.id]
        );

        const total = items.length;

        res.json({ items, total });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});



// 문의 삭제 (작성자: 앱연 상태만, 관리자: 언제나 가능)(delete)
router.delete('/:id', requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    try {
        const [[row]] = await db.query(
            'SELECT user_id, status FROM inquiry WHERE id=? AND deleted_at IS NULL',
            [id]
        );
        if (!row) return res.status(404).json({ success: false, message: 'Not found' });

        const isOwner = row.user_id === req.user.id;
        const isAdmin = req.user.role === 'ADMIN';
        if (!isOwner && !isAdmin) {
            return res.status(403).json({ success: false, message: 'Forbidden' });
        }
        if (!isAdmin && row.status !== 'OPEN') {
            return res.status(409).json({ success: false, message: '처리 중/완료는 삭제 불가' });
        }

        await db.query(
            'UPDATE inquiry SET deleted_at=NOW(), deleted_by=? WHERE id=?',
            [req.user.id, id]
        );
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

module.exports = router;