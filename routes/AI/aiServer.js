
const express = require("express");
const router = express.Router();
const axios = require("axios");

const PY_URL = process.env.PY_REC_URL || "http://localhost:5001"; // FastAPI 서버

// Python 학습 호출
router.post("/train", async (req, res) => {
    try {
        const payload = req.body; // user_profiles, user_activities, job_posts
        const response = await axios.post(`${PY_URL}/train`, payload);
        res.json({ message: "Python 학습 요청 완료", data: response.data });
    } catch (err) {
        console.error("Python 학습 요청 실패:", err.message);
        res.status(500).json({ error: "Python 학습 요청 실패" });
    }
});

// 추천 결과 가져오기
router.get("/recommend/:userId", async (req, res) => {
    try {
        const { userId } = req.params;
        const k = req.query.k || 10;
        const response = await axios.get(`${PY_URL}/recommend/${userId}?k=${k}`);
        res.json({ userId, recommendations: response.data.recommendations });
    } catch (err) {
        console.error("추천 가져오기 실패:", err.message);
        res.status(500).json({ error: "추천 가져오기 실패" });
    }
});

module.exports = router;
