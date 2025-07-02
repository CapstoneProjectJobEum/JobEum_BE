// 로그인
const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcryptjs');

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // 사용자 조회
    const [users] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    if (users.length === 0) {
      return res.status(400).json({ success: false, message: '존재하지 않는 아이디입니다.' });
    }

    const user = users[0];

    // 비밀번호 검증
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: '비밀번호가 틀렸습니다.' });
    }

    // 로그인 성공
    res.json({
      success: true,
      message: '로그인 성공',
      userType: user.user_type,
      username: user.username,
    });
  } catch (err) {
    console.error('로그인 오류:', err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
