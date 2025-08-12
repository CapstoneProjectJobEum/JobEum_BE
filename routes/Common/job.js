const express = require('express');
const router = express.Router();
const db = require('../../db');

// 채용공고 관련 API

// 1. 채용공고 목록
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM job_post ORDER BY id DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 2. 채용공고 상세
router.get('/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const [rows] = await db.query('SELECT * FROM job_post WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "공고가 없습니다" });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. 채용공고 등록 (리팩토링 적용)
router.post('/', async (req, res) => {
  const {
    user_id,
    title,
    company,
    location,
    deadline,
    career,
    education,
    detail,
    summary,
    working_conditions,
    disability_requirements,
    images
  } = req.body;

  if (!user_id || !title || !company || !career || !education || !images || !disability_requirements) {
    return res.status(400).json({ success: false, message: '필수 항목이 누락되었습니다.' });
  }

  try {
    const [result] = await db.query(`
      INSERT INTO job_post (
        user_id, title, company, location, deadline,
        career, education, detail, summary, working_conditions,
        disability_requirements, images
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      user_id,
      title,
      company,
      location,
      deadline,
      career,
      education,
      detail,
      summary,
      working_conditions,
      JSON.stringify(disability_requirements),
      JSON.stringify(images)
    ]);

    res.json({ success: true, id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 4. 채용공고 수정 (리팩토링 적용)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const {
    title,
    company,
    location,
    deadline,
    career,
    education,
    detail,
    summary,
    working_conditions,
    disability_requirements,
    images
  } = req.body;

  try {
    const [result] = await db.query(`
      UPDATE job_post SET
        title = ?, company = ?, location = ?, deadline = ?,
        career = ?, education = ?, detail = ?, summary = ?,
        working_conditions = ?, disability_requirements = ?, images = ?
      WHERE id = ?
    `, [
      title,
      company,
      location,
      deadline,
      career,
      education,
      detail,
      summary,
      working_conditions,
      JSON.stringify(disability_requirements),
      JSON.stringify(images),
      id
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "공고가 없습니다." });
    }

    res.json({ success: true, message: "수정되었습니다." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 5. 채용공고 삭제
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.query('DELETE FROM job_post WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "공고가 없습니다." });
    }

    res.json({ success: true, message: "삭제되었습니다." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 6. 추천 공고 (2개 이상 조건 일치 로직 적용)
router.get('/recommend/:userId', async (req, res) => {
  const userId = req.params.userId;

  try {
    const [[profile]] = await db.query('SELECT * FROM user_profile WHERE user_id = ?', [userId]);
    if (!profile) return res.status(404).json({ success: false, message: '회원 정보가 없습니다.' });

    const [jobs] = await db.query('SELECT * FROM job_post');
    const matched = jobs.filter(job => {
      const reqs = JSON.parse(job.disability_requirements || '{}');

      let matchCount = 0;

      if (reqs.disabilityGrade && reqs.disabilityGrade === profile.disability_grade) matchCount++;

      if (reqs.disabilityTypes) {
        const user = JSON.parse(profile.disability_types || '[]');
        if (reqs.disabilityTypes.some(r => user.includes(r))) matchCount++;
      }

      if (reqs.assistiveDevices) {
        const user = JSON.parse(profile.assistive_devices || '[]');
        if (reqs.assistiveDevices.some(r => user.includes(r))) matchCount++;
      }

      if (reqs.preferredWorkType) {
        const user = JSON.parse(profile.preferred_work_type || '[]');
        if (reqs.preferredWorkType.some(r => user.includes(r))) matchCount++;
      }

      if (reqs.jobInterest) {
        const user = JSON.parse(profile.job_interest || '[]');
        if (reqs.jobInterest.some(r => user.includes(r))) matchCount++;
      }

      return matchCount >= 2;
    });

    res.json(matched);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;