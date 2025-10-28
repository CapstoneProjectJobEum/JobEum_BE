const express = require('express');
const router = express.Router();
const db = require('../../db');
const Groq = require('groq-sdk');

const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!GROQ_API_KEY) {
    console.error("GROQ_API_KEY가 환경 변수에 설정되지 않았습니다.");
    process.exit(1);
}

const groqClient = new Groq({ apiKey: GROQ_API_KEY });

const generateSummary = async (prompt, model) => {
    try {
        const chatCompletion = await groqClient.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: model || "openai/gpt-oss-120b",
        });
        return chatCompletion.choices[0].message.content;
    } catch (error) {
        console.error("Groq로 요약 생성 중 오류 발생:", error);
        return null;
    }
};

// 수정된 함수: summaryShort는 고정, summaryFull은 자기소개서 첨삭
const createResumeReviewSummary = async (resumeId) => {
    try {
        const [rows] = await db.query(
            `SELECT user_id, title, self_introduction FROM resumes WHERE id = ?`,
            [resumeId]
        );

        if (rows.length === 0) {
            console.log(`이력서 (ID: ${resumeId})를 찾을 수 없습니다.`);
            return;
        }

        const resume = rows[0];

        // summaryFull 생성
        const fullPrompt = `
        당신은 취업 컨설턴트입니다. 다음 자기소개서를 읽고 **어떤 서론, 결론, 설명, 헤더(Reasoning, Result 등) 없이, 오직 4개의 핵심 문장**으로만 개선 포인트를 요약하여 출력해 주세요.

        **반드시 지켜야 할 문장 형태 (총 4문장):**
        1. **[구조/흐름]** 지원자의 경험을 더 효과적으로 전달하기 위해 **불필요한 서론/결론 제거 및 문단 구성을 어떻게 조정**해야 하는지 1문장으로 제안합니다.
        2. **[강점/강조]** 지원자의 **핵심 경험과 기술(IT/개발 역량 등)**을 자기소개서 전반에서 어떻게 더 구체적인 성과나 수치로 강조**할 수 있는지** 1문장으로 제안합니다.
        3. **[표현/어조]** 현재 문장 구조나 표현 중 **더 자연스럽고 전문적인 어조로 다듬어야 할 부분**과 그 방법을 1문장으로 제안합니다.
        4. **[문법/오류]** 발견된 **명백한 문법적/맞춤법 오류나 어색한 표현**을 구체적으로 지적하고 수정 포인트를 1문장으로 제시합니다.

        자기소개서:
        ${resume.self_introduction}
        `;

        const summaryFull = await generateSummary(fullPrompt, "openai/gpt-oss-120b");

        if (!summaryFull) {
            console.error(`이력서 (ID: ${resumeId}) 자기소개서 첨삭에 실패했습니다.`);
            return;
        }

        // summaryShort는 고정 문자열
        const summaryShort = `${resume.title}의 첨삭 내용`;

        await db.query(
            `INSERT INTO resumes_review_summaries (resume_id, user_id, summary_short, summary_full) VALUES (?, ?, ?, ?)`,
            [resumeId, resume.user_id, summaryShort, summaryFull]
        );

        console.log(`이력서 (ID: ${resumeId}) 요약본이 성공적으로 생성되어 저장되었습니다.`);
        return { short: summaryShort, full: summaryFull };

    } catch (err) {
        console.error(`이력서 (ID: ${resumeId}) 요약 처리 중 오류 발생:`, err);
        return null;
    }
};

// POST 엔드포인트
router.post('/', async (req, res) => {
    const { id } = req.body;
    if (!id) return res.status(400).json({ success: false, message: "이력서 ID가 필요합니다." });

    const result = await createResumeReviewSummary(id);
    if (result) {
        res.json({ success: true, message: "요약본이 성공적으로 생성되어 저장되었습니다.", summary: result });
    } else {
        res.status(500).json({ success: false, message: "요약 생성에 실패했습니다." });
    }
});

// GET 엔드포인트
router.get('/resume/:resumeId', async (req, res) => {
    const resumeId = req.params.resumeId;
    if (!resumeId) return res.status(400).json({ success: false, message: "resumeId가 필요합니다." });

    try {
        const [rows] = await db.query(
            `SELECT summary_short, summary_full FROM resumes_review_summaries WHERE resume_id = ?`,
            [resumeId]
        );

        if (rows.length === 0) return res.status(404).json({ success: false, message: "저장된 요약이 없습니다." });

        res.json({
            success: true,
            summary: {
                short: rows[0].summary_short,
                full: rows[0].summary_full
            }
        });

    } catch (err) {
        console.error(`resumeId (${resumeId}) 요약 조회 중 오류 발생:`, err);
        res.status(500).json({ success: false, message: "요약 조회에 실패했습니다." });
    }
});

module.exports = {
    router,
    createResumeReviewSummary,
};
