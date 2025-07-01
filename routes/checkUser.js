// routes/checkUser.js
const express = require("express");
const router = express.Router();
const db = require("../db");

// 아이디 + 이메일 존재 여부 확인
router.post("/check-user", async (req, res) => {
    const { username, email } = req.body;

    if (!username || !email) {
        return res.status(400).json({ success: false, message: "아이디와 이메일을 입력해주세요." });
    }

    try {
        const [rows] = await db.query(
            "SELECT id FROM users WHERE username = ? AND email = ?",
            [username, email]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: "일치하는 사용자가 없습니다." });
        }

        return res.status(200).json({ success: true, message: "사용자 확인 완료" });
    } catch (err) {
        console.error("사용자 확인 오류:", err);
        return res.status(500).json({ success: false, message: "서버 오류가 발생했습니다." });
    }
});

module.exports = router;
