// JobEumBackend/routes/ai.js

const express = require("express");
const router = express.Router();

// 임시 메모리 캐시 (추후 DB 또는 Redis로 교체 가능)
const aiCache = {
    userProfiles: [],
    userActivities: {},
    jobPosts: []
};

router.post("/data", async (req, res) => {
    try {
        const { timestamp, user_profiles, user_activities, job_posts } = req.body;

        console.log("📌 AI 서버에서 데이터 수신됨:", timestamp);
        console.log("user_profiles 개수:", user_profiles.length);
        console.log("user_activities 유저 수:", Object.keys(user_activities).length);
        console.log("job_posts 개수:", job_posts.length);

        // 1) 받은 데이터를 임시 캐시에 저장
        aiCache.userProfiles = user_profiles;
        aiCache.userActivities = user_activities;
        aiCache.jobPosts = job_posts;

        // 2) 필요하면 DB에 저장 가능 (추가 코드 필요)
        // 3) 학습 API 호출 가능

        res.json({ message: "데이터 수신 성공" });
    } catch (err) {
        console.error("AI 데이터 처리 실패:", err);
        res.status(500).json({ error: "AI 데이터 처리 실패" });
    }
});

// 다른 모듈에서 캐시 데이터 가져가기
router.get("/cache", (req, res) => {
    res.json(aiCache);
});

module.exports = router;
