const express = require('express');
const router = express.Router();
const db = require('../../db'); // MySQL 연결
const { createNotification } = require('./services/notificationService');

// 알림 서비스 (DB 저장 + 실시간 소켓 전송)
const { createNotification } = require('./services/notificationService');

// 개인회원 - 지원하기 (+ 지원 접수 알림) + 기업회원 - 새 지원서 접수 알림
router.post('/apply', async (req, res) => {
  const { user_id, job_id, resume_id } = req.body;

  try {
    // 중복 지원 방지
    const [existing] = await db.query(
      `SELECT * FROM applications WHERE user_id = ? AND job_id = ? AND resume_id = ?`,
      [user_id, job_id, resume_id]
    );
    if (existing.length > 0) {
      return res.status(400).json({ message: '이미 지원한 이력서입니다.' });
    }

    // 기본 상태 '서류 심사중'으로 지원 등록
    await db.query(
      `INSERT INTO applications (user_id, job_id, resume_id, status, is_viewed) 
       VALUES (?, ?, ?, '서류 심사중', 0)`,
      [user_id, job_id, resume_id]
    );

    // 지원 접수 알림 트리거(개인회원) 
    try {
      const io = req.app.get('io'); // app.js에서 app.set('io', io) 필요
      const [[job]] = await db.query(
        `SELECT title AS job_title, company AS company_name 
           FROM job_post 
          WHERE id = ? 
          LIMIT 1`,
        [job_id]
      );

      await createNotification(io, {
        userId: user_id,
        type: 'APPLICATION_STATUS_UPDATE',
        title: '지원 접수 완료',
        message: `[${job?.company_name ?? '회사'}] '${job?.job_title ?? '공고'}' 지원이 접수되었습니다.`,
        metadata: { job_post_id: job_id, status: '지원완료' }
      });
    } catch (notifyErr) {
      console.error('[notify] apply submit notification error:', notifyErr);
      }
      
    // 내 공고에 새 지원서 접수 알림 (기업회원) 
    try {
      const io = req.app.get('io');
      const [[owner]] = await db.query(
        `SELECT jp.user_id AS company_user_id, jp.title AS job_title, jp.company AS company_name
           FROM job_post jp
          WHERE jp.id = ?
          LIMIT 1`,
        [job_id]
      );

      if (owner) {
        await createNotification(io, {
          userId: owner.company_user_id, // 기업회원 user_id
          type: 'EMP_APPLICATION_RECEIVED',
          title: '새 지원서 접수',
          message: `[${owner.company_name}] '${owner.job_title}' 공고에 새 지원서가 접수되었습니다.`,
          metadata: { job_post_id: job_id, resume_id, applicant_user_id: user_id }
        });
      }
    } catch (notifyErr) {
      console.error('[notify] apply submit (employer) notification error:', notifyErr);
    }

    res.json({ message: '지원이 완료되었습니다.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '지원 처리 중 오류 발생' });
  }
});

// 개인회원 - 지원취소
router.delete('/cancel/:applicationId', async (req, res) => {
  const { applicationId } = req.params;

  try {
    const [app] = await db.query(
      `SELECT * FROM applications WHERE id = ?`,
      [applicationId]
    );

    if (app.length === 0) {
      return res.status(404).json({ message: '해당 지원 내역이 없습니다.' });
    }

    if (app[0].is_viewed === 1) {
      return res.status(403).json({ message: '기업이 열람한 지원서는 취소할 수 없습니다.' });
    }

    await db.query(`DELETE FROM applications WHERE id = ?`, [applicationId]);
    res.json({ message: '지원이 취소되었습니다.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '지원 취소 중 오류 발생' });
  }
});

// 개인회원 - 내 지원현황 조회
router.get('/my-applications/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const [rows] = await db.query(
      `SELECT a.id, a.job_id, a.resume_id, a.status, a.is_viewed, a.applied_at, j.title as job_title
         FROM applications a
         JOIN job_post j ON a.job_id = j.id
        WHERE a.user_id = ?`,
      [userId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '지원 현황 조회 실패' });
  }
});

// 기업회원 - 지원서 열람 처리
router.put('/view/:applicationId', async (req, res) => {
  const { applicationId } = req.params;

  try {
    await db.query(
      `UPDATE applications SET is_viewed = 1 WHERE id = ?`,
      [applicationId]
    );
    res.json({ message: '지원서 열람 처리 완료 (취소 불가 상태)' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '열람 처리 중 오류 발생' });
  }
});

// 기업회원 - 지원 상태 변경 (+ 상태 변경 알림)
router.put('/status', async (req, res) => {
  const { user_id, resume_id, job_id, status } = req.body;

  const allowedStatus = ['서류 심사중', '1차 합격', '면접 예정', '최종 합격', '불합격'];
  if (!allowedStatus.includes(status)) {
    return res.status(400).json({ message: '잘못된 상태 값입니다.' });
  }

  try {
    // 1) 상태 업데이트
    const [result] = await db.query(
      `UPDATE applications 
          SET status = ? 
        WHERE user_id = ? AND resume_id = ? AND job_id = ?`,
      [status, user_id, resume_id, job_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: '해당 지원서가 존재하지 않습니다.' });
    }

    // 2) 알림에 필요한 상세정보 조회(지원자/공고제목/회사명)
    const [[info]] = await db.query(
      `SELECT a.user_id,
              a.job_id,
              jp.title   AS job_title,
              jp.company AS company_name
         FROM applications a
         JOIN job_post jp ON jp.id = a.job_id
        WHERE a.user_id = ? AND a.resume_id = ? AND a.job_id = ?
        LIMIT 1`,
      [user_id, resume_id, job_id]
    );

    // 3) 실시간 + DB 알림 트리거
    if (info) {
      try {
        const io = req.app.get('io'); // app.js에 app.set('io', io) 필요
        await createNotification(io, {
          userId: info.user_id,
          type: 'APPLICATION_STATUS_UPDATE',
          title: '지원현황 변경',
          message: `[${info.company_name}] '${info.job_title}' 지원 상태가 '${status}'(으)로 변경되었습니다.`,
          metadata: { application_id: null, job_post_id: info.job_id, status }
        });
      } catch (notifyErr) {
        console.error('[notify] status change notification error:', notifyErr);
        // 알림 실패는 상태변경 자체를 롤백하지 않음
      }
    }

    res.json({ message: '지원 상태가 변경되었습니다.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '지원 상태 변경 중 오류 발생' });
  }
});

// 기업회원 - 전체 지원현황 조회
router.get('/all', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT a.id, a.user_id, u.name as applicant_name, 
              a.job_id, j.title as job_title, j.deadline,
              a.resume_id, r.title as resume_title, 
              a.status, a.is_viewed, a.applied_at
         FROM applications a
         JOIN users   u ON a.user_id = u.id
         JOIN job_post j ON a.job_id = j.id
         JOIN resumes r ON a.resume_id = r.id
        ORDER BY a.applied_at DESC`
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '전체 지원현황 조회 실패' });
  }
});

// 개별 공고 지원 상태 조회 (JobCard용)
router.get('/status/:job_id', async (req, res) => {
  const { job_id } = req.params;
  const user_id = req.user?.id; // attachUser 미들웨어가 req.user 주입

  try {
    const [rows] = await db.query(
      `SELECT a.status, a.is_viewed
         FROM applications a
        WHERE a.job_id = ? AND a.user_id = ?
        LIMIT 1`,
      [job_id, user_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: '지원 기록 없음' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '지원 상태 조회 실패' });
  }
});

// 개인회원 / 기업회원 - 단일 지원서 조회 (상세 화면용)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.query(
      `SELECT a.id, a.job_id, a.resume_id, a.status, a.user_id,
              r.*
         FROM applications a
         JOIN resumes r ON a.resume_id = r.id
        WHERE a.id = ?`,
      [id]
    );

    if (!rows[0]) {
      return res.status(404).json({ message: '지원서가 존재하지 않습니다.' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '지원서 조회 중 오류 발생' });
  }
});

module.exports = router;