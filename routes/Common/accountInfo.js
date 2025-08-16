const express = require('express');
const router = express.Router();
const db = require('../../db');

// 계정 정보 수정 (개인/기업)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const {
    user_type,
    name,
    birth,
    gender,
    email,
    phone,
    company,
    bizNumber,
    manager,
  } = req.body;

  if (!user_type || !id) {
    return res.status(400).json({ success: false, message: 'user_type과 id는 필수입니다.' });
  }

  try {
    if (user_type === '개인회원') {
      await db.query(
        `UPDATE users SET name=?, birth=?, gender=?, email=?, phone=? WHERE id=? AND user_type='개인회원'`,
        [name, birth, gender, email, phone, id]
      );
    } else if (user_type === '기업회원') {
      await db.query(
        `UPDATE users SET company=?, biz_number=?, manager=?, email=?, phone=? WHERE id=? AND user_type='기업회원'`,
        [company, bizNumber, manager, email, phone, id]
      );
    } else {
      return res.status(400).json({ success: false, message: '알 수 없는 user_type입니다.' });
    }

    res.json({ success: true, message: '계정 정보가 수정되었습니다.' });
  } catch (err) {
    console.error('계정정보 수정 오류:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 계정 정보 조회 (개인/기업 회원 구분)
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // 개인회원 조회
    let [rows] = await db.query(
      `SELECT id, user_type, name, birth, gender, email, phone FROM users WHERE id = ? AND user_type = '개인회원'`,
      [id]
    );

    if (rows.length > 0) return res.json(rows[0]);

    // 기업회원 조회
    [rows] = await db.query(
      `SELECT id, user_type, company, biz_number, manager, email, phone FROM users WHERE id = ? AND user_type = '기업회원'`,
      [id]
    );

    if (rows.length > 0) return res.json(rows[0]);

    return res.status(404).json({ success: false, message: '해당 사용자를 찾을 수 없습니다.' });
  } catch (err) {
    console.error('사용자 정보 조회 오류:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
