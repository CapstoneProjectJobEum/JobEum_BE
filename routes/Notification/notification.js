const express = require('express');
const router = express.Router();
const db = require('../../db');
const { requireAuth } = require('../Middleware/auth');

// 알림 API(목록/읽음)
router.get('/', requireAuth, async (req, res) => {
    const userId = req.user.id;
    const { unreadOnly = 'false' } = req.query;

    const where = ['user_id = ?'];
    const params = [userId];
    if (unreadOnly === 'true') where.push('is_read = 0');

    const [data] = await db.query(
        `SELECT id, type, title, message, metadata, is_read, created_at
         FROM notifications
         WHERE ${where.join(' AND ')}
         ORDER BY created_at DESC`,
        params
    );

    const [[{ total }]] = await db.query(
        `SELECT COUNT(*) AS total FROM notifications WHERE ${where.join(' AND ')}`,
        params
    );

    res.json({ success: true, total, data });
});


// 1. 전체 알림 읽음 처리
router.patch('/read-all', requireAuth, async (req, res) => {
    const userId = req.user.id;
    const [r] = await db.query(
        `UPDATE notifications SET is_read=1 WHERE user_id=? AND is_read=0`,
        [userId]
    );
    res.json({ success: true, updated: r.affectedRows });
});

// 2. 개별 알림 읽음 처리
router.patch('/:id/read', requireAuth, async (req, res) => {
    const userId = req.user.id;
    const id = req.params.id;
    const [r] = await db.query(
        `UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?`,
        [id, userId]
    );
    res.json({ success: r.affectedRows > 0 });
});

// 1. 전체 삭제 라우트
router.delete('/delete-all', requireAuth, async (req, res) => {
    const userId = req.user.id;
    try {
        const [r] = await db.query(
            `DELETE FROM notifications WHERE user_id=?`,
            [userId]
        );
        res.json({ success: true, deleted: r.affectedRows });
    } catch (err) {
        console.error('[DELETE /notifications/delete-all]', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// 2. 개별 삭제 라우트 나중
router.delete('/:id', requireAuth, async (req, res) => {
    const userId = req.user.id;
    const id = req.params.id;
    const [r] = await db.query(
        `DELETE FROM notifications WHERE id=? AND user_id=?`,
        [id, userId]
    );
    res.json({ success: r.affectedRows > 0 });
});

// 지원서 취소 시 삭제
router.delete('/cancel-by-job/:targetId', requireAuth, async (req, res) => {

    const targetId = parseInt(req.params.targetId, 10);
    try {
        // 지원자 및 기업 알림 모두 삭제
        const [r] = await db.query(
            `DELETE FROM notifications
             WHERE JSON_EXTRACT(metadata, '$.job_post_id') = ?
               AND type IN ('APPLICATION_STATUS_UPDATE', 'EMP_APPLICATION_RECEIVED')`,
            [targetId]
        );

        res.json({ success: true, deleted: r.affectedRows });
    } catch (err) {
        console.error('[DELETE /notifications/cancel-by-job/:targetId]', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// 문의, 신고 내역 삭제 시 삭제
router.delete('/cancel-by-inquiry-and-report/:id', requireAuth, async (req, res) => {
    const targetId = parseInt(req.params.id, 10);

    try {
        // 관련 알림 삭제 (문의 / 신고 모두)
        const [r] = await db.query(
            `DELETE FROM notifications
            WHERE (
             JSON_EXTRACT(metadata, '$.inquiry_id') = ?
            OR JSON_EXTRACT(metadata, '$.report_id') = ?
            OR JSON_EXTRACT(metadata, '$.inquiryId') = ?
            OR JSON_EXTRACT(metadata, '$.reportId') = ?
            )
            AND type IN ('ADMIN_INQUIRY_CREATED', 'ADMIN_REPORT_CREATED', 'INQUIRY_REPORT_ANSWERED')`,
            [targetId, targetId, targetId, targetId]
        );


        res.json({ success: true, deleted: r.affectedRows });
    } catch (err) {
        console.error('[DELETE /notifications/cancel-by-inquiry-and-report/:id]', err);
        res.status(500).json({ success: false, message: err.message });
    }
});



// ==================== 알림 설정 API ====================

// GET: 알림 설정 가져오기
router.get('/settings', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { role } = req.query;

        const [rows] = await db.query(
            `SELECT all_notifications, settings 
             FROM notification_settings 
             WHERE user_id = ? AND role = ?`,
            [userId, role]
        );

        if (rows.length === 0) {
            // 최초 사용자 → default all ON, 세부도 1
            let defaultSettings = {};
            if (role === 'MEMBER') {
                defaultSettings = {
                    newJobFromFollowedCompany: 1,
                    favoriteJobDeadline: 1,
                    applicationStatusChange: 1,
                    inquiryReportAnswered: 1
                };
            } else if (role === 'COMPANY') {
                defaultSettings = {
                    newApplicant: 1,
                    empJobDeadline: 1,
                    adminDeletedJob: 1,
                    inquiryReportAnswered: 1
                };
            } else if (role === 'ADMIN') {
                defaultSettings = {
                    newInquiry: 1,
                    newReport: 1
                };
            }

            await db.query(
                `INSERT INTO notification_settings (user_id, role, all_notifications, settings)
                 VALUES (?, ?, ?, ?)`,
                [userId, role, 1, JSON.stringify(defaultSettings)]
            );

            return res.json({ all_notifications: 1, settings: defaultSettings });
        }

        res.json({
            all_notifications: rows[0].all_notifications,
            settings: rows[0].settings
        });
    } catch (err) {
        console.error('[GET /settings]', err);
        res.status(500).json({ error: 'DB error' });
    }
});

// 알림 설정 저장
router.post('/settings', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { role, all_notifications, settings } = req.body;

        await db.query(
            `INSERT INTO notification_settings (user_id, role, all_notifications, settings)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE 
             all_notifications = VALUES(all_notifications),
             settings = VALUES(settings)`,
            [userId, role, all_notifications, JSON.stringify(settings)]
        );

        res.json({
            success: true,
            all_notifications,
            settings
        });
    } catch (err) {
        console.error('[POST /settings]', err);
        res.status(500).json({ error: 'DB error' });
    }
});


module.exports = router;
