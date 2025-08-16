// routes/userActivity.js
const express = require("express");
const router = express.Router();
const db = require("../../db");

// 북마크 / 최근 본 공고 / 지원 현황 기록 추가
router.post("/", async (req, res) => {
    const { user_id, activity_type, target_id } = req.body;
    await db.query(
        `INSERT INTO user_activity (user_id, activity_type, target_id)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE status = 1, updated_at = CURRENT_TIMESTAMP`,
        [user_id, activity_type, target_id]
    );
    res.json({ success: true });
});

// 비활성 처리 (북마크 해제, 최근 본 공고 삭제 등)
router.put("/:id/deactivate", async (req, res) => {
    const { id } = req.params;
    await db.query(`UPDATE user_activity SET status = 0 WHERE id = ?`, [id]);
    res.json({ success: true });
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
