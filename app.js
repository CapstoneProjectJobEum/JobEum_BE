require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');
const db = require('./db');

// ===== Admin =====
const adminRouter = require('./routes/Admin/admin');
const createAdminIfNotExists = require('./routes/Admin/createAdminIfNotExists');

// ===== AI ===== 
const { router: applicationRecommendationsRouter, generateApplicationRecommendations } = require('./routes/AI/applicationsRecommendations');
const { router: jobRecommendationsRouter, generateRecommendationsForUser } = require('./routes/AI/jobRecommendations');
const { router: jobSummaryRouter, createSummaryForJob } = require('./routes/AI/jobSummary');
const { router: resumeReviewSummaryRouter, createResumeReviewSummary } = require('./routes/AI/resumeReviewSummary');
const { router: resumeSummaryRouter, createSummaryForResume } = require('./routes/AI/resumeSummary');

// ===== Auth =====
const checkDuplicateRoutes = require('./routes/Auth/checkDuplicate');
const checkUserRouter = require('./routes/Auth/checkUser');
const findIdRouter = require('./routes/Auth/findId');
const loginRouter = require('./routes/Auth/login');
const passwordRouter = require('./routes/Auth/password');
const sendCodeRouter = require('./routes/Auth/sendCode');
const signupRouter = require('./routes/Auth/signup');
const socialAuthRoutes = require('./routes/Auth/socialAuth');
const verifyCodeRouter = require('./routes/Auth/verifyCode');
const withDrawRoutes = require('./routes/Auth/withDraw');

// ===== Category =====
const categoryRouter = require('./routes/Category/category');

// ===== Common =====
const accountInfoRouter = require('./routes/Common/accountInfo');
const jobRouter = require('./routes/Common/job');

// ===== Company =====
const companyRoutes = require('./routes/Company/company');
const companyProfileRouter = require('./routes/Company/companyProfile');


// ===== Inquiry_Report =====
const inquiryRouter = require('./routes/Inquiry_Report/inquiry');
const reportRouter = require('./routes/Inquiry_Report/report');

// ===== Middleware =====
const attachUser = require('./routes/Middleware/jwt');
const { requireAuth, requireRole } = require('./routes/Middleware/auth');

// ===== Search =====
const searchRouter = require('./routes/Search/search');

// ===== User =====
const userProfileRouter = require('./routes/User/userProfile');
const resumesRouter = require('./routes/User/resumes');
const applicationsRouter = require('./routes/User/applications');
const userActivityRouter = require('./routes/User/userActivity');

// ===== Notifications (REST + socket.io) =====
const notificationRouter = require('./routes/Notification/notification');
const { runFavoriteDeadlineJob } = require('./routes/Jobs/notifyFavoriteJobDeadline');
const { runCompanyDeadlineJob } = require('./routes/Jobs/notifyCompanyJobDeadline');

// ===== socket.io 준비 =====
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

// ===== 앱 생성 =====
const app = express();

// 공통 미들웨어
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(attachUser);

// ===== 라우팅 =====
// Admin
app.use('/api/admin', requireAuth, requireRole('ADMIN'), adminRouter);

// AI
app.use('/api/application-recommendations', requireAuth, applicationRecommendationsRouter);
app.use('/api/users', requireAuth, jobRecommendationsRouter);
app.use('/api/jobs/summary', requireAuth, jobSummaryRouter);
app.use('/api/resumes/reviewSummary', requireAuth, resumeReviewSummaryRouter);
app.use('/api/resumes/summary', requireAuth, resumeSummaryRouter);

// Auth
app.use('/api', checkDuplicateRoutes);
app.use('/api', checkUserRouter);
app.use('/api', findIdRouter);
app.use('/api', loginRouter);
app.use('/api', passwordRouter);
app.use('/api', sendCodeRouter.router);
app.use('/api', signupRouter);
app.use('/api', socialAuthRoutes);
app.use('/api', verifyCodeRouter);
app.use('/api', withDrawRoutes);

// Category
app.use('/api/category', categoryRouter);

// Common
app.use('/api/account-info', requireAuth, accountInfoRouter);
app.use('/api/jobs', jobRouter);

