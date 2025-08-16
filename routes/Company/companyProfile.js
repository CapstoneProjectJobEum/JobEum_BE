const express = require('express');
const router = express.Router();
const db = require('../../db');

// 기업 프로필 조회 API
router.get('/:user_id', async (req, res) => {
  const { user_id } = req.params;
  try {
    const [rows] = await db.query(
      'SELECT * FROM company_profile WHERE user_id = ?',
      [user_id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: '기업 프로필이 없습니다.' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('기업 프로필 조회 오류:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 기업 프로필 추가/수정 API (upsert)
router.put('/', async (req, res) => {
  const {
    user_id,
    company_type, // 기업 형태 추가
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
        user_id, company_type, industry, employees, established_at, location,
        company_contact, homepage, introduction
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        company_type = VALUES(company_type),
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
      company_type,
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
