const router = require('express').Router();
const db = require('../db');
const { requireAuth, requireRole } = require('../../Middleware/auth');

router.use(requireAuth, requireRole('ADMIN'));

// 관리자 API

// 채용공고 삭제
router.delete('/jobs/:id', async (req, res) => {
  await db.query('DELETE FROM job_post WHERE id=?', [req.params.id]);
  res.json({ success: true });
});

// 문의 목록 조회 
router.get('/inquiries', async (req, res) => {
  const { status = 'OPEN', page = 1, size = 20 } = req.query;
  const limit = Number(size);
  const offset = (Number(page) - 1) * limit;

  const [items] = await db.query(
    `SELECT i.*, u.username
     FROM inquiry i
     JOIN users u ON u.id = i.user_id
     WHERE i.status = ? AND i.deleted_at IS NULL
     ORDER BY i.created_at DESC
     LIMIT ? OFFSET ?`,
    [status, limit, offset]
  );

  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total
     FROM inquiry
     WHERE status = ? AND deleted_at IS NULL`,
    [status]
  );

  res.json({ items, page: Number(page), size: limit, total });
});

// 신고 목록 조회 
router.get('/reports', async (req, res) => {
  const { status = 'OPEN', page = 1, size = 20 } = req.query;
  const limit = Number(size);
  const offset = (Number(page) - 1) * limit;

  const [items] = await db.query(
    `SELECT r.*, u.username
     FROM report r
     JOIN users u ON u.id = r.reporter_user_id
     WHERE r.status = ? AND r.deleted_at IS NULL
     ORDER BY r.created_at DESC
     LIMIT ? OFFSET ?`,
    [status, limit, offset]
  );

  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total
     FROM report
     WHERE status = ? AND deleted_at IS NULL`,
    [status]
  );

  res.json({ items, page: Number(page), size: limit, total });
});

// 상태 업데이트 (문의/신고 공통)
router.patch('/inquiries/:id', async (req, res) => {
  const { status } = req.body; // OPEN | IN_PROGRESS | DONE
  await db.query(
    'UPDATE inquiry SET status=? WHERE id=? AND deleted_at IS NULL',
    [status, req.params.id]
  );
  res.json({ success: true });
});

router.patch('/reports/:id', async (req, res) => {
  const { status } = req.body; // OPEN | REVIEWING | CLOSED
  await db.query(
    'UPDATE report SET status=? WHERE id=? AND deleted_at IS NULL',
    [status, req.params.id]
  );
  res.json({ success: true });
});

module.exports = router;
