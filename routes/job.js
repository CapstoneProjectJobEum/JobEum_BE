const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const db = require('../db');

// multer 설정: uploads 폴더에 파일 저장
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // 폴더가 서버 루트에 있어야 함
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + ext);
  }
});
const upload = multer({ storage });

// 안전하게 JSON 파싱 (이미 객체면 그대로 반환)
const safeJsonParse = (input, defaultValue) => {
  try {
    if (typeof input === 'object') return input;
    return input ? JSON.parse(input) : defaultValue;
  } catch {
    return defaultValue;
  }
};

// "YYYYMMDD" → "YYYY-MM-DD" 포맷 변환
const formatDeadline = (dateStr) => {
  if (!dateStr || dateStr.length !== 8) return dateStr;
  return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
};

// 1. 채용공고 목록 조회
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM job_post ORDER BY id DESC');
    const jobs = rows.map(job => ({
      ...job,
      deadline: formatDeadline(job.deadline),
      images: safeJsonParse(job.images, []),
      working_conditions: job.working_conditions,
      disability_requirements: safeJsonParse(job.disability_requirements, null),
    }));
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 2. 채용공고 상세 조회
router.get('/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const [rows] = await db.query('SELECT * FROM job_post WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "공고가 없습니다" });
    }
    const job = rows[0];
    job.images = safeJsonParse(job.images, []);
    job.disability_requirements = safeJsonParse(job.disability_requirements, null);
    job.working_conditions = job.working_conditions;
    res.json(job);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. 이미지 업로드 API (최대 5개 파일)
router.post('/upload-images', upload.array('images', 5), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ success: false, message: '파일이 없습니다.' });
  }
  const baseUrl = process.env.BASE_URL || 'http://localhost:4000';
  const imageUrls = req.files.map(file => `${baseUrl}/uploads/${file.filename}`);
  res.json({ success: true, imageUrls });
});

// 4. 채용공고 등록
router.post('/', async (req, res) => {
  const {
    user_id,
    title, company, location, deadline,
    career, education, detail, summary,
    working_conditions,
    disability_requirements,
    images
  } = req.body;

  try {
    const [result] = await db.query(`
      INSERT INTO job_post
      (user_id, title, company, location, deadline, career, education, detail, summary, working_conditions, disability_requirements, images)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      user_id,
      title, company, location, deadline,
      career, education, detail, summary,
      working_conditions || null,
      disability_requirements ? JSON.stringify(disability_requirements) : null,
      images ? JSON.stringify(images) : null
    ]);
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 5. 채용공고 수정
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const {
    title, company, location, deadline,
    career, education, detail, summary,
    working_conditions,
    disability_requirements,
    images
  } = req.body;

  try {
    const [result] = await db.query(
      `UPDATE job_post
       SET title=?, company=?, location=?, deadline=?, career=?, education=?,
           detail=?, summary=?, working_conditions=?, disability_requirements=?, images=?
       WHERE id=?`,
      [
        title, company, location, deadline,
        career, education, detail, summary,
        working_conditions || null,
        disability_requirements ? JSON.stringify(disability_requirements) : null,
        images ? JSON.stringify(images) : null,
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

// 6. 채용공고 삭제
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.query('DELETE FROM job_post WHERE id=?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "공고가 없습니다." });
    }
    res.json({ success: true, message: "삭제되었습니다." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 7. 추천 공고 (예시)
router.get('/recommend/:userId', async (req, res) => {
  const userId = req.params.userId;
  try {
    const [[user]] = await db.query('SELECT * FROM user_profile WHERE user_id = ?', [userId]);
    if (!user) return res.status(404).json({ success: false, message: '회원 정보가 없습니다.' });

    const [jobs] = await db.query('SELECT * FROM job_post');
    const userInterests = user.job_interest ? user.job_interest.split(',').map(i => i.trim()) : [];

    const matchedJobs = jobs.filter(job => {
      const condition = safeJsonParse(job.disability_requirements, null);
      if (!condition || !Array.isArray(condition.jobInterest)) return false;
      const jobInterests = condition.jobInterest.map(i => i.trim());
      return jobInterests.some(interest => userInterests.includes(interest));
    });

    const parsedJobs = matchedJobs.slice(0, 5).map(job => ({
      ...job,
      images: safeJsonParse(job.images, []),
      working_conditions: job.working_conditions,
      disability_requirements: safeJsonParse(job.disability_requirements, null),
    }));

    res.json(parsedJobs);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
