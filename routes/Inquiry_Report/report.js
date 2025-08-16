const router = require('express').Router();
const db = require('../../db');
const { requireAuth } = require('../Middleware/auth');

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

        const [r] = await db.query(
            'INSERT INTO report (reporter_user_id, target_type, target_id, reason) VALUES (?, ?, ?, ?)',
            [req.user.id, target_type, target_id, reason]
        );
        res.status(201).json({ success: true, id: r.insertId });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// 내 신고 목록 (삭제되지 않은 것만, 페이지 관련 코드 제거)
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


// 신고 삭제 (작성자: OPEN 상태만, 관리자: 언제나 가능)
router.delete('/:id', requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    try {
        const [[row]] = await db.query(
            'SELECT reporter_user_id, status FROM report WHERE id=? AND deleted_at IS NULL',
            [id]
        );
        if (!row) return res.status(404).json({ success: false, message: 'Not found' });

        const isOwner = row.reporter_user_id === req.user.id;
        const isAdmin = req.user.role === 'ADMIN';
        if (!isOwner && !isAdmin) {
            return res.status(403).json({ success: false, message: 'Forbidden' });
        }
        if (!isAdmin && row.status !== 'OPEN') {
            return res.status(409).json({ success: false, message: '처리 중/완료는 삭제 불가' });
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
