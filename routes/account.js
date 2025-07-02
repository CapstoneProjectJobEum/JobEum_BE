const express = require("express");
const router = express.Router();
const db = require("../db");

// 회원 탈퇴 라우터
router.post("/withdraw", async (req, res) => {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ success: false, message: "사용자 이름이 필요합니다." });
  }

  try {
    // 사용자 존재 확인
    const [users] = await db.query(
      "SELECT * FROM users WHERE username = ?",
      [username]
    );

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: "해당 사용자를 찾을 수 없습니다." });
    }

    // 사용자 삭제
    await db.query(
      "DELETE FROM users WHERE username = ?",
      [username]
    );

    res.json({ success: true, message: "회원탈퇴가 완료되었습니다." });
  } catch (err) {
    console.error("회원탈퇴 오류:", err);
    res.status(500).json({ success: false, message: "서버 오류가 발생했습니다." });
  }
});

module.exports = router;
