const express = require('express');
const router = express.Router();
const db = require('../db');

// 비밀번호 재설정
router.post("/reset-password", async (req, res) => {
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

    const bcrypt = require("bcryptjs");
    const hashedPassword = await bcrypt.hash(password, 10);

    await db.query(
      "UPDATE users SET password = ? WHERE username = ? AND email = ?",
      [hashedPassword, username, email]
    );

    res.json({ success: true, message: "비밀번호가 성공적으로 변경되었습니다." });
  } catch (err) {
    console.error("비밀번호 재설정 오류:", err);
    res.status(500).json({ success: false, message: "서버 오류가 발생했습니다." });
  }
});

module.exports = router;