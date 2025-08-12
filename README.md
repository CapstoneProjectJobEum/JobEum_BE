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

🛠️ 참고사항
- 모든 요청은 Content-Type: application/json으로 전송할것
- CORS 처리가 되어 있어 로컬 프론트에서 바로 요청할 수 있음
- 서버를 켜두면 프론트에서 axios 연동 테스트가 가능