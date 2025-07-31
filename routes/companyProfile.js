const express = require('express');
const router = express.Router();
const db = require('../db');

// 기업 정보 수정 API
router.put('/', async (req, res) => {
  const {
    user_id,
    industry, // 업종
    employees, 
    establishedAt, // 설립일
    location, // 회사 위치
    companyContact, // 회사 연락처
    homepage,
    introduction // 회사 소개
  } = req.body;

  if (!user_id) {
    return res.status(400).json({ success: false, message: 'user_id는 필수입니다.' });
  }

  try {
    await db.query(`
      INSERT INTO company_profile (
        user_id, industry, employees, established_at, location,
        company_contact, homepage, introduction
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        industry = VALUES(industry),
        employees = VALUES(employees),
        established_at = VALUES(established_at),
        location = VALUES(location),
        company_contact = VALUES(company_contact),
        homepage = VALUES(homepage),
        introduction = VALUES(introduction),
        updated_at = CURRENT_TIMESTAMP
    `, [
      user_id,
      industry,
      employees,
      establishedAt,
      location,
      companyContact,
      homepage,
      introduction
    ]);

    res.json({ success: true, message: '기업 프로필이 저장되었습니다.' });
  } catch (err) {
    console.error('기업 프로필 저장 오류:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
