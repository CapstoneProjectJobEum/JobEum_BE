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
            SELECT jp.id, jp.title, jp.company, jp.location, jp.detail, jp.preferred_skills, jp.deadline, jp.created_at,
                   jp.filters, jp.personalized
            FROM job_post jp
            WHERE CONCAT_WS(' ',
                jp.title, jp.company, jp.detail, jp.preferred_skills,
                COALESCE(JSON_UNQUOTE(JSON_EXTRACT(jp.filters, '$.career')), ''),
                COALESCE(JSON_UNQUOTE(JSON_EXTRACT(jp.filters, '$.education')), ''),
                COALESCE(JSON_UNQUOTE(JSON_EXTRACT(jp.filters, '$.employmentType')), ''),
                COALESCE(JSON_UNQUOTE(JSON_EXTRACT(jp.filters, '$.job')), ''),
                COALESCE(JSON_UNQUOTE(JSON_EXTRACT(jp.filters, '$.companyType')), ''),
                COALESCE(JSON_UNQUOTE(JSON_EXTRACT(jp.filters, '$.region')), ''),
                COALESCE(JSON_UNQUOTE(JSON_EXTRACT(jp.personalized, '$.disabilityTypes')), ''),
                COALESCE(JSON_UNQUOTE(JSON_EXTRACT(jp.personalized, '$.disabilityGrade')), ''),
                COALESCE(JSON_UNQUOTE(JSON_EXTRACT(jp.personalized, '$.assistiveDevices')), ''),
                COALESCE(JSON_UNQUOTE(JSON_EXTRACT(jp.personalized, '$.jobInterest')), ''),
                COALESCE(JSON_UNQUOTE(JSON_EXTRACT(jp.personalized, '$.preferredWorkType')), '')
            ) LIKE CONCAT('%', ?, '%')
            ORDER BY jp.created_at DESC
            `,
            [q]
        );

        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: '서버 오류' });
    }
});

module.exports = router;
