# JobEum Backend API

Node.js + Express로 개발한 잡이음 프로젝트 백엔드 API입니다.

---

## 🚀 실행 방법

1. 의존성 설치
   ```bash
   npm install

2. .env 파일 예시
DB_HOST=localhost
DB_USER=your_db_name
DB_PASSWORD=your_password
DB_NAME=jobeum
PORT=4000

3. 서버실행
node app.js

4. Base URL 
http://localhost:4000

5. 이번 엔드포인트 요약

채용공고 API
| 메서드    | URL            | 설명         |
| ------ | -------------- | ---------- |
| GET    | /api/jobs      | 채용공고 목록 조회 |
| GET    | /api/jobs/\:id | 채용공고 상세 조회 |
| POST   | /api/jobs      | 채용공고 등록    |
| PUT    | /api/jobs/\:id | 채용공고 수정    |
| DELETE | /api/jobs/\:id | 채용공고 삭제    |

기업회원 API
| 메서드  | URL                 | 설명         |
| ---- | ------------------- | ---------- |
| POST | /api/companies      | 기업회원 등록    |
| PUT  | /api/companies/\:id | 기업회원 정보 수정 |

6. 요청 바디 예시

채용공고 등록/수정
{
  "title": "백엔드 개발자 모집",
  "company": "잡이음 주식회사",
  "location": "서울 강남구",
  "deadline": "2025-12-31",
  "career": "경력 3년 이상",
  "education": "학력무관",
  "detail": "Node.js 백엔드 개발 업무",
  "summary": "함께 성장할 팀원",
  "condition": "유연 근무",
  "jobConditions": {
    "jobInterest": ["IT/프로그래밍"]
  },
  "image": "https://example.com/job-image.jpg"
}

기업회원 등록
{
  "company": "잡이음 주식회사",
  "biz_number": "123-45-67890",
  "manager": "홍길동",
  "email": "contact@jobeum.com",
  "phone": "02-1234-5678"
}

기업회원 수정
{
  "company": "잡이음 주식회사(수정본)",
  "biz_number": "123-45-67890",
  "manager": "이길동",
  "email": "info@jobeum.com",
  "phone": "02-0000-1111"
}

🛠️ 참고사항
- 모든 요청은 Content-Type: application/json으로 전송할것
- CORS 처리가 되어 있어 로컬 프론트에서 바로 요청할 수 있음
- 서버를 켜두면 프론트에서 axios 연동 테스트가 가능