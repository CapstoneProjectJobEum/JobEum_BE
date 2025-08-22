const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const db = require('../../db');
const { createBulkNotifications } = require('./services/notificationService');

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
  if (!dateStr || dateStr.length !== 8) return dateStr;
  return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
};

// 필수값 검사
const validateJobPayload = (body) => {
  const required = ['title', 'company', 'location', 'deadline', 'detail', 'summary'];
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

// 1. 채용공고 목록 조회
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
    detail, summary,
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
      (user_id, title, company, location, deadline, detail, summary,
       working_conditions, disability_requirements, images, filters, personalized)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      user_id,
      title, company, location, deadline,
      detail, summary,
      working_conditions || null,
      safeStringify(effectiveDisabilityReq),
      safeStringify(images),
      safeStringify(filters),
      safeStringify(personalized),
    ]);

    // [추가] 관심 기업 팔로워에게 “신규 공고” 알림 생성 + 실시간 송신 
    const io = req.app.get('io');
    const jobPostId = result.insertId;

    // followers 찾기: user_favorite_company.company_id = 공고 게시자의 user_id
    const [followers] = await db.query(
      `SELECT ufc.user_id
         FROM user_favorite_company ufc
        WHERE ufc.company_id = ?`,
      [user_id]
    );

    if (followers.length) {
      const rows = followers.map(f => ({
        userId: f.user_id,
        type: 'NEW_JOB_FROM_FAVORITE_COMPANY',
        title: '관심 기업의 새 채용공고',
        message: `[${company}] '${title}' 공고가 등록되었습니다.`,
        // 메타데이터는 프론트에서 상세 이동에 활용
        metadata: {
          job_post_id: jobPostId,
          company_id: user_id,   // 회사(계정) user_id
          company_name: company, // 회사명(문자열)
          title
        }
      }));
      await createBulkNotifications(io, rows);
    }

    res.json({ success: true, id: result.insertId });
  } catch (err) {
    console.error('POST /jobs 오류:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 5. 채용공고 수정
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const {
    title, company, location, deadline,
    detail, summary,
    working_conditions,
    disability_requirements,
    images,
    filters,
    personalized
  } = req.body;

  try {
    const err = validateJobPayload({
      title, company, location, deadline, detail, summary
    });
    if (err) return res.status(400).json({ success: false, message: err });

    const effectiveDisabilityReq = deriveDisabilityReq(disability_requirements, personalized);

    const [result] = await db.query(
      `UPDATE job_post
         SET title=?, company=?, location=?, deadline=?, 
             detail=?, summary=?, working_conditions=?,
             disability_requirements=?, images=?, filters=?, personalized=?
       WHERE id=?`,
      [
        title, company, location, deadline,
        detail, summary,
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
      const reqs = safeJsonParse(job.disability_requirements, {});
      const pers = safeJsonParse(job.personalized, {});


      const requireGrade = pers.disabilityGrade || reqs.disabilityGrade;
      const requiredGrades = Array.isArray(requireGrade) ? requireGrade : [requireGrade];

      if (!requiredGrades.includes(profile.disability_grade)) return false;

      let score = 0;

      const hit = (a, b) => {
        const A = Array.isArray(a) ? a : safeJsonParse(a, []);
        const B = Array.isArray(b) ? b : safeJsonParse(b, []);
        return A.some(v => B.includes(v));
      };

      // 문자열 필드를 배열로 변환
      const userTypes = profile.disability_types.split(',').map(s => s.trim());
      const userDevices = profile.assistive_devices.split(',').map(s => s.trim());
      const userWorkType = profile.preferred_work_type.split(',').map(s => s.trim());
      const userInterest = profile.job_interest.split(',').map(s => s.trim());

      // 1) 장애 유형
      const reqTypes = pers.disabilityTypes || reqs.disabilityTypes;
      if (hit(reqTypes, userTypes)) score++;

      // 2) 보조기기
      const reqDevices = pers.assistiveDevices || reqs.assistiveDevices;
      if (hit(reqDevices, userDevices)) score++;

      // 3) 선호 근무형태
      const reqWorkType = pers.preferredWorkType || reqs.preferredWorkType;
      if (hit(reqWorkType, userWorkType)) score++;

      // 4) 관심 직무
      const reqInterest = pers.jobInterest || reqs.jobInterest;
      if (hit(reqInterest, userInterest)) score++;


      return score >= 2;
    });


    res.json(matched);
  } catch (err) {
    console.error('GET /jobs/recommend/:userId 오류:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});



module.exports = router;