const express = require("express");
const router = express.Router();
const db = require("../db");
const bcrypt = require("bcryptjs");

// 비밀번호 변경 라우터 (이메일 미포함)
router.post("/change-password", async (req, res) => {
  const { username, currentPassword, newPassword } = req.body;

  if (!username || !currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      message: "모든 필드를 입력해주세요.",
    });
  }

  try {
    // 사용자 조회
    const [users] = await db.query(
      "SELECT * FROM users WHERE username = ?",
      [username]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "사용자를 찾을 수 없습니다.",
      });
    }

    const user = users[0];

    // 현재 비밀번호 일치 확인
    const isMatch = await bcrypt.compare(currentPassword, user.password);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "현재 비밀번호가 일치하지 않습니다.",
      });
    }

    // 새 비밀번호 해시
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 비밀번호 업데이트
    await db.query(
      "UPDATE users SET password = ? WHERE username = ?",
      [hashedPassword, username]
    );

    res.json({
      success: true,
      message: "비밀번호가 성공적으로 변경되었습니다.",
    });
  } catch (err) {
    console.error("비밀번호 변경 오류:", err);
    res.status(500).json({
      success: false,
      message: "서버 오류가 발생했습니다.",
    });
  }
});

module.exports = router;
