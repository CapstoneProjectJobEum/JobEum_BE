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
            model: model || "groq/compound",
        });
        return chatCompletion.choices[0].message.content;
    } catch (error) {
        console.error("Groq로 요약 생성 중 오류 발생:", error);
        return null;
    }
};

// **새롭게 변경된 함수**: 특정 이력서에 대한 요약본을 생성하고 저장
const createSummaryForResume = async (resumeId) => {
    try {
        // 1. 데이터베이스에서 원본 정보 조회 (resumes 테이블만 사용)
        const [rows] = await db.query(
            `SELECT 
                user_id, name, birth, gender, phone, email,
                education_detail, career_detail, self_introduction, certificates, internship_activities, preferences_military
            FROM resumes
            WHERE id = ?`,
            [resumeId]
        );

        if (rows.length === 0) {
            console.log(`이력서 (ID: ${resumeId})를 찾을 수 없습니다.`);
            return;
        }

        const resume = rows[0];

        // 2. Groq API를 사용해 두 가지 요약 생성
        const shortPrompt = `다음 정보를 기반으로 인적 사항, 학력, 경력을 포함하여 3~5줄로 요약해줘. 추가적인 설명이나 서론/결론, 제목 없이 오직 요약 내용만 출력해.
        이름: ${resume.name}, 생년월일: ${resume.birth}, 성별: ${resume.gender}, 전화번호: ${resume.phone}, 이메일: ${resume.email}, 학력: ${resume.education_detail}, 경력: ${resume.career_detail}`;

        const fullPrompt = `다음 정보를 기반으로 자기소개서, 자격증, 인턴 및 대외활동, 취업 우대 사항 및 병역 정보를 포함하여 5~10줄로 요약해줘. 추가적인 설명이나 서론/결론, 제목 없이 오직 요약 내용만 출력해.
        자기소개서: ${resume.self_introduction}, 자격증: ${resume.certificates}, 인턴 및 대외활동: ${resume.internship_activities}, 취업 우대 및 병역: ${resume.preferences_military}`;

        const summaryShort = await generateSummary(shortPrompt, "groq/compound");
        const summaryFull = await generateSummary(fullPrompt, "groq/compound");

        if (!summaryFull || !summaryShort) {
            console.error(`이력서 (ID: ${resumeId}) 요약 생성에 실패했습니다.`);
            return;
        }

        // 3. 새로운 테이블(resumes_summaries)에 요약본 INSERT
        const [insertResult] = await db.query(
            `INSERT INTO resumes_summaries (resume_id, user_id, summary_short, summary_full) VALUES (?, ?, ?, ?)`,
            [resumeId, resume.user_id, summaryShort, summaryFull]
        );

        console.log(`이력서 (ID: ${resumeId}) 요약본이 성공적으로 생성되어 저장되었습니다.`);
        return { short: summaryShort, full: summaryFull };

    } catch (err) {
        console.error(`이력서 (ID: ${resumeId}) 요약 처리 중 오류 발생:`, err);
        return null;
    }
};

// **라우터**: 외부에서 요청할 때 사용 (기존 POST 엔드포인트)
router.post('/summary', async (req, res) => {
    const { id } = req.body;
    if (!id) {
        return res.status(400).json({ success: false, message: "이력서 ID가 필요합니다." });
    }

    const result = await createSummaryForResume(id);
    if (result) {
        res.json({ success: true, message: "요약본이 성공적으로 생성되어 저장되었습니다.", summary: result });
    } else {
        res.status(500).json({ success: false, message: "요약 생성에 실패했습니다." });
    }
});


router.get('/summary/resume/:resumeId', async (req, res) => {
    const resumeId = req.params.resumeId;

    if (!resumeId) {
        return res.status(400).json({ success: false, message: "resumeId가 필요합니다." });
    }

    try {
        const [rows] = await db.query(
            `SELECT summary_short, summary_full 
             FROM resumes_summaries 
             WHERE resume_id = ?`,
            [resumeId]
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
        console.error(`resumeId (${resumeId}) 요약 조회 중 오류 발생:`, err);
        res.status(500).json({ success: false, message: "요약 조회에 실패했습니다." });
    }
});

// **새롭게 변경된 exports**: 자동화 스크립트에서 사용
module.exports = {
    router,
    createSummaryForResume,
};