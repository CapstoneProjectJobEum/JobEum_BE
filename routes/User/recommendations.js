const express = require('express');
const router = express.Router();
const db = require('../../db');
const { CohereClient } = require("cohere-ai");

const COHERE_API_KEY = process.env.COHERE_API_KEY;

if (!COHERE_API_KEY) {
    console.error("COHERE_API_KEY가 환경 변수에 설정되지 않았습니다.");
    process.exit(1);
}

const cohere = new CohereClient({
    token: COHERE_API_KEY,
});

/**
 * 텍스트를 임베딩하는 함수
 */
const getEmbeddings = async (texts) => {
    if (!texts || texts.length === 0) return null;
    const response = await cohere.embed({
        texts: texts,
        model: "embed-multilingual-v3.0",
        inputType: "search_document"
    });
    return response.embeddings;
};

/**
 * 두 벡터 간의 코사인 유사도 계산
 */
const cosineSimilarity = (vec1, vec2) => {
    if (!vec1 || !vec2) return 0;
    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;
    for (let i = 0; i < vec1.length; i++) {
        dotProduct += vec1[i] * vec2[i];
        magnitude1 += vec1[i] ** 2;
        magnitude2 += vec2[i] ** 2;
    }
    magnitude1 = Math.sqrt(magnitude1);
    magnitude2 = Math.sqrt(magnitude2);
    if (magnitude1 === 0 || magnitude2 === 0) return 0;
    return dotProduct / (magnitude1 * magnitude2);
};

/**
 * 규칙 기반 점수 계산 (Personalized 필드 매칭)
 */
const getRuleBasedScore = (userProfile, jobPost) => {
    if (!userProfile || !jobPost || !jobPost.personalized) return 0;

    // 이미 객체이므로 JSON.parse()를 제거합니다.
    const jobPersonalized = jobPost.personalized;
    let matchCount = 0;

    if (userProfile.job_interest && jobPersonalized.jobInterest &&
        userProfile.job_interest.split(',').some(interest => jobPersonalized.jobInterest.includes(interest.trim()))) {
        matchCount++;
    }
    if (userProfile.disability_types && jobPersonalized.disabilityTypes &&
        userProfile.disability_types.split(',').some(type => jobPersonalized.disabilityTypes.includes(type.trim()))) {
        matchCount++;
    }
    if (userProfile.preferred_work_type && jobPersonalized.preferredWorkType &&
        userProfile.preferred_work_type.split(',').some(workType => jobPersonalized.preferredWorkType.includes(workType.trim()))) {
        matchCount++;
    }
    return matchCount > 0 ? 1 : 0;
};

/**
 * 모든 사용자에 대한 추천을 생성하고 DB에 저장
 */
const generateRecommendationsForUser = async (userId) => {
    try {
        const [userActivity] = await db.query('SELECT * FROM user_activity WHERE user_id = ?', [userId]);
        const [userProfile] = await db.query('SELECT * FROM user_profile WHERE user_id = ?', [userId]);
        const [jobSummaries] = await db.query('SELECT * FROM job_summaries;');
        const [jobPosts] = await db.query('SELECT id, title, personalized FROM job_post;');

        if (userProfile.length === 0) {
            console.error(`사용자 ID ${userId}의 프로필을 찾을 수 없습니다.`);
            return null;
        }

        const allJobTexts = jobSummaries.map(summary => summary.summary_full);
        const jobEmbeddings = await getEmbeddings(allJobTexts);
        const jobVectorMap = new Map();
        jobSummaries.forEach((summary, index) => {
            jobVectorMap.set(summary.job_post_id, jobEmbeddings[index]);
        });

        const activityWeights = {
            'application_status': 3,
            'bookmark_job': 2,
            'bookmark_company': 1,
            'recent_view_job': 1
        };

        const weightedVectorSum = new Array(jobEmbeddings[0].length).fill(0);
        let totalWeight = 0;

        for (const activity of userActivity) {
            const jobVector = jobVectorMap.get(activity.target_id);
            const weight = activityWeights[activity.activity_type] || 0;

            if (jobVector && weight > 0) {
                for (let i = 0; i < jobVector.length; i++) {
                    weightedVectorSum[i] += jobVector[i] * weight;
                }
                totalWeight += weight;
            }
        }

        const userProfileVector = totalWeight > 0 ? weightedVectorSum.map(val => val / totalWeight) : null;

        if (!userProfileVector) {
            console.error(`사용자 ID ${userId}의 활동 데이터가 부족합니다.`);
            return null;
        }

        const recommendations = jobPosts.map(jobPost => {
            const jobVector = jobVectorMap.get(jobPost.id);
            const embeddingScore = jobVector ? cosineSimilarity(userProfileVector, jobVector) : 0;
            const ruleScore = getRuleBasedScore(userProfile[0], jobPost);
            const finalScore = embeddingScore + (ruleScore * 0.2);

            return {
                id: jobPost.id,
                title: jobPost.title,
                finalScore: finalScore,
                embeddingScore: embeddingScore,
                ruleScore: ruleScore
            };
        }).sort((a, b) => b.finalScore - a.finalScore);

        const valuesToInsert = recommendations.map(rec => [userId, rec.id, rec.finalScore]);

        await db.query('DELETE FROM user_recommendations WHERE user_id = ?', [userId]);

        if (valuesToInsert.length > 0) {
            await db.query(
                'INSERT INTO user_recommendations (user_id, job_post_id, score) VALUES ?',
                [valuesToInsert]
            );
        }

        console.log(`[추천] 사용자 ID ${userId}의 추천 목록 ${valuesToInsert.length}개가 성공적으로 저장되었습니다.`);

        return recommendations;

    } catch (error) {
        console.error(`추천 시스템 오류 발생 (User ID: ${userId}):`, error);
        return null;
    }
};

router.get('/recommendations/:userId', async (req, res) => {
    const userId = req.params.userId;

    if (!userId) {
        return res.status(400).json({ success: false, message: "사용자 ID가 필요합니다." });
    }

    const recommendations = await generateRecommendationsForUser(userId);

    if (recommendations) {
        res.json({ success: true, recommendations });
    } else {
        res.status(500).json({ success: false, message: "추천 생성에 실패했습니다." });
    }
});

router.get('/recommendations/:userId/list', async (req, res) => {
    const userId = req.params.userId;

    if (!userId) {
        return res.status(400).json({ success: false, message: "사용자 ID가 필요합니다." });
    }

    try {
        const [recommendations] = await db.query(
            `SELECT *
            FROM job_post AS j
            JOIN user_recommendations AS r ON r.job_post_id = j.id
            WHERE r.user_id = ?
            ORDER BY r.score DESC`,
            [userId]
        );


        if (recommendations.length === 0) {
            return res.status(404).json({ success: false, message: "추천 목록을 찾을 수 없습니다." });
        }

        res.json({ success: true, recommendations });

    } catch (err) {
        console.error("추천 공고 조회 중 오류 발생:", err);
        res.status(500).json({ success: false, message: "추천 공고를 가져오는 데 실패했습니다." });
    }
});


module.exports = {
    router,
    generateRecommendationsForUser,
};