const router = require('express').Router();
const db = require('../../db');
const { requireAuth } = require('../Middleware/auth');
const { createBulkNotifications } = require('../Services/notificationService');

// 문의 API

// 문의 생성 (개인/기업 공통)
router.post('/', requireAuth, async (req, res) => {
    const { type = 'OTHER', title, content } = req.body;
    if (!title || !content) {
        return res.status(400).json({ success: false, message: 'title, content는 필수입니다.' });
    }
    if (!['SERVICE', 'BUG', 'PRAISE', 'OTHER'].includes(type)) {
        return res.status(400).json({ success: false, message: 'type 값이 올바르지 않습니다.' });
    }

    try {
        // 1) 문의 저장
        const [r] = await db.query(
            'INSERT INTO inquiry (user_id, type, title, content) VALUES (?, ?, ?, ?)',
            [req.user.id, type, title, content]
        );
        const inquiryId = r.insertId;

        // 2) 관리자 알림 (새 문의 접수)
        try {
            const [admins] = await db.query(`SELECT id AS admin_id FROM users WHERE role = 'ADMIN'`);
            if (admins.length) {
                const io = req.app.get('io');
                const rows = admins.map(a => ({
                    userId: a.admin_id,
                    role: 'ADMIN',
                    type: 'ADMIN_INQUIRY_CREATED',
                    title: '새 문의 접수',
                    message: `새 문의가 접수되었습니다: '${title}'`,
                    metadata: { inquiry_id: inquiryId, from_user_id: req.user.id, type }
                }));
                await createBulkNotifications(io, rows);
            }
        } catch (notifyErr) {
            console.error('[notify] admin inquiry created error:', notifyErr);
            // 알림 실패해도 문의 생성은 성공 처리
        }

        res.status(201).json({ success: true, id: inquiryId });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// 내 문의 목록 (삭제되지 않은 것만)
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

// 문의 삭제
router.delete('/:id', requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    try {
        const [[row]] = await db.query(
            'SELECT user_id, status FROM inquiry WHERE id=? AND deleted_at IS NULL',
            [id]
        );
        if (!row) return res.status(404).json({ success: false, message: 'Not found' });

        const isOwner = row.user_id === req.user.id;
        if (!isOwner) {
            return res.status(403).json({ success: false, message: 'Forbidden' });
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