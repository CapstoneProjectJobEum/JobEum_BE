require('dotenv').config();
const express = require('express');
const cors = require('cors');

const findIdRouter = require('./routes/findId');
const passwordRouter = require('./routes/password'); // ❗ verify-code 제거된 버전
const userRouter = require('./routes/user');
const jobRouter = require('./routes/job');
const signupRouter = require('./routes/signup');
const loginRouter = require('./routes/login');
const sendCodeRouter = require('./routes/sendCode');     // ✅ 추가
const verifyCodeRouter = require('./routes/verifyCode'); // ✅ 추가

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api', findIdRouter);
app.use('/api', signupRouter);
app.use('/api', loginRouter);
app.use('/api', passwordRouter);       // reset-password만 남김
app.use('/api', sendCodeRouter.router);       // ✅
app.use('/api', verifyCodeRouter);     // ✅
app.use('/api/user-profile', userRouter);
app.use('/api/jobs', jobRouter);

const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`서버가 ${PORT}번 포트에서 실행 중입니다.`);
});
