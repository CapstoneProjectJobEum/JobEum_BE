//기업이 공고에 카테고리 지정하는 API
const router = require('express').Router();
const db = require('../../db');
const { requireAuth, requireRole } = require('../Middleware/auth');

router.put('/:jobId/categories', requireAuth, requireRole('COMPANY'), async (req, res) => {
    const { jobId } = req.params;
    const { categoryIds } = req.body; // [1,2,3]

    // 본인 공고인지 확인 (기업 계정 보호)
    const [[owner]] = await db.query('SELECT company_user_id FROM job_post WHERE id=?', [jobId]);
    if (!owner) return res.status(404).json({ message: 'Not found' });
    if (owner.company_user_id !== req.user.id) return res.status(403).json({ message: 'Forbidden' });

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        await conn.query('DELETE FROM job_post_category WHERE job_post_id=?', [jobId]);

        if (Array.isArray(categoryIds) && categoryIds.length) {
            const values = categoryIds.map(cid => [jobId, cid]);
            await conn.query('INSERT INTO job_post_category(job_post_id, category_id) VALUES ?', [values]);
        }

        await conn.commit();
        res.json({ success: true });
    } catch (e) {
        await conn.rollback();
        res.status(500).json({ message: e.message });
    } finally {
        conn.release();
    }
});

module.exports = router;