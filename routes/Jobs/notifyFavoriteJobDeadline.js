const db = require('../../db');
const { createBulkNotifications } = require('../Services/notificationService');

// 날짜 문자열 계산
function formatDate(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

// 마감 임박 스케줄러API (D-7 / D-1 / D-0) (개인회원)
async function runFavoriteDeadlineJob(io) {
    const now = new Date();
    const today = formatDate(now);
    const d1 = formatDate(new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000));
    const d7 = formatDate(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000));
    const dp1 = formatDate(new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000));

    const targets = [
        { when: 'D-7', date: d7, makeMsg: (c, t) => `[${c}] '${t}' 공고 마감이 D-7 입니다.` },
        { when: 'D-1', date: d1, makeMsg: (c, t) => `[${c}] '${t}' 공고 마감이 내일입니다.` },
        { when: 'D-0', date: today, makeMsg: (c, t) => `[${c}] '${t}' 공고가 오늘 마감됩니다.` },
        { when: 'D+1', date: dp1, makeMsg: (c, t) => `[${c}] '${t}' 공고가 마감되었습니다.` },
    ];

    for (const t of targets) {
        const [rows] = await db.query(
            `SELECT ufj.user_id,
                    jp.id AS job_post_id,
                    jp.title AS job_title,
                    jp.company AS company_name,
                    jp.deadline
             FROM user_favorite_job ufj
             JOIN job_post jp ON jp.id = ufj.job_post_id
             WHERE STR_TO_DATE(jp.deadline, '%Y-%m-%d') = ?`,
            [t.date]
        );

        if (!rows.length) continue;

        const toInsert = rows.map(r => ({
            userId: r.user_id,
            role: 'MEMBER',
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
