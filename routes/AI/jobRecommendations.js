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
const normalize = str => {
    return str
        .replace(/\s/g, '') // 공백 제거
        .replace(/[‧·・\-–/]/g, '') // 각종 가운데점, 하이픈, 슬래시 등 구분자 제거
        .toUpperCase(); // (선택적) 대문자 통일
};

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

// 직무 계열 매핑
const jobTypeMap = {
    SW앱개발: [
        '프론트엔드 개발자', '백엔드 개발자', '소프트웨어 엔지니어',
        '웹 접근성 개발자', '자바 개발자', '모바일 앱 개발자'
    ],
    웹디자인: [
        '웹디자이너', 'UI‧UX 디자이너', '퍼블리셔', '상세페이지 디자이너',
        '그래픽 디자이너', '영상 편집 디자이너'
    ],
    경영사무: [
        '사무 행정원', '회계 보조원', '경리 사무원', '인사‧총무 지원',
        '문서 관리원', '법률 사무 보조'
    ],
    데이터QA: [
        '데이터 라벨러', '데이터 입력원', '데이터 매니저(AI 학습)',
        '웹 접근성 평가사', '게임 QA 테스터', '품질 검수원'
    ],
    고객상담: [
        '인바운드 콜센터 상담사', '온라인 채팅 상담원', '고객 지원(CS) 요원',
        '텔레마케터', '전화 모니터링 요원'
    ],
    마케팅홍보: [
        '온라인 홍보 마케터', 'SNS 콘텐츠 관리자', '마케팅 기획 보조',
        '광고 배너 관리원', '바이럴 마케팅 보조'
    ],
    헬스복지: [
        '안마사‧헬스키퍼', '사회복지 행정 보조', '병원 행정 사무원',
        '요양 보호 보조', '의료 서비스 지원가'
    ],
    제조생산: [
        '제품 조립원', '생산품 포장‧검수원', '반도체 생산 보조',
        '구두 제작‧수선', '친환경 제품 검수원'
    ],
    예술창작: [
        '시각 예술 작가', '웹소설‧만화 스토리 작가', '디지털 콘텐츠 제작자',
        '공예(도예, 목공) 작가', '웹툰 어시스턴트'
    ],
    교육지원: [
        '특수교육 실무사', '사서 보조원', '직업재활 훈련 보조',
        '장애인 평생교육 보조교사', '장애인 채용 컨설턴트 보조'
    ]
};

// 사용자 관심 계열 가져오기
const getUserInterestCategories = (userJobInterestStr) => {
    const interests = userJobInterestStr.split(',').map(s => s.trim());
    const categories = new Set();

    interests.forEach(interest => {
        for (const [category, jobs] of Object.entries(jobTypeMap)) {
            if (jobs.some(jobTitle => normalize(jobTitle) === normalize(interest)) || normalize(category) === normalize(interest)) {
                categories.add(category);
            }
        }
    });

    return Array.from(categories);
};

// 규칙 기반 점수 계산
const getRuleBasedScore = (userProfile, jobPost) => {
    if (!userProfile || !jobPost || !jobPost.personalized) return 0;

    const jp = jobPost.personalized;
    let score = 0;

    const userJobCategories = userProfile.job_interest.split(',').map(s => s.trim());
    if (jp.jobInterest && userJobCategories.some(j => jp.jobInterest.includes(j))) score += 1;

    const userDisabilities = userProfile.disability_types.split(',').map(s => s.trim());
    if (jp.disabilityTypes && userDisabilities.some(d => jp.disabilityTypes.includes(d))) score += 0.5;

    if (jp.disabilityGrade && jp.disabilityGrade.includes(userProfile.disability_grade)) score += 0.3;

    const userDevices = userProfile.assistive_devices.split(',').map(s => s.trim());
    if (jp.assistiveDevices && userDevices.some(dev => jp.assistiveDevices.includes(dev))) score += 0.2;

    const userWorkTypes = userProfile.preferred_work_type.split(',').map(s => s.trim());
    if (jp.preferredWorkType && userWorkTypes.some(wt => jp.preferredWorkType.includes(wt))) score += 0.2;

    return score;
};

