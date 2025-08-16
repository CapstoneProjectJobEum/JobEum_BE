// 검색 API (수정된 예시)
const router = require('express').Router();
const db = require('../../db');

router.get('/', async (req, res) => {
    const { q = '' } = req.query;

    if (q.trim().length < 2) {
        return res.status(400).json({ message: '검색어는 2글자 이상 입력하세요.' });
    }

    try {
        const [rows] = await db.query(
            `
            SELECT jp.id, jp.title, jp.company, jp.location, jp.detail, jp.summary, jp.deadline, jp.created_at
            FROM job_post jp
            WHERE CONCAT_WS(' ', jp.title, jp.company, jp.detail, jp.summary)
            LIKE CONCAT('%', ?, '%')
            ORDER BY jp.created_at DESC
            `,
            [q]
        );

        res.json(rows);  // 상세 데이터 그대로 내려줌
    } catch (err) {
        res.status(500).json({ message: '서버 오류' });
    }
});

module.exports = router;
