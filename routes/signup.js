const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcryptjs');

// 회원가입 API
router.post('/signup', async (req, res) => {
  const {
    userType,
    username,
    password,
    name,
    birth,
    gender,
    email,
    phone,
    company,
    bizNumber,
    manager,
  } = req.body;

  try {
    const [existingUsername] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    if (existingUsername.length > 0) {
      return res.status(409).json({ success: false, message: '이미 존재하는 아이디입니다.' });
    }

    const [existingEmail] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (existingEmail.length > 0) {
      return res.status(409).json({ success: false, message: '이미 사용 중인 이메일입니다.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const genderValid = gender === '남자' || gender === '여자' ? gender : null;

    const userData = {
      user_type: userType,
      username,
      password: hashedPassword,
      email,
      phone,
      name: userType === '개인회원' ? name : null,
      birth: userType === '개인회원' ? birth : null,
      gender: userType === '개인회원' ? genderValid : null,
      company: userType === '기업회원' ? company : null,
      biz_number: userType === '기업회원' ? bizNumber : null,
      manager: userType === '기업회원' ? manager : null,
    };

    const [result] = await db.query('INSERT INTO users SET ?', userData);
    res.status(201).json({ success: true, userId: result.insertId });
  } catch (err) {
    console.error('회원가입 오류:', err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
