require('dotenv').config();
const mysql = require('mysql2/promise');  // promise 모듈 사용

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

pool.getConnection()
  .then(conn => {
    console.log('DB 연결 성공');
    conn.release();
  })
  .catch(err => {
    console.error('DB 연결 실패:', err);
    process.exit(1);
  });

module.exports = pool;
