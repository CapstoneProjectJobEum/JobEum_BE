const express = require('express');
const router = express.Router();
const db = require('../../db');

// 1. 사용자별 이력서 목록 조회
router.get('/', async (req, res) => {
    try {
        const userId = parseInt(req.query.user_id, 10);

        if (!userId) return res.status(400).json({ error: 'user_id 필요' });

        const [rows] = await db.query(
            `SELECT id, title, created_at AS createdAt, is_default AS isDefault
             FROM resumes
             WHERE user_id = ?`,
            [userId]
        );

        res.json(rows);
    } catch (err) {
        console.error('라우터 에러:', err);
        res.status(500).json({ error: err.message });
    }
});


// 2. 이력서 상세 조회
router.get('/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const [rows] = await db.query('SELECT * FROM resumes WHERE id = ?', [id]);
        res.json(rows[0] || {});
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. 신규 이력서 등록
router.post('/', async (req, res) => {
    try {
        const data = req.body;

        if (data.is_default) {
            await db.query('UPDATE resumes SET is_default=0 WHERE user_id=?', [data.user_id]);
        }

        const [result] = await db.query(
            `INSERT INTO resumes 
      (user_id, title, residence, education_detail, career_detail, self_introduction,
       certificates, internship_activities, preferences_military, working_conditions,
       disability_requirements, is_default, name, birth, gender, phone, email)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                data.user_id, data.title, data.residence, data.education_detail, data.career_detail,
                data.self_introduction, data.certificates, data.internship_activities, data.preferences_military,
                data.working_conditions, JSON.stringify(data.disability_requirements), data.is_default ? 1 : 0,
                data.name, data.birth, data.gender, data.phone, data.email
            ]
        );
        res.json({ success: true, id: result.insertId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. 기존 이력서 수정
router.put('/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const data = req.body;

        if (data.is_default) {
            await db.query('UPDATE resumes SET is_default=0 WHERE user_id=?', [data.user_id]);
        }

        await db.query(
            `UPDATE resumes SET 
      title=?, residence=?, education_detail=?, career_detail=?,
      self_introduction=?, certificates=?, internship_activities=?, preferences_military=?,
      working_conditions=?, disability_requirements=?, is_default=?,
      name=?, birth=?, gender=?, phone=?, email=?
      WHERE id=?`,
            [
                data.title, data.residence, data.education_detail, data.career_detail,
                data.self_introduction, data.certificates, data.internship_activities, data.preferences_military,
                data.working_conditions, JSON.stringify(data.disability_requirements), data.is_default ? 1 : 0,
                data.name, data.birth, data.gender, data.phone, data.email,
                id
            ]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. 이력서 삭제
router.delete('/:id', async (req, res) => {
    try {
        const id = req.params.id;
        await db.query('DELETE FROM resumes WHERE id=?', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 6. 기본 이력서 설정
router.put('/:id/default', async (req, res) => {
    try {
        const id = req.params.id;
        const userId = req.body.user_id;
        await db.query('UPDATE resumes SET is_default=0 WHERE user_id=?', [userId]);
        await db.query('UPDATE resumes SET is_default=1 WHERE id=?', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
