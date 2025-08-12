const express = require('express');
const router = express.Router();
const db = require('../../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const SECRET_KEY = process.env.JWT_SECRET;

// 로그인 API
router.post('/login', async (req, res) => {
  const { username, password, userType: requestedUserType } = req.body;

  try {
    const [users] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    if (users.length === 0) {
      return res.status(400).json({ success: false, message: '존재하지 않는 아이디입니다.' });
    }

    const user = users[0];

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: '비밀번호가 틀렸습니다.' });
    }

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
    });
  } catch (err) {
    console.error('로그인 오류:', err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;