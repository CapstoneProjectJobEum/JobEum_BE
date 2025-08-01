require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const findIdRouter = require('./routes/findId');
const passwordRouter = require('./routes/password'); // ❗ verify-code 제거된 버전
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
const companyProfileRouter = require('./routes/companyProfile'); // 1.기업 정보 수정 라우터
const accountInfoRouter = require('./routes/accountInfo'); // 2. 계정 정보 수정 라우터

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
app.use('/api/company-profile', companyProfileRouter); // 1.기업 정보 수정 라우터
app.use('/api/account-info', accountInfoRouter); // 2. 계정 정보 수정 라우터


const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`서버가 ${PORT}번 포트에서 실행 중입니다.`);
});