const express = require('express');
const router = express.Router();
const db = require('../db');

router.post('/find-id', async (req, res) => {
  const { userType, name, email } = req.body;

  console.log("Received userType:", userType);
  console.log("Received name:", name);
  console.log("Received email:", email);

  if (!name || !email) {
    return res.status(400).json({ success: false, message: '이름과 이메일을 입력해 주세요.' });
  }

  const nameColumn = userType === "기업회원" ? "manager" : "name";

  try {
    console.log(`Running query with column ${nameColumn}`);

    const [users] = await db.query(
      `SELECT username FROM users WHERE ${nameColumn} = ? AND email = ?`,
      [name.trim(), email.trim()]
    );

    console.log("Query result:", users);

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: '등록된 아이디가 없습니다.' });
    }

    res.json({ success: true, username: users[0].username });
  } catch (err) {
    console.error('아이디 찾기 오류:', err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});


module.exports = router;
