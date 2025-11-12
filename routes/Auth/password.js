const express = require('express');
const router = express.Router();
const db = require('../../db');
const bcrypt = require("bcryptjs");
const jwt = require('jsonwebtoken');
const { codeStore } = require('./sendCode');

// 인증 미들웨어
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ success: false, message: "인증 토큰이 없습니다." });

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "유효하지 않은 토큰입니다." });
  }
}

router.post("/reset-password", authMiddleware, async (req, res) => {
  const { username, email, password } = req.body;

  if (!password) {
    return res.status(400).json({ success: false, message: "비밀번호를 입력해주세요." });
  }

  try {
    let query, params;

    if (req.user) {
      // 로그인 상태: userId 기준
      query = "UPDATE users SET password = ? WHERE id = ?";
      params = [await bcrypt.hash(password, 10), req.user.id];
    } else {
      // 비로그인 상태: username + email 필수
      if (!username || !email) {
        return res.status(400).json({ success: false, message: "모든 필드를 입력해주세요." });
      }

      const [users] = await db.query("SELECT * FROM users WHERE username = ? AND email = ?", [username, email]);
      if (users.length === 0) {
        return res.status(404).json({ success: false, message: "사용자를 찾을 수 없습니다." });
      }

      query = "UPDATE users SET password = ? WHERE username = ? AND email = ?";
      params = [await bcrypt.hash(password, 10), username, email];
    }

    await db.query(query, params);
    res.json({ success: true, message: "비밀번호가 성공적으로 변경되었습니다." });
  } catch (err) {
    console.error("비밀번호 재설정 오류:", err);
    res.status(500).json({ success: false, message: "서버 오류가 발생했습니다." });
  }
});


// 로그아웃 유저용 비밀번호 재설정
router.post("/reset-password-guest", async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ success: false, message: "모든 필드를 입력해주세요." });
  }

  try {
    const [users] = await db.query(
      "SELECT * FROM users WHERE username = ? AND email = ?",
      [username, email]
    );

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: "사용자를 찾을 수 없습니다." });
    }

    await db.query(
      "UPDATE users SET password = ? WHERE username = ? AND email = ?",
      [await bcrypt.hash(password, 10), username, email]
    );

    res.json({ success: true, message: "비밀번호가 성공적으로 변경되었습니다." });
  } catch (err) {
    console.error("비밀번호 재설정 오류(Guest):", err);
    res.status(500).json({ success: false, message: "서버 오류가 발생했습니다." });
  }
});




module.exports = router;
