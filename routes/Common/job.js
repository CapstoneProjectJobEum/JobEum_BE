const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const db = require('../../db');

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
  console.log('[DEBUG] job_post update id:', id);
  const {
    title, company, location, deadline,
    career, education, detail, summary,
    working_conditions,
    disability_requirements,
    images
  } = req.body;

  const safeStringify = (input) => {
    try {
      return typeof input === 'string' ? input : JSON.stringify(input);
    } catch {
      return null;
    }
  };

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
        safeStringify(disability_requirements),
        safeStringify(images),
        id
      ]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "공고가 없습니다." });
    }
    res.json({ success: true, message: "수정되었습니다." });
  } catch (err) {
    console.error('PUT /job_post/:id 오류:', err); // 🔥 꼭 로그 찍기
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

// 7. 맞춤 추천 공고 (disabilityGrade 일치 + 4개 중 2점 이상)
router.get('/recommend/:userId', async (req, res) => {
  const userId = req.params.userId;

  try {
    const [[profile]] = await db.query('SELECT * FROM user_profile WHERE user_id = ?', [userId]);
    if (!profile) {
      return res.status(404).json({ success: false, message: '회원 정보가 없습니다.' });
    }

    const [jobs] = await db.query('SELECT * FROM job_post');
    const matched = jobs.filter(job => {
      const reqs = JSON.parse(job.disability_requirements || '{}');

      // 1. 장애등급이 일치하지 않으면 무조건 제외
      if (!reqs.disabilityGrade || reqs.disabilityGrade !== profile.disability_grade) {
        return false;
      }

      let score = 0;

      // 2. 장애 유형
      if (Array.isArray(reqs.disabilityTypes)) {
        const user = JSON.parse(profile.disability_types || '[]');
        if (reqs.disabilityTypes.some(r => user.includes(r))) score++;
      }

      // 3. 보조기기
      if (Array.isArray(reqs.assistiveDevices)) {
        const user = JSON.parse(profile.assistive_devices || '[]');
        if (reqs.assistiveDevices.some(r => user.includes(r))) score++;
      }

      // 4. 선호 근무형태
      if (Array.isArray(reqs.preferredWorkType)) {
        const user = JSON.parse(profile.preferred_work_type || '[]');
        if (reqs.preferredWorkType.some(r => user.includes(r))) score++;
      }

      // 5. 관심 직무
      if (Array.isArray(reqs.jobInterest)) {
        const user = JSON.parse(profile.job_interest || '[]');
        if (reqs.jobInterest.some(r => user.includes(r))) score++;
      }

      // 4개 중 2개 이상 일치해야 추천됨
      return score >= 2;
    });

    res.json(matched);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;