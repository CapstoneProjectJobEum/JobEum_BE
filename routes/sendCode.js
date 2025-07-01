require("dotenv").config();
const express = require("express");
const router = express.Router();
const nodemailer = require("nodemailer");

const codeStore = new Map();

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// 개인회원용 메일 전송기
const personalTransporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER_1,
    pass: process.env.EMAIL_PASS_1,
  },
});

// 기업회원용 메일 전송기
const companyTransporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER_2,
    pass: process.env.EMAIL_PASS_2,
  },
});

router.post("/send-code", async (req, res) => {
  const { email, userType } = req.body; // userType 추가: "personal" 또는 "company"

  if (!email) return res.status(400).json({ success: false, message: "이메일을 입력하세요." });
  if (!userType || !["개인회원", "기업회원"].includes(userType))
    return res.status(400).json({ success: false, message: "유효한 userType을 입력하세요." });


  const code = generateCode();
  codeStore.set(email, { code, expiresAt: Date.now() + 5 * 60 * 1000 });

  // userType에 따라 다른 transporter 선택
  const transporter = userType === "개인회원" ? personalTransporter : companyTransporter;
  const fromEmail = userType === "개인회원" ? process.env.EMAIL_USER_1 : process.env.EMAIL_USER_2;

  try {
    await transporter.sendMail({
      from: `JobEum <${fromEmail}>`,
      to: email,
      subject: "잡이음 인증번호",
      text: `인증번호는 ${code} 입니다. 5분 내로 입력해주세요.`,
      html: `
    <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 8px; max-width: 400px;">
      <h2 style="color: #333;">잡이음 인증번호 안내</h2>
      <p>안녕하세요!</p>
      <p>아래 인증번호를 5분 내로 입력해주세요.</p>
      <div style="margin: 20px 0; padding: 10px; font-size: 24px; font-weight: bold; background: #f0f0f0; border-radius: 5px; text-align: center;">
        ${code}
      </div>
      <p style="color: #999; font-size: 12px;">이 메일에心 의심스러운 점이 있으면 무시해주세요.</p>
      <hr style="border: none; border-top: 1px solid #eee;">
      <p style="font-size: 12px; color: #666;">JobEum 팀 드림</p>
    </div>
  `
    });


    res.json({ success: true, message: "인증번호가 전송되었습니다." });
  } catch (err) {
    console.error("메일 전송 실패:", err);
    res.status(500).json({ success: false, message: "메일 전송에 실패했습니다." });
  }
});

module.exports = { router, codeStore };
