const router = require('express').Router();
const db = require('../../db');
const { requireAuth } = require('../Middleware/auth');
const { createBulkNotifications } = require('../Services/notificationService');

const TARGET_TYPES = ['JOB_POST', 'COMPANY', 'USER'];

// 신고 API

// 대상 존재 검증 함수
async function existsJobPost(id) {
    const [[r]] = await db.query('SELECT id FROM job_post WHERE id=?', [id]);
    return !!r;
}
async function existsCompany(userId) {
    const [[r]] = await db.query("SELECT id FROM users WHERE id=? AND role='COMPANY'", [userId]);
    return !!r;
}
async function existsUser(userId) {
    const [[r]] = await db.query('SELECT id FROM users WHERE id=?', [userId]);
    return !!r;
}

// 신고 생성 (개인/기업 공통)
router.post('/', requireAuth, async (req, res) => {
    const { target_type, target_id, reason } = req.body;

    if (!TARGET_TYPES.includes(target_type)) {
        return res.status(400).json({ success: false, message: 'target_type이 올바르지 않습니다.' });
    }
    if (!target_id || !reason || String(reason).trim().length < 2) {
        return res.status(400).json({ success: false, message: 'target_id, reason은 필수입니다.' });
    }

    try {
        let ok = false;
        if (target_type === 'JOB_POST') ok = await existsJobPost(target_id);
        if (target_type === 'COMPANY') ok = await existsCompany(target_id);
        if (target_type === 'USER') ok = await existsUser(target_id);
        if (!ok) return res.status(404).json({ success: false, message: '신고 대상이 존재하지 않습니다.' });

        // 1) 신고 저장
        const [r] = await db.query(
            'INSERT INTO report (reporter_user_id, target_type, target_id, reason) VALUES (?, ?, ?, ?)',
            [req.user.id, target_type, target_id, reason]
        );
        const reportId = r.insertId;

        // 2) 관리자 알림 (새 신고 접수)
        try {
            const [admins] = await db.query(`SELECT id AS admin_id FROM users WHERE role='ADMIN'`);
            if (admins.length) {
                const io = req.app.get('io');
                const rows = admins.map(a => ({
                    userId: a.admin_id,
                    role: 'ADMIN',
                    type: 'ADMIN_REPORT_CREATED',
                    title: '새 신고 접수',
                    message: `새 신고가 접수되었습니다: 사유='${reason}'`,
                    metadata: {
                        report_id: reportId,
                        from_user_id: req.user.id,
                        target_type,
                        target_id
                    }
                }));
                await createBulkNotifications(io, rows);
            }
        } catch (notifyErr) {
            console.error('[notify] admin report created error:', notifyErr);
            // 알림 실패해도 신고 생성은 성공 처리
        }

        res.status(201).json({ success: true, id: reportId });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// 내 신고 목록
router.get('/me', requireAuth, async (req, res) => {
    try {
        const [items] = await db.query(
            `SELECT id, target_type, target_id, reason, answer, status, created_at, answered_at
         FROM report
        WHERE reporter_user_id=? AND deleted_at IS NULL
        ORDER BY created_at DESC`,
            [req.user.id]
        );

        res.json({ items });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// 신고 삭제
router.delete('/:id', requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    try {
        const [[row]] = await db.query(
            'SELECT reporter_user_id, status FROM report WHERE id=? AND deleted_at IS NULL',
            [id]
        );
        if (!row) return res.status(404).json({ success: false, message: 'Not found' });

        const isOwner = row.reporter_user_id === req.user.id;
        if (!isOwner) {
            return res.status(403).json({ success: false, message: 'Forbidden' });
        }

        await db.query(
            'UPDATE report SET deleted_at=NOW(), deleted_by=? WHERE id=?',
            [req.user.id, id]
        );
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

module.exports = router;