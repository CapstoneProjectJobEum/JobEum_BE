const express = require("express");
const router = express.Router();
const { codeStore } = require("./sendCode");

router.post("/verify-code", (req, res) => {
  console.log("받은 데이터:", req.body);

  const { email, verifyCode } = req.body;

  if (!email || !verifyCode) {
    return res.status(400).json({ success: false, message: "모든 필드를 입력해주세요." });
  }

  const record = codeStore.get(email);

  if (!record) {
    return res.status(404).json({ success: false, message: "인증 요청이 없습니다." });
  }

  const { code, expiresAt } = record;

  if (Date.now() > expiresAt) {
    codeStore.delete(email);
    return res.status(410).json({ success: false, message: "인증번호가 만료되었습니다." });
  }

  if (verifyCode !== code) {
    return res.status(401).json({ success: false, message: "인증번호가 일치하지 않습니다." });
  }

  codeStore.delete(email);
  res.json({ success: true, message: "인증 성공" });
});

module.exports = router;