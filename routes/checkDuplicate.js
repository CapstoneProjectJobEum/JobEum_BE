const express = require("express");
const router = express.Router();
const db = require("../db");

// 중복 검사 API
router.post("/check-duplicate", async (req, res) => {
    const {
        userType,
        username,
        email,
        phone,
        company,
        bizNumber
    } = req.body;

    try {
        // 기본 필수값 체크 (userType에 따라 다르게 처리)
        if (userType === "기업회원") {
            if (!username || !company || !bizNumber || !phone || !email) {
                return res.status(400).json({ success: false, message: "필수 정보가 부족합니다." });
            }
            // 기업회원 검사 순서: 아이디 → 기업명 → 사업자번호 → 휴대폰 → 이메일

            const [usernameRows] = await db.query("SELECT id FROM users WHERE username = ?", [username]);
            if (usernameRows.length > 0) {
                return res.status(200).json({ success: false, field: "username", message: "이미 사용 중인 아이디입니다." });
            }

            const [companyRows] = await db.query("SELECT id FROM users WHERE company = ?", [company]);
            if (companyRows.length > 0) {
                return res.status(200).json({ success: false, field: "company", message: "이미 등록된 기업명입니다." });
            }

            const [bizRows] = await db.query("SELECT id FROM users WHERE biz_number = ?", [bizNumber]);
            if (bizRows.length > 0) {
                return res.status(200).json({ success: false, field: "bizNumber", message: "이미 등록된 사업자번호입니다." });
            }

            const [phoneRows] = await db.query("SELECT id FROM users WHERE phone = ?", [phone]);
            if (phoneRows.length > 0) {
                return res.status(200).json({ success: false, field: "phone", message: "이미 사용 중인 휴대폰 번호입니다." });
            }

            const [emailRows] = await db.query("SELECT id FROM users WHERE email = ?", [email]);
            if (emailRows.length > 0) {
                return res.status(200).json({ success: false, field: "email", message: "이미 사용 중인 이메일입니다." });
            }

        } else {
            // 개인회원 및 기타 회원 검사 순서: 아이디 → 휴대폰 → 이메일

            if (!username || !email || !phone) {
                return res.status(400).json({ success: false, message: "필수 정보가 부족합니다." });
            }

            const [usernameRows] = await db.query("SELECT id FROM users WHERE username = ?", [username]);
            if (usernameRows.length > 0) {
                return res.status(200).json({ success: false, field: "username", message: "이미 사용 중인 아이디입니다." });
            }

            const [phoneRows] = await db.query("SELECT id FROM users WHERE phone = ?", [phone]);
            if (phoneRows.length > 0) {
                return res.status(200).json({ success: false, field: "phone", message: "이미 사용 중인 휴대폰 번호입니다." });
            }

            const [emailRows] = await db.query("SELECT id FROM users WHERE email = ?", [email]);
            if (emailRows.length > 0) {
                return res.status(200).json({ success: false, field: "email", message: "이미 사용 중인 이메일입니다." });
            }
        }

        return res.status(200).json({ success: true });
    } catch (err) {
        console.error("중복 확인 오류:", err);
        return res.status(500).json({ success: false, message: "서버 오류가 발생했습니다." });
    }
});

module.exports = router;
