//사용자 모델 및 유틸리티
const express = require('express');
const router = express.Router();
const db = require('../db');

router.post('/', async (req, res) => {
  const {
    disabilityTypes,
    disabilityGrade,
    assistiveDevices,
    preferredWorkType,
    jobInterest,
  } = req.body;
  try {
    const [result] = await db.query(
      `INSERT INTO user_profile
      (disability_types, disability_grade, assistive_devices, preferred_work_type, job_interest)
      VALUES (?, ?, ?, ?, ?)`,
      [
        disabilityTypes.join(','),
        disabilityGrade,
        assistiveDevices.join(','),
        preferredWorkType.join(','),
        jobInterest.join(',')
      ]
    );
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 모든 구직자 정보 조회 (GET /api/user-profile) 
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM user_profile');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;