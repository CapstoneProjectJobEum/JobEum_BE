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
            model: model || "groq/compound",
        });
        return chatCompletion.choices[0].message.content;
    } catch (error) {
        console.error("Groq로 요약 생성 중 오류 발생:", error);
        return null;
    }
};

// 수정된 함수: summaryShort는 고정, summaryFull은 자기소개서 첨삭
const createResumeEditingSummary = async (resumeId) => {
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
        다음 자기소개서를 읽고 개선하면 좋을 점과 개선 포인트를 3~5문장으로 요약해 주세요.
        - 불필요한 서론/결론은 제거
        - 문장 구조와 표현을 자연스럽게 다듬는 방법 제안
        - 핵심 내용과 강점을 더 강조할 방법 제안
        - 문법이나 표현 오류 수정 제안
        - 실제 첨삭본을 만들 필요는 없고, '고치면 좋을 점' 중심으로 설명

        자기소개서:
        ${resume.self_introduction}
        `;

        const summaryFull = await generateSummary(fullPrompt, "groq/compound");

        if (!summaryFull) {
            console.error(`이력서 (ID: ${resumeId}) 자기소개서 첨삭에 실패했습니다.`);
            return;
        }

        // summaryShort는 고정 문자열
        const summaryShort = `${resume.title}의 첨삭 내용`;

        await db.query(
            `INSERT INTO resumes_editing_summaries (resume_id, user_id, summary_short, summary_full) VALUES (?, ?, ?, ?)`,
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
router.post('/editing', async (req, res) => {
    const { id } = req.body;
    if (!id) return res.status(400).json({ success: false, message: "이력서 ID가 필요합니다." });

    const result = await createResumeEditingSummary(id);
    if (result) {
        res.json({ success: true, message: "요약본이 성공적으로 생성되어 저장되었습니다.", summary: result });
    } else {
        res.status(500).json({ success: false, message: "요약 생성에 실패했습니다." });
    }
});

// GET 엔드포인트
router.get('/editing/resume/:resumeId', async (req, res) => {
    const resumeId = req.params.resumeId;
    if (!resumeId) return res.status(400).json({ success: false, message: "resumeId가 필요합니다." });

    try {
        const [rows] = await db.query(
            `SELECT summary_short, summary_full FROM resumes_editing_summaries WHERE resume_id = ?`,
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
    createResumeEditingSummary,
};
