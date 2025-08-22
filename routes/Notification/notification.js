const express = require('express');
const router = express.Router();
const db = require('../../db');
const { requireAuth } = require('../Middleware/auth');

// 알림 API(목록/읽음)
router.get('/', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const { page = 1, size = 20, unreadOnly = 'false' } = req.query;
  const limit = Math.min(parseInt(size, 10) || 20, 100);
  const offset = ((parseInt(page, 10) || 1) - 1) * limit;

  const where = ['user_id = ?'];
  const params = [userId];
  if (unreadOnly === 'true') where.push('is_read = 0');

  const [data] = await db.query(
    `SELECT id, type, title, message, metadata, is_read, created_at
     FROM notifications
     WHERE ${where.join(' AND ')}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total FROM notifications WHERE ${where.join(' AND ')}`,
    params
  );
  res.json({ success: true, page: Number(page), size: limit, total, data });
});

router.patch('/:id/read', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const id = req.params.id;
  const [r] = await db.query(`UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?`, [id, userId]);
  res.json({ success: r.affectedRows > 0 });
});

router.patch('/read-all', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const [r] = await db.query(`UPDATE notifications SET is_read=1 WHERE user_id=? AND is_read=0`, [userId]);
  res.json({ success: true, updated: r.affectedRows });
});

module.exports = router;