// Company
app.use('/api/companies', requireAuth, companyRoutes);
app.use('/api/company-profile', requireAuth, companyProfileRouter);

// Inquiry_Report
app.use('/api/inquiries', requireAuth, inquiryRouter);
app.use('/api/reports', requireAuth, reportRouter);

// Search
app.use('/api/search', searchRouter);

// User
app.use('/api/user-profile', requireAuth, userProfileRouter);
app.use('/api/resumes', requireAuth, resumesRouter);
app.use('/api/applications', requireAuth, applicationsRouter);
app.use('/api/user-activity', requireAuth, userActivityRouter);


// Notifications REST
app.use('/api/notifications', notificationRouter);

// ===== HTTP 서버 + socket.io =====
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PATCH'] }
});

// 소켓 인증(JWT)
io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token) return next(new Error('no token'));
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = { id: payload.id };
    return next();
  } catch {
    return next(new Error('invalid token'));
  }
});

// 유저별 룸 입장
io.on('connection', (socket) => {
  socket.join(`user:${socket.user.id}`);
  console.log(`[소켓] 사용자 접속: ID=${socket.user.id}`);

  socket.on('disconnect', () => {
    console.log(`[소켓] 사용자 접속 종료: ID=${socket.user.id}`);
  });
});

// 라우터/서비스에서 io 사용 가능
app.set('io', io);

// ===== CRON 1) 자정: 마감 공고 inactive 처리 =====
cron.schedule('0 0 * * *', async () => {
  try {
    await db.query(`
      UPDATE job_post
      SET status = 'inactive'
      WHERE STR_TO_DATE(deadline, '%Y-%m-%d') < CURDATE()
        AND status = 'active'
    `);
    console.log('[CRON] 마감 공고 자동 비활성화 완료');
  } catch (err) {
    console.error('[CRON] 자동 비활성화 오류:', err.message);
  }
}, { timezone: 'Asia/Seoul' });

// ===== CRON 2) 09:00: 관심 공고 마감 임박 알림(D-7/D-1/D-0) =====
cron.schedule('0 9 * * *', async () => {
  try {
    const io = app.get('io');
    await runFavoriteDeadlineJob(io);
    console.log('[CRON] 관심 공고 마감 임박 알림 전송 완료');
  } catch (e) {
    console.error('[CRON] 관심 공고 알림 오류:', e);
  }
}, { timezone: 'Asia/Seoul' });

// ===== CRON 3) 09:02: 기업 공고 마감 임박 알림(D-7/D-1/D-0)(기업) =====
cron.schedule('2 9 * * *', async () => {
  try {
    const io = app.get('io');
    await runCompanyDeadlineJob(io);
    console.log('[CRON] 기업 공고 마감 임박 알림 전송 완료');
  } catch (e) {
    console.error('[CRON] 기업 공고 알림 오류:', e);
  }
}, { timezone: 'Asia/Seoul' });

// **새로 추가할 함수**: 아직 요약되지 않은 공고를 찾아 요약본을 생성하고 저장
const runAutomaticSummary = async () => {
  try {
    // **수정된 쿼리**: job_summaries 테이블에 없는 공고 ID를 찾음
    const [jobsToSummarize] = await db.query(`
      SELECT id FROM job_post
      WHERE id NOT IN (SELECT job_post_id FROM job_summaries)
    `);

    console.log(`[자동 요약] 총 ${jobsToSummarize.length}개의 요약되지 않은 공고를 찾았습니다.`);

    for (const job of jobsToSummarize) {
      await createSummaryForJob(job.id);
    }

    console.log('[자동 요약] 모든 요약 작업이 완료되었습니다.');
  } catch (err) {
    console.error('[자동 요약] 오류:', err);
  }
};

