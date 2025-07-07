// routes/job.js
const express = require('express');
const router = express.Router();
const db = require('../db');

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

// 3. 채용공고 등록 (POST)
router.post('/', async (req, res) => {
  const {
    title, company, location, deadline,
    career, education, detail, summary,
    condition, jobConditions, image
  } = req.body;

  try {
    const [result] = await db.query(`
      INSERT INTO job_post 
      (title, company, location, deadline, career, education, detail, summary, job_condition, job_conditions, image)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      title, company, location, deadline,
      career, education, detail, summary,
      condition,
      jobConditions ? JSON.stringify(jobConditions) : null,
      image || null
    ]);

    res.json({ success: true, id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 4. 채용공고 수정(PUT) 
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const {
    title, company, location, deadline,
    career, education, detail, summary,
    condition, jobConditions, image
  } = req.body;

  try {
    const [result] = await db.query(
      `UPDATE job_post
       SET title=?, company=?, location=?, deadline=?, career=?, education=?,
           detail=?, summary=?, job_condition=?, job_conditions=?, image=?
       WHERE id=?`,
      [
        title, company, location, deadline,
        career, education, detail, summary,
        condition,
        jobConditions ? JSON.stringify(jobConditions) : null,
        image || null,
        id
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "공고가 없습니다." });
    }

    res.json({ success: true, message: "수정되었습니다." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 5. 채용공고 삭제 (DELETE)
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await db.query(
      'DELETE FROM job_post WHERE id=?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "공고가 없습니다." });
    }

    res.json({ success: true, message: "삭제되었습니다." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 6. 추천 공고 (추후 기능 완성시 사용)
router.get('/recommend/:userId', async (req, res) => {
  const userId = req.params.userId;

  try {
    const [[user]] = await db.query('SELECT * FROM user_profile WHERE id = ?', [userId]);
    if (!user) return res.status(404).json({ success: false, message: '회원 정보가 없습니다.' });

    const [jobs] = await db.query('SELECT * FROM job_post');
    const userInterests = user.job_interest.split(',').map(i => i.trim());

    const matchedJobs = jobs.filter(job => {
      if (!job.job_conditions) return false;

      try {
        const condition = JSON.parse(job.job_conditions);
        if (!condition.jobInterest) return false;

        const jobInterests = condition.jobInterest.map(i => i.trim());
        return jobInterests.some(interest => userInterests.includes(interest));
      } catch (err) {
        return false;
      }
    });

    res.json(matchedJobs.slice(0, 5));
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
