const express = require('express');
const router = express.Router();
const db = require('../../db');

// 전체 사용자 프로필 조회 (GET /api/user-profile)
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM user_profile');
    res.json(rows);
  } catch (err) {
    console.error('전체 사용자 프로필 조회 오류:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 특정 사용자 프로필 조회 (GET /api/user-profile/:userId)
router.get('/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const [rows] = await db.query(
      'SELECT * FROM user_profile WHERE user_id = ?',
      [userId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: '사용자 프로필이 없습니다.' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('특정 사용자 프로필 조회 오류:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 사용자 프로필 생성 (POST /api/user-profile)
router.post('/', async (req, res) => {
  const {
    userId,
    disabilityTypes = [],
    disabilityGrade = '',
    assistiveDevices = [],
    preferredWorkType = [],
    jobInterest = [],
  } = req.body;

  if (!userId) {
    return res.status(400).json({ success: false, message: 'userId는 필수입니다.' });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO user_profile
      (user_id, disability_types, disability_grade, assistive_devices, preferred_work_type, job_interest)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [
        userId,
        disabilityTypes.join(','),
        disabilityGrade,
        assistiveDevices.join(','),
        preferredWorkType.join(','),
        jobInterest.join(',')
      ]
    );
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    console.error('사용자 프로필 생성 오류:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 사용자 프로필 수정/추가 (Upsert) (PUT /api/user-profile)
router.put('/', async (req, res) => {
  const {
    userId,
    disabilityTypes = [],
    disabilityGrade = '',
    assistiveDevices = [],
    preferredWorkType = [],
    jobInterest = [],
  } = req.body;

  if (!userId) {
    return res.status(400).json({ success: false, message: 'userId는 필수입니다.' });
  }

  try {
    await db.query(`
      INSERT INTO user_profile (
        user_id, disability_types, disability_grade, assistive_devices, preferred_work_type, job_interest
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        disability_types = VALUES(disability_types),
        disability_grade = VALUES(disability_grade),
        assistive_devices = VALUES(assistive_devices),
        preferred_work_type = VALUES(preferred_work_type),
        job_interest = VALUES(job_interest),
        updated_at = CURRENT_TIMESTAMP
    `, [
      userId,
      Array.isArray(disabilityTypes) ? disabilityTypes.join(',') : '',
      disabilityGrade,
      Array.isArray(assistiveDevices) ? assistiveDevices.join(',') : '',
      Array.isArray(preferredWorkType) ? preferredWorkType.join(',') : '',
      Array.isArray(jobInterest) ? jobInterest.join(',') : '',
    ]);

    res.json({ success: true, message: '사용자 프로필이 저장되었습니다.' });
  } catch (err) {
    console.error('사용자 프로필 저장 오류:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
