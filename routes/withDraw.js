// routes/withdraw.js
const express = require("express");
const router = express.Router();
const db = require("../db");

router.post("/withdraw", async (req, res) => {
    const { email, sns_id, sns_provider } = req.body;

    if (!email && !(sns_id && sns_provider)) {
        return res.status(400).json({ success: false, message: "이메일 또는 소셜 정보가 필요합니다." });
    }

    try {
        let users;
        if (email) {
            [users] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
        } else {
            [users] = await db.query(
                "SELECT * FROM users WHERE sns_id = ? AND sns_provider = ?",
                [sns_id, sns_provider]
            );
        }

        if (users.length === 0) {
            return res.status(404).json({ success: false, message: "해당 사용자를 찾을 수 없습니다." });
        }

        if (email) {
            await db.query("DELETE FROM users WHERE email = ?", [email]);
        } else {
            await db.query(
                "DELETE FROM users WHERE sns_id = ? AND sns_provider = ?",
                [sns_id, sns_provider]
            );
        }

        res.json({ success: true, message: "회원 탈퇴가 완료되었습니다." });
    } catch (err) {
        console.error("회원탈퇴 오류:", err);
        res.status(500).json({ success: false, message: "서버 오류가 발생했습니다." });
    }
});

module.exports = router;
