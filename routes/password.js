const express = require('express');
const router = express.Router();
const db = require('../db');

// 가상의 인증코드 검증 로직 (임시 하드코딩)
/*router.post('/verify-code', async (req, res) => {
  const { username, email, verifyCode } = req.body;

  if (!username || !email || !verifyCode) {
    return res.status(400).json({ success: false, message: '모든 필드를 입력해주세요.' });
  }

  try {
    // 실제 프로젝트라면 이메일로 전송한 인증코드를 DB나 Redis에서 비교해야 함
    const FAKE_CODE = '123456'; // 테스트용 고정값

    if (verifyCode !== FAKE_CODE) {
      return res.status(401).json({ success: false, message: '인증번호가 올바르지 않습니다.' });
    }

    const [users] = await db.query(
      'SELECT * FROM users WHERE username = ? AND email = ?',
      [username, email]
    );

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
    }

    res.json({ success: true, message: '인증 성공' });
  } catch (err) {
    console.error('인증 오류:', err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
}); */

module.exports = router;