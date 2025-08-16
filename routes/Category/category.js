const router = require('express').Router();
const db = require('../../db');

// POST /api/category
router.post('/', async (req, res) => {
    const filters = req.body;

    if (!filters) {
        return res.status(400).json({ message: '필터 정보를 보내주세요.' });
    }

    try {
        const whereClauses = [];
        const params = [];

        Object.entries(filters).forEach(([key, value]) => {
            if (Array.isArray(value) && value.length > 0) {
                // 같은 key 내부 값은 OR
                const orConditions = value.map(v => {
                    params.push(v);
                    return `JSON_CONTAINS(jp.filters->'$.${key}', JSON_QUOTE(?))`;
                });
                whereClauses.push(`(${orConditions.join(' OR ')})`);
            } else if (key === 'personalized' && Object.keys(value).length > 0) {
                Object.entries(value).forEach(([pKey, pValues]) => {
                    if (Array.isArray(pValues) && pValues.length > 0) {
                        const orConditions = pValues.map(pVal => {
                            params.push(pVal);
                            return `JSON_CONTAINS(jp.personalized->'$.${pKey}', JSON_QUOTE(?))`;
                        });
                        whereClauses.push(`(${orConditions.join(' OR ')})`);
                    }
                });
            }
        });

        const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        const [rows] = await db.query(
            `
            SELECT jp.id, jp.title, jp.company, jp.location, jp.detail, jp.summary, jp.deadline, jp.created_at,
                   jp.filters, jp.personalized
            FROM job_post jp
            ${whereClause}
            ORDER BY jp.created_at DESC
            `,
            params
        );

        res.json(rows);
    } catch (err) {
        console.error('Category POST / 오류:', err);
        res.status(500).json({ message: '서버 오류' });
    }
});

module.exports = router;
