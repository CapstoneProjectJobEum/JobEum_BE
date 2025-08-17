require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require("node-cron");
const db = require("./db");

// Admin
const adminRouter = require('./routes/Admin/admin');
const createAdminIfNotExists = require('./routes/Admin/createAdminIfNotExists');

// Auth
const checkDuplicateRoutes = require("./routes/Auth/checkDuplicate");
const checkUserRouter = require("./routes/Auth/checkUser");
const findIdRouter = require('./routes/Auth/findId');
const loginRouter = require('./routes/Auth/login');
const passwordRouter = require('./routes/Auth/password');
const sendCodeRouter = require('./routes/Auth/sendCode');
const signupRouter = require('./routes/Auth/signup');
const socialAuthRoutes = require('./routes/Auth/socialAuth');
const verifyCodeRouter = require('./routes/Auth/verifyCode');
const withDrawRoutes = require('./routes/Auth/withDraw');

// Category
const categoryRouter = require('./routes/Category/category');

// Common
const accountInfoRouter = require('./routes/Common/accountInfo');
const jobRouter = require('./routes/Common/job');

// Company
const companyRoutes = require('./routes/Company/company');
const companyProfileRouter = require('./routes/Company/companyProfile');

// Inquiry_Report
const inquiryRouter = require('./routes/Inquiry_Report/inquiry');
const reportRouter = require('./routes/Inquiry_Report/report');

// Middleware
const attachUser = require('./routes/Middleware/jwt');
const { requireAuth, requireRole } = require('./routes/Middleware/auth');

// Search
const searchRouter = require('./routes/Search/search');

// User
const userProfileRouter = require('./routes/User/userProfile');
const resumesRouter = require('./routes/User/resumes');
const applicationsRouter = require('./routes/User/applications');
const userActivityRouter = require('./routes/User/userActivity');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(attachUser);

// Admin
app.use('/api/admin', requireAuth, requireRole('ADMIN'), adminRouter);

// Auth
app.use("/api", checkDuplicateRoutes);
app.use("/api", checkUserRouter);
app.use('/api', findIdRouter);
app.use('/api', loginRouter);
app.use('/api', passwordRouter);
app.use('/api', sendCodeRouter.router);
app.use('/api', signupRouter);
app.use("/api", socialAuthRoutes);
app.use('/api', verifyCodeRouter);
app.use("/api", withDrawRoutes);

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

// CRON JOB: 자정마다 마감 공고 자동 비활성화
cron.schedule("0 0 * * *", async () => {
  try {
    await db.query(`
      UPDATE job_post
      SET status = 'inactive'
      WHERE STR_TO_DATE(deadline, '%Y-%m-%d') < CURDATE()
        AND status = 'active'
    `);
    console.log(" 마감된 공고 자동 비활성화 실행됨");
  } catch (err) {
    console.error("자동 비활성화 오류:", err.message);
  }
}, {
  timezone: "Asia/Seoul"
});

const PORT = process.env.PORT || 4000;

createAdminIfNotExists().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`서버가 ${PORT}번 포트에서 실행 중입니다.`);
  });
});
