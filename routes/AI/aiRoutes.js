// JobEumBackend/aiRoutes.js
const express = require("express");
const axios = require("axios");

function aiRoutes({ db, pyUrl }) {
    const router = express.Router();

    // GET /api/ai-recommend/:userId?k=10&excludeSeen=true&enforceGrade=true
    router.get("/ai-recommend/:userId", async (req, res) => {
        const userId = parseInt(req.params.userId, 10);
        const k = parseInt(req.query.k || "10", 10);
        const excludeSeen = (req.query.excludeSeen ?? "true") === "true";
        const enforceGrade = (req.query.enforceGrade ?? "true") === "true";

        // 1) Python 추천 서버에서 job_id 목록 수신
        const { data } = await axios.get(`${pyUrl}/recommend/${userId}`, {
            params: { k, exclude_seen: excludeSeen, enforce_grade: enforceGrade },
            timeout: 15000,
        });

        const ids = data.recommendations || [];
        if (ids.length === 0) return res.json({ items: [] });

        // 2) 정렬 유지하며 DB에서 상세 붙이기
        const placeholders = ids.map(() => "?").join(",");
        const sql = `
      SELECT *
      FROM job_post
      WHERE id IN (${placeholders})
      ORDER BY FIELD(id, ${placeholders})
    `;
        const [rows] = await db.query(sql, [...ids, ...ids]);

        res.json({ items: rows });
    });

    return router;
}

module.exports = aiRoutes;
