require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const findIdRouter = require('./routes/findId');
const passwordRouter = require('./routes/password'); 
const userRouter = require('./routes/user');
const jobRouter = require('./routes/job');
const signupRouter = require('./routes/signup');
const loginRouter = require('./routes/login');
const sendCodeRouter = require('./routes/sendCode');
const verifyCodeRouter = require('./routes/verifyCode');
const checkDuplicateRoutes = require("./routes/checkDuplicate");
const checkUserRouter = require("./routes/checkUser");
const socialAuthRoutes = require('./routes/socialAuth');
const withDrawRoutes = require('./routes/withDraw');
const companyRoutes = require('./routes/company'); 
const companyProfileRouter = require('./routes/companyProfile'); 
const accountInfoRouter = require('./routes/accountInfo');
const categoryRouter = require('./routes/category'); 
const jobCategoryRouter = require('./routes/jobCategory'); 
const adminRouter = require('./routes/admin'); 
const searchRouter = require('./routes/search');
const attachUser = require('./middleware/jwt'); // JWT 파싱 → req.user 주입 
const { requireAuth, requireRole } = require('./middleware/auth'); // 인증 미들웨어
const inquiryRouter = require('./routes/inquiry'); // 문의 라우터
const reportRouter  = require('./routes/report'); // 신고 라우터


const app = express();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(attachUser); // JWT 파싱 미들웨어

// 인증/회원 관련
app.use('/api', findIdRouter);
app.use('/api', signupRouter);
app.use('/api', loginRouter);
app.use('/api', passwordRouter);
app.use('/api', sendCodeRouter.router);
app.use('/api', verifyCodeRouter);
app.use('/api', socialAuthRoutes);
app.use('/api', checkDuplicateRoutes);
app.use('/api', checkUserRouter);
app.use('/api', withDrawRoutes);

// 사용자 프로필 / 계정 관련
app.use('/api/user-profile', userRouter);
app.use('/api/account-info', accountInfoRouter);

// 기업 관련
app.use('/api/companies', companyRoutes);
app.use('/api/company-profile', companyProfileRouter);

// 채용공고 / 카테고리
app.use('/api/jobs', jobRouter);
app.use('/api/jobs', jobCategoryRouter);
app.use('/api/categories', categoryRouter);

// 관리자 / 검색
app.use('/api/admin', adminRouter);
app.use('/api/search', searchRouter);

// 문의 / 신고
app.use('/api/inquiries', inquiryRouter);
app.use('/api/reports', reportRouter);

const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`서버가 ${PORT}번 포트에서 실행 중입니다.`);
});