const express = require('express');
const router = express.Router();
const db = require('../db');

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
    manager
  } = req.body;

  if (!user_type || !id) {
    return res.status(400).json({ success: false, message: 'user_type과 id는 필수입니다.' });
  }

  try {
    if (user_type === '개인회원') {
      await db.query(`
        UPDATE users
        SET name=?, birth=?, gender=?, email=?, phone=?
        WHERE id=? AND user_type='개인회원'
      `, [name, birth, gender, email, phone, id]);
    } else if (user_type === '기업회원') {
      await db.query(`
        UPDATE users
        SET company=?, biz_number=?, manager=?, email=?, phone=?
        WHERE id=? AND user_type='기업회원'
      `, [company, bizNumber, manager, email, phone, id]);
    } else {
      return res.status(400).json({ success: false, message: '알 수 없는 user_type입니다.' });
    }

    res.json({ success: true, message: '계정 정보가 수정되었습니다.' });
  } catch (err) {
    console.error('계정정보 수정 오류:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;