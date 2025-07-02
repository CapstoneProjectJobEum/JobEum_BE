// 회원가입
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
    manager
  } = req.body;

  // userType 변환
  let dbUserType;
  if (userType === '회원') {
    dbUserType = '개인회원';
  } else if (userType === '기업') {
    dbUserType = '기업회원';
  } else {입니
    return res.status(400).json({ success: false, message: '유효하지 않은 회원 유형입니다.' });
  }

  // gender 검증
  let dbGender = null;
  if (gender === '남자' || gender === '여자') {
    dbGender = gender;
  }

  try {
    // 아이디 중복 검사
    const [existing] = await db.query(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );
    if (existing.length > 0) {
      return res
        .status(400)
        .json({ success: false, message: '이미 존재하는 아이디입니다.' });
    }

    // 비밀번호 해싱
    const hashedPassword = await bcrypt.hash(password, 10);

    // 저장할 데이터 구성
    const userData = {
      user_type: dbUserType,
      username,
      password: hashedPassword,
      email,
      phone,
      name: dbUserType === '개인회원' ? name : null,
      birth: dbUserType === '개인회원' ? birth : null,
      gender: dbUserType === '개인회원' ? dbGender : null,
      company: dbUserType === '기업회원' ? company : null,
      biz_number: dbUserType === '기업회원' ? bizNumber : null,
      manager: dbUserType === '기업회원' ? manager : null,
    };

    // DB Insert
    const [result] = await db.query('INSERT INTO users SET ?', userData);

    res.status(201).json({ success: true, userId: result.insertId });
  } catch (err) {
    console.error('회원가입 오류:', err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
