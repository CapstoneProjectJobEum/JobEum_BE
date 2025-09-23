const express = require('express');
const router = express.Router();
const db = require('../../db');
const { CohereClient } = require("cohere-ai");

const COHERE_API_KEY = process.env.COHERE_API_KEY;
if (!COHERE_API_KEY) {
    console.error("COHERE_API_KEY가 환경 변수에 설정되지 않았습니다.");
    process.exit(1);
}

const cohere = new CohereClient({ token: COHERE_API_KEY });

/** 문자열 정규화 */
const normalize = str => str.replace(/\s/g, '').replace('·', '');

/** 텍스트 임베딩 */
const getEmbeddings = async (texts) => {
    if (!texts || texts.length === 0) return null;
    const response = await cohere.embed({
        texts,
        model: "embed-multilingual-v3.0",
        inputType: "search_document"
    });
    return response.embeddings;
};

/** 코사인 유사도 계산 */
const cosineSimilarity = (vec1, vec2) => {
    if (!vec1 || !vec2) return 0;
    let dot = 0, mag1 = 0, mag2 = 0;
    for (let i = 0; i < vec1.length; i++) {
        dot += vec1[i] * vec2[i];
        mag1 += vec1[i] ** 2;
        mag2 += vec2[i] ** 2;
    }
    mag1 = Math.sqrt(mag1);
    mag2 = Math.sqrt(mag2);
    if (mag1 === 0 || mag2 === 0) return 0;
    return dot / (mag1 * mag2);
};

/** 사용자 추천 생성 (job_summaries × resumes_summaries) */
const generateApplicationRecommendations = async () => {
    try {
        const [applications] = await db.query(`
            SELECT a.id AS application_id, a.user_id, a.job_id, a.resume_id,
                   j.summary_full AS job_summary, r.summary_full AS resume_summary,
                   jp.user_id AS company_id
            FROM applications a
            JOIN job_summaries j ON j.job_post_id = a.job_id
            JOIN resumes_summaries r ON r.id = a.resume_id
            JOIN job_post jp ON jp.id = a.job_id
        `);

        if (!applications.length) return [];

        const jobTexts = applications.map(a => a.job_summary);
        const resumeTexts = applications.map(a => a.resume_summary);

        const [jobEmbeddings, resumeEmbeddings] = await Promise.all([
            getEmbeddings(jobTexts),
            getEmbeddings(resumeTexts)
        ]);

        const recommendations = applications.map((app, idx) => {
            const score = cosineSimilarity(jobEmbeddings[idx], resumeEmbeddings[idx]);
            return {
                user_id: app.user_id,
                job_post_id: app.job_id,
                company_id: app.company_id,
                score
            };
        });

        const sortedRecommendations = recommendations.sort((a, b) => b.score - a.score);

        const insertValues = sortedRecommendations.map(r => [r.user_id, r.job_post_id, r.company_id, r.score]);
        if (insertValues.length > 0) {
            await db.query(`
                INSERT INTO application_recommendations (user_id, job_post_id, company_id, score)
                VALUES ?
                ON DUPLICATE KEY UPDATE score = VALUES(score)
            `, [insertValues]);
        }

        console.log(`총 추천 수: ${recommendations.length}, DB 저장 완료`);
        return recommendations;

    } catch (err) {
        console.error("추천 생성 오류:", err);
        return [];
    }
};


// 라우터
router.get('/application-recommendations', async (req, res) => {
    try {
        const recs = await generateApplicationRecommendations();
        if (!recs || recs.length === 0) {
            return res.status(404).json({ success: false, message: "추천 목록 없음" });
        }
        res.json({ success: true, recommendations: recs });
    } catch (err) {
        console.error("추천 생성 오류:", err);
        res.status(500).json({ success: false, message: "추천 생성 실패" });
    }
});

// 기업 ID 기준 추천 조회
router.get('/by-company/:companyId', async (req, res) => {
    const companyId = req.params.companyId;
    if (!companyId) return res.status(400).json({ success: false, message: "회사 ID 필요" });

    try {
        const [rows] = await db.query(
            // company_id를 사용해 모든 추천 데이터 조회
            'SELECT user_id, job_post_id, score FROM application_recommendations WHERE company_id = ? ORDER BY score DESC',
            [companyId]
        );

        if (!rows || rows.length === 0) {
            return res.status(404).json({ success: false, message: "추천 목록 없음" });
        }

        res.json({ success: true, recommendations: rows });
    } catch (err) {
        console.error("추천 공고 조회 오류:", err);
        res.status(500).json({ success: false, message: "추천 공고 조회 실패" });
    }
});



module.exports = { router, generateApplicationRecommendations };
