const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const db = require('../../db');

// 채용공고(등록·수정·삭제·조회·추천·조건추가 포함) API

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

// 안전하게 JSON 문자열화(문자열이면 통과)
const safeStringify = (input) => {
  try {
    if (input === undefined || input === null) return null;
    return (typeof input === 'string') ? input : JSON.stringify(input);
  } catch {
    return null;
  }
};

// "YYYYMMDD" → "YYYY-MM-DD" 포맷 변환
const formatDeadline = (dateStr) => {
  if (!dateStr) return dateStr;
  const s = String(dateStr);
  if (s.length === 8 && /^\d{8}$/.test(s)) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }
  return s;
};

// 필수값 검사
const validateJobPayload = (body) => {
  const required = ['title', 'company', 'location', 'deadline', 'career', 'education', 'detail', 'summary'];
  const missing = required.filter(k => !String(body[k] ?? '').trim());
  if (missing.length) return `필수값 누락: ${missing.join(', ')}`;
  return null;
};

// 프론트 하위호환: personalized만 왔을 때 disability_requirements 채워주기
const deriveDisabilityReq = (disability_requirements, personalized) => {
  if (disability_requirements && Array.isArray(disability_requirements)) return disability_requirements;
  const p = safeJsonParse(personalized, null);
  if (p && Array.isArray(p.disabilityTypes)) return p.disabilityTypes;
  return null;
};

// 1) 이미지 업로드 API (최대 5개 파일)
router.post('/upload-images', upload.array('images', 5), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ success: false, message: '파일이 없습니다.' });
  }
  const baseUrl = process.env.BASE_URL || 'http://localhost:4000';
  const imageUrls = req.files.map(file => `${baseUrl}/uploads/${file.filename}`);
  res.json({ success: true, imageUrls });
});


