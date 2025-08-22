require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');
const db = require('./db');

// ===== Admin =====
const adminRouter = require('./routes/Admin/admin');
const createAdminIfNotExists = require('./routes/Admin/createAdminIfNotExists');

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
const notificationRouter = require('./routes/Notification/notification'); // ← 알림 REST
const { runFavoriteDeadlineJob } = require('../routes/jobs/notifyFavoriteJobDeadline'); // ← D-7/D-1/D-0
const { runCompanyDeadlineJob } = require('../routes/jobs/notifyCompanyJobDeadline');

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
    // 로그인 시 발급한 JWT 페이로드 키에 맞춰주세요 (예: payload.id / payload.userId)
    socket.user = { id: payload.id };
    return next();
  } catch {
    return next(new Error('invalid token'));
  }
});

// 유저별 룸 입장
io.on('connection', (socket) => {
  socket.join(`user:${socket.user.id}`);
  console.log('[socket] connected user:', socket.user.id);

  socket.on('disconnect', () => {
    console.log('[socket] disconnected user:', socket.user.id);
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
    console.log('마감된 공고 자동 비활성화 실행됨');
  } catch (err) {
    console.error('자동 비활성화 오류:', err.message);
  }
}, { timezone: 'Asia/Seoul' });

// ===== CRON 2) 09:00: 관심 공고 마감 임박 알림(D-7/D-1/D-0) =====
cron.schedule('0 9 * * *', async () => {
  try {
    const io = app.get('io');
    await runFavoriteDeadlineJob(io);
    console.log('[cron] deadline notifications sent');
  } catch (e) {
    console.error('[cron] error', e);
  }
}, { timezone: 'Asia/Seoul' });

// ===== CRON 3) 09:00: 공고 마감 임박 알림(D-7/D-1/D-0)(기업) =====
cron.schedule('2 9 * * *', async () => {  // 09:02 KST
  try {
    const io = app.get('io');
    await runCompanyDeadlineJob(io);
    console.log('[cron] company deadline notifications sent');
  } catch (e) {
    console.error('[cron] company deadline error', e);
  }
}, { timezone: 'Asia/Seoul' });

// ===== 서버 기동 =====
const PORT = process.env.PORT || 4000;
createAdminIfNotExists().then(() => {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`서버가 ${PORT}번 포트에서 실행 중입니다.`);
  });
});