const router = require('express').Router();
const db = require('../../db');
const { requireAuth, requireRole } = require('../Middleware/auth');
const { createNotification } = require('../Services/notificationService');

router.use(requireAuth, requireRole('ADMIN'));

// 채용공고 삭제
router.delete('/jobs/:id', async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;

        const jobId = Number(req.params.id);

        // 삭제 전: 소유자/회사/제목 조회
        const [[job]] = await db.query(
            `SELECT jp.id AS job_post_id,
              jp.user_id AS company_user_id,
              jp.title   AS job_title,
              jp.company AS company_name
            FROM job_post jp
            WHERE jp.id = ?
            LIMIT 1`,
            [jobId]
        );

        if (!job) {
            return res.status(404).json({ success: false, message: '채용공고가 없습니다.' });
        }

        // 권한 체크
        if (userId !== Number(job.company_user_id) && userRole !== 'ADMIN') {
            return res.status(403).json({ success: false, message: '삭제 권한이 없습니다.' });
        }

        // 실제 삭제
        await db.query('DELETE FROM job_post WHERE id = ?', [jobId]);

        // 알림 트리거: 관리자에 의한 공고 삭제 
        try {
            const io = req.app.get('io');
            await createNotification(io, {
                userId: job.company_user_id,
                role: 'COMPANY',
                type: 'EMP_JOB_DELETED_BY_ADMIN',
                title: '공고 삭제 안내',
                message: `[${job.company_name}] '${job.job_title}' 공고가 관리자에 의해 삭제되었습니다.`,
                metadata: { job_post_id: job.job_post_id }
            });
        } catch (e) {
            console.error('[notify] admin job delete notify error:', e);
        }

        res.json({ success: true });
    } catch (err) {
        console.error('admin delete job error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// 문의 목록 조회
router.get('/inquiries', async (req, res) => {
    const { status = 'OPEN' } = req.query;

    try {
        const [items] = await db.query(
            `SELECT i.*, u.username
             FROM inquiry i
             JOIN users u ON u.id = i.user_id
             WHERE i.status = ? AND i.deleted_at IS NULL
             ORDER BY i.created_at DESC`,
            [status]
        );

        const total = items.length;
        res.json({ items, total });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// 문의 상세 조회
router.get('/inquiries/:id', async (req, res) => {
    const inquiryId = Number(req.params.id);

    try {
        const [[item]] = await db.query(
            `SELECT i.*, u.username
             FROM inquiry i
             JOIN users u ON u.id = i.user_id
             WHERE i.id=? AND i.deleted_at IS NULL`,
            [inquiryId]
        );

        if (!item) return res.status(404).json({ success: false, message: '문의가 없습니다.' });

        res.json({ success: true, item });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 문의 답변 작성/상태 업데이트 (PATCH 하나로 통합)
router.patch('/inquiries/:id', async (req, res) => {
    const inquiryId = Number(req.params.id);
    const { answer, status } = req.body;

    if (!answer || !answer.trim()) {
        return res.status(400).json({ success: false, message: '답변 내용을 입력해야 합니다.' });
    }

    try {
        // 1. 문의 업데이트
        const [result] = await db.query(
            `UPDATE inquiry 
             SET answer=?, status=? 
             WHERE id=? AND deleted_at IS NULL`,
            [answer, status || 'DONE', inquiryId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: '문의가 없습니다.' });
        }

        // 2. 알림 전송
        try {
            const io = req.app.get('io');

            // 문의 작성자 조회
            const [[inquiry]] = await db.query(
                `SELECT user_id, title FROM inquiry WHERE id=?`,
                [inquiryId]
            );

            if (inquiry) {
                const roles = ['MEMBER', 'COMPANY'];
                for (const role of roles) {
                    await createNotification(io, {
                        userId: inquiry.user_id,
                        role,
                        type: 'INQUIRY_REPORT_ANSWERED',
                        title: '문의 답변이 등록되었습니다.',
                        message: `문의 "${inquiry.title}"에 답변이 등록되었습니다.`,
                        metadata: { inquiryId }
                    });
                }
            }
        } catch (notifyErr) {
            console.error('[notify] inquiry answer notification error:', notifyErr);
        }

        res.json({ success: true, message: '답변이 저장되었습니다.' });
    } catch (err) {
        console.error('[PATCH /inquiries/:id]', err);
        res.status(500).json({ success: false, message: err.message });
    }
});


// 신고 목록 조회
router.get('/reports', async (req, res) => {
    const { status = 'OPEN' } = req.query;

    try {
        const [items] = await db.query(
            `SELECT r.*, u.username
             FROM report r
             JOIN users u ON u.id = r.reporter_user_id
             WHERE r.status = ? AND r.deleted_at IS NULL
             ORDER BY r.created_at DESC`,
            [status]
        );

        const [[{ total }]] = await db.query(
            `SELECT COUNT(*) AS total
             FROM report
             WHERE status = ? AND deleted_at IS NULL`,
            [status]
        );

        res.json({ items, total });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 신고 상세 조회 (인증/권한 없이)
router.get('/reports/:id', async (req, res) => {
    const reportId = Number(req.params.id);

    if (!reportId) {
        return res.status(400).json({ success: false, message: 'Report ID가 필요합니다.' });
    }

    try {
        const [[report]] = await db.query(
            `SELECT r.*, u.username AS reporter_name
             FROM report r
             LEFT JOIN users u ON u.id = r.reporter_user_id
             WHERE r.id=? AND r.deleted_at IS NULL`,
            [reportId]
        );

        if (!report) return res.status(404).json({ success: false, message: '신고가 없습니다.' });

        res.json({ success: true, item: report });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 신고 답변 작성/상태 업데이트 (PATCH 하나로 통합)
router.patch('/reports/:id', async (req, res) => {
    const reportId = Number(req.params.id);
    const { answer, status } = req.body;

    if (!answer || !answer.trim()) {
        return res.status(400).json({ success: false, message: '답변 내용을 입력해야 합니다.' });
    }

    const validStatuses = ['OPEN', 'REVIEWING', 'CLOSED'];
    const newStatus = status && validStatuses.includes(status) ? status : 'CLOSED';

    try {
        // 1. 신고 업데이트
        const [result] = await db.query(
            `UPDATE report
             SET answer=?, status=?
             WHERE id=? AND deleted_at IS NULL`,
            [answer, newStatus, reportId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: '신고가 없습니다.' });
        }

        // 2. 신고 작성자 조회
        const [[report]] = await db.query(
            `SELECT reporter_user_id FROM report WHERE id=?`,
            [reportId]
        );

        // 3. MEMBER + COMPANY 모두 알림 전송
        if (report) {
            try {
                const io = req.app.get('io');
                const roles = ['MEMBER', 'COMPANY'];
                for (const role of roles) {
                    await createNotification(io, {
                        userId: report.reporter_user_id,
                        role,
                        type: 'INQUIRY_REPORT_ANSWERED',
                        title: '신고 답변이 등록되었습니다.',
                        message: '신고에 답변이 등록되었습니다.',
                        metadata: { reportId }
                    });
                }
            } catch (notifyErr) {
                console.error('[notify] report answer notification error:', notifyErr);
            }
        }

        res.json({ success: true, message: '답변이 저장되었습니다.' });
    } catch (err) {
        console.error('[PATCH /reports/:id]', err);
        res.status(500).json({ success: false, message: err.message });
    }
});


module.exports = router;