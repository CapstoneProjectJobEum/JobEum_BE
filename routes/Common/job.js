const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const db = require('../../db');

// --------------------
// Multer 설정
// --------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + ext);
  }
});
const upload = multer({ storage });

// --------------------
// 유틸 함수
// --------------------
const safeJsonParse = (input, defaultValue) => {
  try {
    if (typeof input === 'object') return input;
    return input ? JSON.parse(input) : defaultValue;
  } catch {
    return defaultValue;
  }
};

const formatDeadline = (dateStr) => {
  if (!dateStr || dateStr.length !== 8) return dateStr;
  return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
};

const safeStringify = (input) => {
  try {
    return typeof input === 'string' ? input : JSON.stringify(input);
  } catch {
    return null;
  }
};

// --------------------
// 1. 채용공고 목록 조회
// --------------------
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

// --------------------
// 2. 채용공고 상세 조회
// --------------------
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

// --------------------
// 3. 이미지 업로드
// --------------------
router.post('/upload-images', upload.array('images', 5), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ success: false, message: '파일이 없습니다.' });
  }
  const baseUrl = process.env.BASE_URL || 'http://localhost:4000';
  const imageUrls = req.files.map(file => `${baseUrl}/uploads/${file.filename}`);
  res.json({ success: true, imageUrls });
});

// --------------------
// 4. 채용공고 등록
// --------------------
router.post('/', async (req, res) => {
  const {
    user_id, title, company, location, deadline,
    career, education, detail, summary,
    working_conditions, disability_requirements, images
  } = req.body;

  if (!user_id || !title || !company || !career || !education) {
    return res.status(400).json({ success: false, message: '필수 항목이 누락되었습니다.' });
  }

  try {
    const [result] = await db.query(`
      INSERT INTO job_post 
      (user_id, title, company, location, deadline, career, education, detail, summary, working_conditions, disability_requirements, images)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      user_id, title, company, location, deadline, career, education,
      detail || null, summary || null,
      working_conditions || null,
      safeStringify(disability_requirements),
      safeStringify(images)
    ]);
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// --------------------
// 5. 채용공고 수정
// --------------------
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const {
    title, company, location, deadline,
    career, education, detail, summary,
    working_conditions, disability_requirements, images
  } = req.body;

  try {
    const [result] = await db.query(`
      UPDATE job_post SET
        title = ?, company = ?, location = ?, deadline = ?,
        career = ?, education = ?, detail = ?, summary = ?,
        working_conditions = ?, disability_requirements = ?, images = ?
      WHERE id = ?
    `, [
      title, company, location, deadline,
      career, education, detail || null, summary || null,
      working_conditions || null,
      safeStringify(disability_requirements),
      safeStringify(images),
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

// --------------------
// 6. 채용공고 삭제
// --------------------
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

// --------------------
// 7. 추천 공고
// --------------------
router.get('/recommend/:userId', async (req, res) => {
  const userId = req.params.userId;
  try {
    const [[profile]] = await db.query('SELECT * FROM user_profile WHERE user_id = ?', [userId]);
    if (!profile) return res.status(404).json({ success: false, message: '회원 정보가 없습니다.' });

    const [jobs] = await db.query('SELECT * FROM job_post');
    const matched = jobs.filter(job => {
      const reqs = safeJsonParse(job.disability_requirements, {});
      let score = 0;

      if (!reqs.disabilityGrade || reqs.disabilityGrade !== profile.disability_grade) return false;

      const userTypes = safeJsonParse(profile.disability_types, []);
      if (Array.isArray(reqs.disabilityTypes) && reqs.disabilityTypes.some(r => userTypes.includes(r))) score++;

      const userDevices = safeJsonParse(profile.assistive_devices, []);
      if (Array.isArray(reqs.assistiveDevices) && reqs.assistiveDevices.some(r => userDevices.includes(r))) score++;

      const userWorkTypes = safeJsonParse(profile.preferred_work_type, []);
      if (Array.isArray(reqs.preferredWorkType) && reqs.preferredWorkType.some(r => userWorkTypes.includes(r))) score++;

      const userInterests = safeJsonParse(profile.job_interest, []);
      if (Array.isArray(reqs.jobInterest) && reqs.jobInterest.some(r => userInterests.includes(r))) score++;

      return score >= 2;
    });

    const parsedJobs = matched.slice(0, 5).map(job => ({
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