// 2) 맞춤 추천 공고 2글자이상 (라우팅 충돌 방지를 위해 :id 보다 먼저 선언!)
router.get('/recommend/:userId', async (req, res) => {
  const userId = req.params.userId;

  try {
    const [[profile]] = await db.query('SELECT * FROM user_profile WHERE user_id = ?', [userId]);
    if (!profile) {
      return res.status(404).json({ success: false, message: '회원 정보가 없습니다.' });
    }

    const [jobs] = await db.query('SELECT * FROM job_post');

    const matched = jobs.filter(job => {
      const reqs = safeJsonParse(job.disability_requirements, {});
      const pers = safeJsonParse(job.personalized, {});

      const requireGrade = pers.disabilityGrade || reqs.disabilityGrade;
      if (!requireGrade || requireGrade !== profile.disability_grade) {
        return false;
      }

      let score = 0;

      const hit = (a, b) => {
        const A = Array.isArray(a) ? a : safeJsonParse(a, []);
        const B = Array.isArray(b) ? b : safeJsonParse(b, []);
        return A.some(v => B.includes(v));
      };

      // 1) 장애 유형
      const reqTypes = pers.disabilityTypes || reqs.disabilityTypes;
      const userTypes = safeJsonParse(profile.disability_types, []);
      if (hit(reqTypes, userTypes)) score++;

      // 2) 보조기기
      const reqDevices = pers.assistiveDevices || reqs.assistiveDevices;
      const userDevices = safeJsonParse(profile.assistive_devices, []);
      if (hit(reqDevices, userDevices)) score++;

      // 3) 선호 근무형태
      const reqWorkType = pers.preferredWorkType || reqs.preferredWorkType;
      const userWorkType = safeJsonParse(profile.preferred_work_type, []);
      if (hit(reqWorkType, userWorkType)) score++;

      // 4) 관심 직무
      const reqInterest = pers.jobInterest || reqs.jobInterest;
      const userInterest = safeJsonParse(profile.job_interest, []);
      if (hit(reqInterest, userInterest)) score++;

      // 4개 중 2개 이상 일치해야 추천됨
      return score >= 2;
    });

    res.json(matched);
  } catch (err) {
    console.error('GET /jobs/recommend/:userId 오류:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3) 채용공고 목록 조회
router.get('/', async (req, res) => {
  try {
    const { companyId } = req.query;

    if (companyId) {
      const [rows] = await db.query('SELECT * FROM job_post WHERE user_id = ? ORDER BY id DESC', [companyId]);
      const jobs = rows.map(job => ({
        ...job,
        deadline: formatDeadline(job.deadline),
        images: safeJsonParse(job.images, []),
        working_conditions: job.working_conditions,
        disability_requirements: safeJsonParse(job.disability_requirements, null),
        filters: safeJsonParse(job.filters, null),
        personalized: safeJsonParse(job.personalized, null),
      }));
      return res.json(jobs);
    }

    const [rows] = await db.query('SELECT * FROM job_post ORDER BY id DESC');
    const jobs = rows.map(job => ({
      ...job,
      deadline: formatDeadline(job.deadline),
      images: safeJsonParse(job.images, []),
      working_conditions: job.working_conditions,
      disability_requirements: safeJsonParse(job.disability_requirements, null),
      filters: safeJsonParse(job.filters, null),
      personalized: safeJsonParse(job.personalized, null),
    }));
    res.json(jobs);
  } catch (err) {
    console.error('GET /jobs 오류:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 4) 채용공고 상세 조회
router.get('/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const [rows] = await db.query('SELECT * FROM job_post WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "공고가 없습니다" });
    }
    const job = rows[0];
    job.deadline = formatDeadline(job.deadline);
    job.images = safeJsonParse(job.images, []);
    job.disability_requirements = safeJsonParse(job.disability_requirements, null);
    job.filters = safeJsonParse(job.filters, null);
    job.personalized = safeJsonParse(job.personalized, null);
    job.working_conditions = job.working_conditions;
    res.json(job);
  } catch (err) {
    console.error('GET /jobs/:id 오류:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 5) 채용공고 등록 (기업회원용)
router.post('/', async (req, res) => {
  const {
    user_id,
    title, company, location, deadline,
    career, education, detail, summary,
    working_conditions,
    disability_requirements, // array|null (하위호환)
    images,                  // array|null
    filters,                 // object|null (고용형태/지역/직무/회사유형 등)
    personalized             // object|null (장애유형/등급/보조기기/직무관심/근무형태)
  } = req.body;

  try {
    const err = validateJobPayload(req.body);
    if (err) return res.status(400).json({ success: false, message: err });

    // personalized만 왔을 경우 하위호환 컬럼 채움
    const effectiveDisabilityReq = deriveDisabilityReq(disability_requirements, personalized);

    const [result] = await db.query(`
      INSERT INTO job_post
      (user_id, title, company, location, deadline, career, education, detail, summary,
       working_conditions, disability_requirements, images, filters, personalized)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      user_id,
      title, company, location, deadline,
      career, education, detail, summary,
      working_conditions || null,
      safeStringify(effectiveDisabilityReq),
      safeStringify(images),
      safeStringify(filters),
      safeStringify(personalized),
    ]);

    res.json({ success: true, id: result.insertId });
  } catch (err) {
    console.error('POST /jobs 오류:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 6) 채용공고 수정 (기업회원용)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const {
    title, company, location, deadline,
    career, education, detail, summary,
    working_conditions,
    disability_requirements,
    images,
    filters,
    personalized
  } = req.body;

  try {
    const err = validateJobPayload({
      title, company, location, deadline, career, education, detail, summary
    });
    if (err) return res.status(400).json({ success: false, message: err });

    const effectiveDisabilityReq = deriveDisabilityReq(disability_requirements, personalized);

    const [result] = await db.query(
      `UPDATE job_post
         SET title=?, company=?, location=?, deadline=?, career=?, education=?,
             detail=?, summary=?, working_conditions=?,
             disability_requirements=?, images=?, filters=?, personalized=?
       WHERE id=?`,
      [
        title, company, location, deadline,
        career, education, detail, summary,
        working_conditions || null,
        safeStringify(effectiveDisabilityReq),
        safeStringify(images),
        safeStringify(filters),
        safeStringify(personalized),
        id
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "공고가 없습니다." });
    }
    res.json({ success: true, message: "수정되었습니다." });
  } catch (err) {
    console.error('PUT /jobs/:id 오류:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 7) 채용공고 삭제
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.query('DELETE FROM job_post WHERE id=?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "공고가 없습니다." });
    }
    res.json({ success: true, message: "삭제되었습니다." });
  } catch (err) {
    console.error('DELETE /jobs/:id 오류:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;