// **새로 추가할 함수**: 아직 요약되지 않은 이력서를 찾아 요약본을 생성하고 저장
const runAutomaticResumeSummary = async () => {
  try {
    // **수정된 쿼리**: resume_summaries 테이블에 없는 이력서 ID를 찾음
    const [resumesToSummarize] = await db.query(`
          SELECT id FROM resumes
          WHERE id NOT IN (SELECT resume_id FROM resumes_summaries)
        `);

    console.log(`[자동 이력서 요약] 총 ${resumesToSummarize.length}개의 요약되지 않은 이력서를 찾았습니다.`);

    for (const resume of resumesToSummarize) {
      await createSummaryForResume(resume.id);
    }

    console.log('[자동 이력서 요약] 모든 요약 작업이 완료되었습니다.');
  } catch (err) {
    console.error('[자동 이력서 요약] 오류:', err);
  }
};

// **새로 추가할 함수**: 아직 첨삭되지 않은 이력서를 찾아 첨삭 요약본을 생성하고 저장
const runAutomaticResumeReviewSummary = async () => {
  try {
    // resumes_review_summaries 테이블에 없는 이력서 ID를 찾음
    const [resumesToEdit] = await db.query(`
      SELECT id FROM resumes
      WHERE id NOT IN (SELECT resume_id FROM resumes_review_summaries)
    `);

    console.log(`[자동 자기소개서 첨삭] 총 ${resumesToEdit.length}개의 첨삭되지 않은 이력서를 찾았습니다.`);

    for (const resume of resumesToEdit) {
      await createResumeReviewSummary(resume.id);
    }

    console.log('[자동 자기소개서 첨삭] 모든 첨삭 작업이 완료되었습니다.');
  } catch (err) {
    console.error('[자동 자기소개서 첨삭] 오류:', err);
  }
};

const runAutomaticRecommendations = async () => {
  try {
    // user_profile 테이블에 존재하는 사용자의 ID만 조회
    const [users] = await db.query('SELECT user_id AS id FROM user_profile');

    console.log(`[추천 생성] 총 ${users.length}명의 개인 회원에 대한 추천을 생성합니다.`);

    for (const user of users) {
      // user_recommendations 테이블에 해당 유저의 데이터가 있는지 확인
      const [existingRecs] = await db.query(
        'SELECT COUNT(*) AS count FROM user_recommendations WHERE user_id = ?',
        [user.id]
      );

      if (existingRecs[0].count > 0) {
        console.log(`[추천 생성] 사용자 ID ${user.id}의 추천 목록이 이미 존재합니다. 건너뜁니다.`);
        continue; // 다음 사용자로 넘어갑니다.
      }

      await generateRecommendationsForUser(user.id);
    }

    console.log('[추천 생성] 모든 개인 회원 추천이 완료되었습니다.');
  } catch (err) {
    console.error('[추천 생성] 오류:', err);
  }
};

const runAutomaticApplicationRecommendations = async () => {
  try {
    // user_profile 테이블에서 존재하는 사용자 ID 조회
    const [users] = await db.query('SELECT user_id AS id FROM user_profile');

    console.log(`[추천 생성] 총 ${users.length}명의 개인 회원에 대한 추천을 생성합니다.`);

    for (const user of users) {
      // 이미 추천이 있는지 확인
      const [existingRecs] = await db.query(
        'SELECT COUNT(*) AS count FROM application_recommendations WHERE user_id = ?',
        [user.id]
      );

      if (existingRecs[0].count > 0) {
        console.log(`[추천 생성] 사용자 ID ${user.id}의 추천 목록이 이미 존재합니다. 건너뜁니다.`);
        continue; // 다음 사용자로 넘어감
      }

      await generateApplicationRecommendations(user.id);
    }

    console.log('[추천 생성] 모든 개인 회원 추천이 완료되었습니다.');
  } catch (err) {
    console.error('[추천 생성] 오류:', err);
  }
};

// ===== 서버 기동 =====
const PORT = process.env.PORT || 4000;

createAdminIfNotExists().then(() => {
  server.listen(PORT, '0.0.0.0', async () => {
    console.log(`[서버] ${PORT}번 포트에서 실행 중`);
    // 서버가 실행된 후 자동 요약 함수를 호출
    await runAutomaticSummary();
    await runAutomaticResumeSummary();
    await runAutomaticResumeReviewSummary();
    await runAutomaticRecommendations();
    await runAutomaticApplicationRecommendations();
  });
});