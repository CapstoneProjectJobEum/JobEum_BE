const express = require('express');
const router = express.Router();
const db = require('../db');

// 기업회원 등록 (POST,회원가입시)
router.post('/', async (req, res) => {
  const {
    company,
    biz_number,
    manager,
    email,
    phone,
    industry, // 업종 
    introduction, // 회사 소개
    location, // 회사 위치
    establishedAt, // 설립일
    employees, // 직원 수
    homepage // 홈페이지 
  } = req.body;

  try {
    const [result] = await db.query(`
      INSERT INTO users
      (user_type, company, biz_number, manager, email, phone)
      VALUES ('기업회원', ?, ?, ?, ?, ?)
    `, [
      company,
      biz_number,
      manager,
      email,
      phone
    ]);

    res.json({ success: true, id: result.insertId });
  } catch (err) {
    console.error('기업회원 등록 오류:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 기업 정보 수정 (PUT)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const {
    company,
    biz_number,
    manager,
    email,
    phone
  } = req.body;

  try {
    const [result] = await db.query(`
      UPDATE users
      SET company=?, biz_number=?, manager=?, email=?, phone=?
      WHERE id=? AND user_type='기업회원'
    `, [
      company,
      biz_number,
      manager,
      email,
      phone,
      id
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: '기업회원이 없습니다.' });
    }

    res.json({ success: true, message: '기업 정보가 수정되었습니다.' });
  } catch (err) {
    console.error('기업회원 수정 오류:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;