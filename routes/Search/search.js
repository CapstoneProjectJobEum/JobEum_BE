// 검색 API
const router = require('express').Router();
const db = require('../../db');

router.get('/', async (req, res) => {
    const { q = '', page = 1, size = 20 } = req.query;
    const limit = Number(size);
    const offset = (Number(page) - 1) * limit;

    if (q.trim().length < 2) {
        return res.status(400).json({ message: '검색어는 2글자 이상 입력하세요.' });
    }

    const [rows] = await db.query(
        `
    SELECT jp.id, jp.title, jp.content, jp.created_at
    FROM job_post jp
    LEFT JOIN job_post_category jpc ON jpc.job_post_id = jp.id
    LEFT JOIN category c ON c.id = jpc.category_id
    WHERE CONCAT_WS(' ', jp.title, jp.content, c.name) LIKE CONCAT('%', ?, '%')
    GROUP BY jp.id
    ORDER BY jp.created_at DESC
    LIMIT ? OFFSET ?
    `,
        [q, limit, offset]
    );

    res.json(rows);
});

module.exports = router;