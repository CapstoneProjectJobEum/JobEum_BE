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
        const shortPrompt = `
        다음 정보를 기반으로 어떤 서론, 설명, 결론, 헤더(Reasoning, Result, 최종 요약 등) 없이, 오직 **4개의 간결하고 독립적인 문장**으로만 요약 내용을 출력해 주세요. 모든 문장은 반드시 아래 지정된 내용을 포괄해야 합니다.

        **반드시 지켜야 할 문장 형태 (총 4문장):**
        1. **[인적 사항]** 지원자의 **이름, 생년월일, 성별** 정보를 모두 포함하여 제시하는 문장입니다. (예: 홍길동(남, 1990년 1월 1일생)입니다.)
        2. **[연락처]** 지원자의 **전화번호와 이메일 주소**를 모두 포함하여 연락처 정보를 제시하는 문장입니다. (예: 연락처는 010-XXXX-XXXX이며, 이메일은 XXXX@email.com입니다.)
        3. **[학력]** 지원자의 **최종 학력 상세 정보**를 제시하는 문장입니다. (예: 최종 학력은 OOO대학교 컴퓨터공학과 졸업입니다.)
        4. **[경력]** 지원자가 보유한 **모든 주요 경력 정보**를 요약하여 제시하는 문장입니다. (예: 총 X년의 개발 경력이 있으며, React Native, Java 등 특정 기술을 활용한 다양한 프로젝트 경험을 보유하고 있습니다.)

        이름: ${resume.name}, 생년월일: ${resume.birth}, 성별: ${resume.gender}, 전화번호: ${resume.phone}, 이메일: ${resume.email}, 학력: ${resume.education_detail}, 경력: ${resume.career_detail}
        `;

        const fullPrompt = `
        다음 정보를 기반으로 어떤 서론, 설명, 결론, 헤더(Reasoning, Result, 최종 요약 등) 없이, 오직 **5개의 문단(총 5문장)**으로만 요약 내용을 출력해 주세요. 각 문장은 **지정된 정보 블록**을 핵심적으로 요약해야 하며, 불필요한 수식어 없이 간결해야 합니다.

        **반드시 지켜야 할 문장 형태 (총 5문장):**
        1. **[자기소개서_핵심강점]** 지원자가 강조하는 **핵심 역량 및 커리어 비전**을 1문장으로 요약합니다.
        2. **[자기소개서_경험요약]** 자기소개서에 언급된 **주요 실무 또는 프로젝트 경험**을 1문장으로 구체적으로 요약합니다.
        3. **[자격증]** 지원자가 보유한 **모든 주요 자격증 및 인증 사항**을 1문장으로 나열하여 제시합니다.
        4. **[활동]** 지원자가 참여한 **인턴십, 대외 활동 또는 경연대회** 중 가장 주요한 1~2가지를 1문장으로 요약합니다.
        5. **[기타 정보]** 지원자의 **취업 우대 사항 및 병역 사항**을 1문장으로 명확하게 정리하여 제시합니다.

        자기소개서: ${resume.self_introduction}
        자격증: ${resume.certificates}
        인턴 및 대외활동: ${resume.internship_activities}
        취업 우대 및 병역: ${resume.preferences_military}
        `;

        const summaryShort = await generateSummary(shortPrompt, "openai/gpt-oss-120b");
        const summaryFull = await generateSummary(fullPrompt, "openai/gpt-oss-120b");

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
router.post('/', async (req, res) => {
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


router.get('/resume/:resumeId', async (req, res) => {
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