const express = require('express');
const router = express.Router();
const db = require('../../db');
const Groq = require('groq-sdk');

const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!GROQ_API_KEY) {
    console.error("GROQ_API_KEY가 환경 변수에 설정되지 않았습니다.");
    process.exit(1);
}

const groqClient = new Groq({
    apiKey: GROQ_API_KEY,
});

const generateSummary = async (prompt, model) => {
    try {
        const chatCompletion = await groqClient.chat.completions.create({
            messages: [{ "role": "user", "content": prompt }],
            model: model || "openai/gpt-oss-120b",
        });
        return chatCompletion.choices[0].message.content;
    } catch (error) {
        console.error("Groq로 요약 생성 중 오류 발생:", error);
        return null;
    }
};

// **새롭게 추가된 함수**: 특정 공고에 대한 요약본을 생성하고 저장
const createSummaryForJob = async (jobId) => {
    try {
        // 1. 데이터베이스에서 원본 정보 조회
        const [rows] = await db.query(
            `SELECT user_id, company, title, deadline, detail, preferred_skills, working_conditions 
            FROM job_post 
            WHERE id = ?`,
            [jobId]
        );

        if (rows.length === 0) {
            console.log(`채용 공고 (ID: ${jobId})를 찾을 수 없습니다.`);
            return;
        }

        const job = rows[0];

        const shortPrompt = `
        다음 정보를 기반으로 **어떤 서론, 설명, 헤더(Reasoning, Result, 최종 요약 등)도 없이, 오직 하나의 문장**만 출력해.

        **반드시 지켜야 할 문장 형태:**
        [회사명]은 [채용공고 제목]을 [YYYY년 MM월 DD일]까지 채용합니다.

        회사: ${job.company}, 채용공고 제목: ${job.title}, 마감일: ${job.deadline}
        `;

        // 2. Groq API를 사용해 두 가지 요약 생성
        const fullPrompt = `
        다음 정보를 기반으로 어떤 서론, 설명, 헤더(Reasoning, Result, 최종 요약 등) 없이, **반드시 3개의 문장으로만 구성된 요약**을 출력해 주세요. 각 문장은 아래 지정된 내용을 포함해야 합니다.

        **반드시 지켜야 할 문장 형태 (총 3문장):**
        1. **[회사]**가 **[핵심 직무]** 포지션에 원하는 **핵심 업무 내용 및 비전**을 1문장으로 요약합니다.
        2. 이 포지션에서 요구하는 **필수 및 우대 기술/경험**을 나열하고 강조하며 1문장으로 요약합니다.
        3. 지원자에게 제공되는 **가장 매력적인 주요 복지 및 근무 조건**을 1문장으로 요약합니다.

        채용 상세 내용: ${job.detail}
        필요 기술 및 우대 사항: ${job.preferred_skills}
        복지 조건: ${job.working_conditions}
        `;

        const summaryShort = await generateSummary(shortPrompt, "openai/gpt-oss-120b");

        const summaryFull = await generateSummary(fullPrompt, "openai/gpt-oss-120b");

        if (!summaryFull || !summaryShort) {
            console.error(`채용 공고 (ID: ${jobId}) 요약 생성에 실패했습니다.`);
            return;
        }

        // 3. 새로운 테이블에 요약본 INSERT
        const [insertResult] = await db.query(
            `INSERT INTO job_summaries (job_post_id, user_id, summary_short, summary_full) VALUES (?, ?, ?, ?)`,
            [jobId, job.user_id, summaryShort, summaryFull]
        );

        console.log(`채용 공고 (ID: ${jobId}) 요약본이 성공적으로 생성되어 저장되었습니다.`);
        return { short: summaryShort, full: summaryFull };

    } catch (err) {
        console.error(`채용 공고 (ID: ${jobId}) 요약 처리 중 오류 발생:`, err);
        return null;
    }
};

// **라우터**: 외부에서 요청할 때 사용 (기존 POST 엔드포인트)
router.post('/', async (req, res) => {
    const { id } = req.body;
    if (!id) {
        return res.status(400).json({ success: false, message: "공고 ID가 필요합니다." });
    }

    const result = await createSummaryForJob(id);
    if (result) {
        res.json({ success: true, message: "요약본이 성공적으로 생성되어 저장되었습니다.", summary: result });
    } else {
        res.status(500).json({ success: false, message: "요약 생성에 실패했습니다." });
    }
});


router.get('/job/:jobPostId', async (req, res) => {
    const jobPostId = req.params.jobPostId;

    if (!jobPostId) {
        return res.status(400).json({ success: false, message: "job_post_id가 필요합니다." });
    }

    try {
        const [rows] = await db.query(
            `SELECT summary_short, summary_full 
             FROM job_summaries 
             WHERE job_post_id = ?`,
            [jobPostId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: "저장된 요약이 없습니다." });
        }

        res.json({
            success: true,
            summary: {
                short: rows[0].summary_short,
                full: rows[0].summary_full
            }
        });

    } catch (err) {
        console.error(`job_post_id (${jobPostId}) 요약 조회 중 오류 발생:`, err);
        res.status(500).json({ success: false, message: "요약 조회에 실패했습니다." });
    }
});

// **새롭게 추가된 exports**: 자동화 스크립트에서 사용
module.exports = {
    router,
    createSummaryForJob,
};