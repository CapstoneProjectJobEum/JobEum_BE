require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

//Admin
const adminRouter = require('./routes/Admin/admin');

//Auth
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

//Category
const categoryRouter = require('./routes/Category/category');
const jobCategoryRouter = require('./routes/Category/jobCategory');

//Common
const accountInfoRouter = require('./routes/Common/accountInfo');
const jobRouter = require('./routes/Common/job');

//Company
const companyRoutes = require('./routes/Company/company');
const companyProfileRouter = require('./routes/Company/companyProfile');

//Search
const searchRouter = require('./routes/Search/search');

//User
const userProfileRouter = require('./routes/User/userProfile');

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
app.use('/api/user-profile', userProfileRouter);
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