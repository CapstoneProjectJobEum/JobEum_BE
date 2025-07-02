<<<<<<< HEAD
// 회원가입
=======
>>>>>>> 217cbcfa6dd6e49ead6d503a74753ecb9fd5a3bf
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

<<<<<<< HEAD
  // userType 변환
=======
  // userType 변환 및 검증
>>>>>>> 217cbcfa6dd6e49ead6d503a74753ecb9fd5a3bf
  let dbUserType;
  if (userType === '회원') {
    dbUserType = '개인회원';
  } else if (userType === '기업') {
    dbUserType = '기업회원';
<<<<<<< HEAD
  } else {입니
=======
  } else {
>>>>>>> 217cbcfa6dd6e49ead6d503a74753ecb9fd5a3bf
    return res.status(400).json({ success: false, message: '유효하지 않은 회원 유형입니다.' });
  }

  // gender 검증
  let dbGender = null;
  if (gender === '남자' || gender === '여자') {
    dbGender = gender;
  }

  try {
<<<<<<< HEAD
    // 아이디 중복 검사
    const [existing] = await db.query(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );
    if (existing.length > 0) {
      return res
        .status(400)
        .json({ success: false, message: '이미 존재하는 아이디입니다.' });
=======
    // username 중복 검사
    const [existingUsername] = await db.query(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );
    if (existingUsername.length > 0) {
      return res.status(409).json({ success: false, message: '이미 존재하는 아이디입니다.' });
    }

    // email 중복 검사
    const [existingEmail] = await db.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );
    if (existingEmail.length > 0) {
      return res.status(409).json({ success: false, message: '이미 사용 중인 이메일입니다.' });
>>>>>>> 217cbcfa6dd6e49ead6d503a74753ecb9fd5a3bf
    }

    // 비밀번호 해싱
    const hashedPassword = await bcrypt.hash(password, 10);

<<<<<<< HEAD
    // 저장할 데이터 구성
=======
    // 저장할 데이터
>>>>>>> 217cbcfa6dd6e49ead6d503a74753ecb9fd5a3bf
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
