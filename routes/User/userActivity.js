const express = require("express");
const router = express.Router();
const db = require("../../db");

// 북마크 / 최근 본 공고 / 지원 현황 기록 추가
router.post("/", async (req, res) => {
    const { user_id, activity_type, target_id } = req.body;

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // 1) user_activity 기록
        await conn.query(
            `INSERT INTO user_activity (user_id, activity_type, target_id)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE status = 1, updated_at = CURRENT_TIMESTAMP`,
            [user_id, activity_type, target_id]
        );

        // 2) 관심 기업 / 관심 공고 테이블에도 반영
        if (activity_type === "bookmark_company") {
            await conn.query(
                `INSERT INTO user_favorite_company (user_id, company_id)
                 VALUES (?, ?)
                 ON DUPLICATE KEY UPDATE created_at = CURRENT_TIMESTAMP`,
                [user_id, target_id]
            );
        }

        if (activity_type === "bookmark_job") {
            await conn.query(
                `INSERT INTO user_favorite_job (user_id, job_post_id)
                 VALUES (?, ?)
                 ON DUPLICATE KEY UPDATE created_at = CURRENT_TIMESTAMP`,
                [user_id, target_id]
            );
        }

        await conn.commit();
        res.json({ success: true });
    } catch (error) {
        await conn.rollback();
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        conn.release();
    }
});

// 비활성 처리 (북마크 해제, 최근 본 공고 삭제 등)
router.put("/:id/deactivate", async (req, res) => {
    const { id } = req.params;

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // 1) user_activity 상태 OFF
        const [rows] = await conn.query(
            `SELECT * FROM user_activity WHERE id = ?`,
            [id]
        );
        if (rows.length === 0) {
            throw new Error("Activity not found");
        }
        const activity = rows[0];

        await conn.query(
            `UPDATE user_activity SET status = 0 WHERE id = ?`,
            [id]
        );

        // 2) 관심 기업 / 관심 공고 테이블에서도 OFF 처리 (= 삭제)
        if (activity.activity_type === "bookmark_company") {
            await conn.query(
                `DELETE FROM user_favorite_company 
                 WHERE user_id = ? AND company_id = ?`,
                [activity.user_id, activity.target_id]
            );
        }

        if (activity.activity_type === "bookmark_job") {
            await conn.query(
                `DELETE FROM user_favorite_job 
                 WHERE user_id = ? AND job_post_id = ?`,
                [activity.user_id, activity.target_id]
            );
        }

        await conn.commit();
        res.json({ success: true });
    } catch (error) {
        await conn.rollback();
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        conn.release();
    }
});

// 특정 활동 타입 목록 조회
router.get("/:user_id/:activity_type", async (req, res) => {
    const { user_id, activity_type } = req.params;
    const [rows] = await db.query(
        `SELECT * FROM user_activity
         WHERE user_id = ? AND activity_type = ? AND status = 1
         ORDER BY updated_at DESC`,
        [user_id, activity_type]
    );
    res.json(rows);
});

module.exports = router;
