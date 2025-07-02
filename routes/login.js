<<<<<<< HEAD
// 로그인
=======
>>>>>>> 217cbcfa6dd6e49ead6d503a74753ecb9fd5a3bf
const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcryptjs');
<<<<<<< HEAD

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // 사용자 조회
=======
const jwt = require('jsonwebtoken');

const SECRET_KEY = process.env.JWT_SECRET;

router.post('/login', async (req, res) => {
  const { username, password, userType: requestedUserType } = req.body;

  try {
>>>>>>> 217cbcfa6dd6e49ead6d503a74753ecb9fd5a3bf
    const [users] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    if (users.length === 0) {
      return res.status(400).json({ success: false, message: '존재하지 않는 아이디입니다.' });
    }

    const user = users[0];

<<<<<<< HEAD
    // 비밀번호 검증
=======
>>>>>>> 217cbcfa6dd6e49ead6d503a74753ecb9fd5a3bf
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: '비밀번호가 틀렸습니다.' });
    }

<<<<<<< HEAD
    // 로그인 성공
    res.json({
      success: true,
      message: '로그인 성공',
      userType: user.user_type,
      username: user.username,
=======
    if (user.user_type !== requestedUserType) {
      return res.status(403).json({
        success: false,
        message: `${requestedUserType}만 로그인 가능합니다.`,
      });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, userType: user.user_type },
      SECRET_KEY,
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      message: '로그인 성공',
      token,
      id: user.id,
      username: user.username,
      userType: user.user_type,
>>>>>>> 217cbcfa6dd6e49ead6d503a74753ecb9fd5a3bf
    });
  } catch (err) {
    console.error('로그인 오류:', err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