// 추천 생성
const generateRecommendationsForUser = async (userId, TOP_N = 20) => {
    try {
        const [userActivity] = await db.query('SELECT * FROM user_activity WHERE user_id = ?', [userId]);
        const [userProfile] = await db.query('SELECT * FROM user_profile WHERE user_id = ?', [userId]);
        const [jobSummaries] = await db.query('SELECT * FROM job_summaries;');
        const [jobPosts] = await db.query('SELECT id, title, personalized FROM job_post;');

        if (!userProfile[0]) {
            console.error(`사용자 ID ${userId} 프로필 없음`);
            return null;
        }

        const allJobTexts = jobSummaries.map(s => s.summary_full);
        const jobEmbeddings = await getEmbeddings(allJobTexts);
        const jobVectorMap = new Map();
        jobSummaries.forEach((summary, idx) => jobVectorMap.set(summary.job_post_id, jobEmbeddings[idx]));

        const activityWeights = { application_status: 3, bookmark_job: 2, bookmark_company: 1, recent_view_job: 0.5 };
        const weightedVectorSum = new Array(jobEmbeddings[0].length).fill(0);
        let totalWeight = 0;

        for (const activity of userActivity) {
            const jobVector = jobVectorMap.get(activity.target_id);
            const weight = activityWeights[activity.activity_type] || 0;
            if (jobVector && weight > 0) {
                for (let i = 0; i < jobVector.length; i++) weightedVectorSum[i] += jobVector[i] * weight;
                totalWeight += weight;
            }
        }

        const userProfileVector = totalWeight > 0 ? weightedVectorSum.map(v => v / totalWeight) : null;
        if (!userProfileVector) return null;

        const userCategories = getUserInterestCategories(userProfile[0].job_interest);
        console.log("사용자 계열:", userCategories);

        const filteredJobPosts = jobPosts.filter(jobPost => {
            const jpCategories = jobPost.personalized?.jobInterest || [];
            console.log(`공고 [${jobPost.id} - ${jobPost.title}] 계열:`, jpCategories);
            const match = jpCategories.some(cat => userCategories.some(uCat => normalize(uCat) === normalize(cat)));
            console.log(`매칭 여부: ${match}`);
            return match;
        });

        const recommendations = filteredJobPosts.map(jobPost => {
            const jobVector = jobVectorMap.get(jobPost.id);
            const embeddingScore = jobVector ? cosineSimilarity(userProfileVector, jobVector) : 0;
            const ruleScore = getRuleBasedScore(userProfile[0], jobPost);
            console.log(`공고 [${jobPost.id}] embeddingScore: ${embeddingScore.toFixed(3)}, ruleScore: ${ruleScore.toFixed(3)}`);
            return { id: jobPost.id, title: jobPost.title, finalScore: embeddingScore + (ruleScore * 0.2), embeddingScore, ruleScore };
        }).sort((a, b) => b.finalScore - a.finalScore);

        const valuesToInsert = recommendations.slice(0, TOP_N).map(rec => [userId, rec.id, rec.finalScore]);
        await db.query('DELETE FROM user_recommendations WHERE user_id = ?', [userId]);
        if (valuesToInsert.length > 0) {
            await db.query('INSERT INTO user_recommendations (user_id, job_post_id, score) VALUES ?', [valuesToInsert]);
        }

        console.log(`총 추천 공고: ${recommendations.length}, DB 저장: ${valuesToInsert.length}`);
        return recommendations;

    } catch (error) {
        console.error(`추천 시스템 오류 (User ID: ${userId}):`, error);
        return null;
    }
};

// 라우터
router.get('/recommendations/:userId', async (req, res) => {
    const userId = req.params.userId;
    if (!userId) return res.status(400).json({ success: false, message: "사용자 ID 필요" });

    const recommendations = await generateRecommendationsForUser(userId);
    if (recommendations) res.json({ success: true, recommendations });
    else res.status(500).json({ success: false, message: "추천 생성 실패" });
});

router.get('/recommendations/:userId/list', async (req, res) => {
    const userId = req.params.userId;
    if (!userId) return res.status(400).json({ success: false, message: "사용자 ID 필요" });

    try {
        const [recommendations] = await db.query(
            `SELECT * FROM job_post AS j
             JOIN user_recommendations AS r ON r.job_post_id = j.id
             WHERE r.user_id = ? ORDER BY r.score DESC`, [userId]
        );
        if (recommendations.length === 0) return res.status(404).json({ success: false, message: "추천 목록 없음" });
        res.json({ success: true, recommendations });
    } catch (err) {
        console.error("추천 공고 조회 오류:", err);
        res.status(500).json({ success: false, message: "추천 공고 조회 실패" });
    }
});

module.exports = { router, generateRecommendationsForUser };
