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
const categoryRouter = require('./routes/category'); // 1. 카테고리 관련 라우터
const jobCategoryRouter = require('./routes/jobCategory'); // 2. 채용 공고 카테고리 관련 라우터
const adminRouter = require('./routes/admin'); // 3. 관리자 관련 라우터
const searchRouter = require('./routes/search');  // 4. 검색 관련 라우터

const app = express();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api', findIdRouter);
app.use('/api', signupRouter);
app.use('/api', loginRouter);
app.use('/api', passwordRouter);
app.use('/api', sendCodeRouter.router);
app.use('/api', verifyCodeRouter);
app.use("/api", socialAuthRoutes);
app.use('/api/user-profile', userRouter);
app.use('/api/jobs', jobRouter);
app.use("/api", checkDuplicateRoutes);
app.use("/api", checkUserRouter);
app.use("/api", withDrawRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/company-profile', companyProfileRouter); 
app.use('/api/account-info', accountInfoRouter); 
app.use('/api/categories', categoryRouter); // 카테고리 관련 API
app.use('/api/jobs', jobCategoryRouter);  // 카테고리 설정용 API
app.use('/api/admin', adminRouter); // 관리자 관련 API
app.use('/api/search', searchRouter); // 검색 관련 API


const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`서버가 ${PORT}번 포트에서 실행 중입니다.`);
});