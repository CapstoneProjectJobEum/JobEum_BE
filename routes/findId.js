<<<<<<< HEAD
// 아이디 찾기
=======
>>>>>>> 217cbcfa6dd6e49ead6d503a74753ecb9fd5a3bf
const express = require('express');
const router = express.Router();
const db = require('../db');

router.post('/find-id', async (req, res) => {
<<<<<<< HEAD
  const { name, email } = req.body;
=======
  const { userType, name, email } = req.body;

  console.log("Received userType:", userType);
  console.log("Received name:", name);
  console.log("Received email:", email);
>>>>>>> 217cbcfa6dd6e49ead6d503a74753ecb9fd5a3bf

  if (!name || !email) {
    return res.status(400).json({ success: false, message: '이름과 이메일을 입력해 주세요.' });
  }

<<<<<<< HEAD
  try {
    const [users] = await db.query(
      'SELECT username FROM users WHERE name = ? AND email = ?',
      [name, email]
    );

=======
  const nameColumn = userType === "기업회원" ? "manager" : "name";

  try {
    console.log(`Running query with column ${nameColumn}`);

    const [users] = await db.query(
      `SELECT username FROM users WHERE ${nameColumn} = ? AND email = ?`,
      [name.trim(), email.trim()]
    );

    console.log("Query result:", users);

>>>>>>> 217cbcfa6dd6e49ead6d503a74753ecb9fd5a3bf
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: '등록된 아이디가 없습니다.' });
    }

    res.json({ success: true, username: users[0].username });
  } catch (err) {
    console.error('아이디 찾기 오류:', err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

<<<<<<< HEAD
=======

>>>>>>> 217cbcfa6dd6e49ead6d503a74753ecb9fd5a3bf
module.exports = router;
