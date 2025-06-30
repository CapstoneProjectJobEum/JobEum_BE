// 메인페이지
// routes/job.js
const express = require('express');
const router = express.Router();
const db = require('../db');

// ✅ 1. 채용공고 목록
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM job_post ORDER BY id DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ✅ 2. 채용공고 상세
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

// ✅ 3. [추가] 채용공고 등록 (POST /api/jobs)
router.post('/', async (req, res) => {
  const {
    title, company, location, deadline,
    career, education, detail, summary, condition, jobConditions,
  } = req.body;

  try {
    const [result] = await db.query(`
      INSERT INTO job_post 
      (title, company, location, deadline, career, education, detail, summary, \`condition\`, job_conditions)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      title, company, location, deadline, career, education,
      detail, summary, condition,
      jobConditions,
    ]);
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ✅ 4. 추천 공고 필터링 API
router.get('/recommend/:userId', async (req, res) => {
  const userId = req.params.userId;

  try {
    const [[user]] = await db.query('SELECT * FROM user_profile WHERE id = ?', [userId]);
    if (!user) return res.status(404).json({ success: false, message: '회원 정보가 없습니다.' });

    const [jobs] = await db.query('SELECT * FROM job_post');
    const userInterests = user.job_interest.split(',').map(i => i.trim());

    console.log('🟦 유저 관심사:', userInterests);

    const matchedJobs = jobs.filter(job => {
      if (!job.job_conditions) return false;

      try {
        const condition = JSON.parse(job.job_conditions);
        if (!condition.jobInterest) return false;

        const jobInterests = condition.jobInterest.map(i => i.trim());

        console.log(`\n🔷 공고 ID: ${job.id}`);
        console.log('📄 공고 관심사:', jobInterests);

        const hasMatch = jobInterests.some(interest => userInterests.includes(interest));

        console.log('✅ 매칭 여부:', hasMatch);
        return hasMatch;
      } catch (err) {
        console.log('❌ JSON 파싱 실패:', err.message);
        return false;
      }
    });

    res.json(matchedJobs.slice(0, 5));
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


module.exports = router;
