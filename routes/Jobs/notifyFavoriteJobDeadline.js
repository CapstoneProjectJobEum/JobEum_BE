// routes/jobs/notifyFavoriteJobDeadline.js
const db = require('../../db');
const { createBulkNotifications } = require('./services/notificationService');

//마감 임박 스케줄러API (D-7 / D-1 / D-0) (개인회원)
async function runFavoriteDeadlineJob(io) {
  // 기준일 계산 (KST)
  // const [[{ today }]]  = await db.query(`SELECT CONVERT_TZ(CURDATE(),'UTC','Asia/Seoul') AS today`); << 당일 알림 쓸거면 targets에 추가
  const [[{ d1 }]]     = await db.query(`SELECT DATE_ADD(CONVERT_TZ(CURDATE(),'UTC','Asia/Seoul'), INTERVAL 1 DAY) AS d1`);
  const [[{ d7 }]]     = await db.query(`SELECT DATE_ADD(CONVERT_TZ(CURDATE(),'UTC','Asia/Seoul'), INTERVAL 7 DAY) AS d7`);
  const [[{ dp1 }]]    = await db.query(`SELECT DATE_SUB(CONVERT_TZ(CURDATE(),'UTC','Asia/Seoul'), INTERVAL 1 DAY) AS dp1`); 

  const targets = [
    { when: 'D-7', date: d7,   makeMsg: (c, t) => `[${c}] '${t}' 공고 마감이 D-7 입니다.` },
    { when: 'D-1', date: d1,   makeMsg: (c, t) => `[${c}] '${t}' 공고 마감이 내일입니다.` },
    { when: 'D+1', date: dp1,  makeMsg: (c, t) => `[${c}] '${t}' 공고가 마감되었습니다.` }, // 마감 다음 날 알림
  ];

  for (const t of targets) {
    const [rows] = await db.query(
      `SELECT ufj.user_id,
              jp.id        AS job_post_id,
              jp.title     AS job_title,
              jp.company   AS company_name,
              jp.deadline
         FROM user_favorite_job ufj
         JOIN job_post jp ON jp.id = ufj.job_post_id
        WHERE DATE(jp.deadline) = ?`,
      [t.date]
    );

    if (!rows.length) continue;

    const toInsert = rows.map(r => ({
      userId: r.user_id,
      type: 'FAVORITE_JOB_DEADLINE',
      title: t.when === 'D+1' ? '관심 공고 마감 안내' : '관심 공고 마감 임박',
      message: t.makeMsg(r.company_name, r.job_title),
      metadata: {
        job_post_id: r.job_post_id,
        company_name: r.company_name,
        job_title: r.job_title,
        deadline: r.deadline,
        when: t.when 
      }
    }));

    await createBulkNotifications(io, toInsert);
  }
}

module.exports = { runFavoriteDeadlineJob };