const express = require("express");
const router = express.Router();
const db = require("../db");

// 소셜 회원가입/로그인 처리
router.post("/social-signup", async (req, res) => {
  const { provider, snsId, email, nickname, profileImage } = req.body;

  if (!provider || !snsId || !email) {
    return res.status(400).json({ success: false, message: "필수 정보가 누락되었습니다." });
  }

  try {
    // 이미 가입된 유저인지 확인
    const [existing] = await db.query(
      "SELECT * FROM users WHERE provider = ? AND sns_id = ?",
      [provider, snsId]
    );

    if (existing.length > 0) {
      // 이미 가입되어 있으면 로그인 처리
      return res.json({ success: true, message: "로그인 성공", user: existing[0] });
    }

    // 신규 회원가입
    const [result] = await db.query(
      `INSERT INTO users (provider, sns_id, email, username, image_path)
       VALUES (?, ?, ?, ?, ?)`,
      [provider, snsId, email, nickname, profileImage]
    );

    res.status(201).json({ success: true, message: "회원가입 성공", userId: result.insertId });
  } catch (err) {
    console.error("소셜 회원가입 오류:", err);
    res.status(500).json({ success: false, message: "서버 오류" });
  }
});

module.exports = router;
