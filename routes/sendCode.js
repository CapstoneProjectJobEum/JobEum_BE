require("dotenv").config();
const express = require("express");
const router = express.Router();
const nodemailer = require("nodemailer");

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

const codeStore = new Map();

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
});

router.post("/send-code", async (req, res) => {
  const { email } = req.body;

  if (!email) return res.status(400).json({ success: false, message: "이메일을 입력하세요." });

  const code = generateCode();
  codeStore.set(email, { code, expiresAt: Date.now() + 5 * 60 * 1000 });

  try {
    await transporter.sendMail({
      from: `JobEum <${EMAIL_USER}>`,
      to: email,
      subject: "잡이음 인증번호",
      text: `인증번호는 ${code} 입니다. 5분 내로 입력해주세요.`,
    });

    res.json({ success: true, message: "인증번호가 전송되었습니다." });
  } catch (err) {
    console.error("메일 전송 실패:", err);
    res.status(500).json({ success: false, message: "메일 전송에 실패했습니다." });
  }
});

module.exports = { router, codeStore };
