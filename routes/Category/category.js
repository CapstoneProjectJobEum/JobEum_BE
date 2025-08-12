const router = require('express').Router();
const db = require('../db');
const { requireAuth, requireRole } = require('../Middleware/auth');

// 카테고리 API
router.get('/', async (req, res) => {
  const [rows] = await db.query('SELECT id, name, parent_id FROM category ORDER BY name ASC');
  res.json(rows);
});

router.post('/', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const { name, parentId } = req.body;
  await db.query('INSERT INTO category(name, parent_id) VALUES (?, ?)', [name, parentId || null]);
  res.status(201).json({ success: true });
});

router.patch('/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const { name, parentId } = req.body;
  await db.query('UPDATE category SET name=?, parent_id=? WHERE id=?', [name, parentId || null, req.params.id]);
  res.json({ success: true });
});

router.delete('/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  await db.query('DELETE FROM category WHERE id=?', [req.params.id]);
  res.json({ success: true });
});

module.exports = router;