# LLM Chatbot - Go + PostgreSQL

Go 백엔드와 React + TypeScript 프론트엔드를 이용한 LLM 챗봇 애플리케이션입니다.

## 🎯 기능

- **고성능 백엔드**: Go로 개발된 빠르고 효율적인 서버
- **PostgreSQL 데이터베이스**: 신뢰할 수 있는 관계형 데이터베이스에 채팅 히스토리 저장
- **임베디드 가능한 챗위젯**: React 컴포넌트로 어느 웹사이트에나 통합 가능
- **Shift+Enter 줄바꿈**: 자연스러운 메시지 입력 경험
- **실시간 AI 응답**: OpenAI API를 이용한 LLM 통합

## 📁 프로젝트 구조

```
chatchat/
├── frontend/              # React + TypeScript (프론트엔드)
│   ├── src/
│   │   ├── ChatWidget.tsx     # 메인 챗봇 컴포넌트
│   │   ├── ChatWidget.css     # 스타일
│   │   └── main.tsx           # 엔트리 포인트
│   ├── package.json
│   ├── vite.config.ts
│   └── index.html
│
└── backend/               # Go (백엔드)
    ├── main.go            # 메인 애플리케이션 (한 파일!)
    ├── go.mod             # 의존성 관리
    ├── .env.example
    └── .gitignore
```

## 🚀 설치 및 실행

### 필수 요구사항

- **Node.js 18+** (프론트엔드)
- **Go 1.21+** (백엔드)
- **PostgreSQL 12+** (데이터베이스)
- **OpenAI API Key**

---

## 🔧 백엔드 설정 (Go + PostgreSQL)

### 1️⃣ PostgreSQL 설치/설정

#### 로컬 설치:
```bash
# Windows (chocolatey 사용)
choco install postgresql

# 또는 https://www.postgresql.org/download/windows/ 에서 직접 다운로드
```

#### 또는 클라우드 사용 (추천):
- **Railway.app** (가장 간단) - 무료 계획 제공
- **Amazon RDS** - AWS 계정 필요
- **Neon** - 호스팅 PostgreSQL

### 2️⃣ 데이터베이스 생성

```bash
# PostgreSQL 접속
psql -U postgres

# 데이터베이스 생성
CREATE DATABASE chatbot;

# 연결 테스트
\c chatbot
```

### 3️⃣ 환경 변수 설정

```bash
cd backend
cp .env.example .env
```

`.env` 파일 수정:
```env
DATABASE_URL=postgresql://username:password@localhost:5432/chatbot
OPENAI_API_KEY=sk-xxx...
```

### 4️⃣ Go 의존성 다운로드 및 실행

```bash
cd backend

# 의존성 다운로드
go mod download

# 서버 실행
go run main.go
```

✅ 서버가 `http://localhost:8000`에서 실행됩니다!

---

## 🎨 프론트엔드 설정 (React)

```bash
cd frontend

# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

✅ 브라우저에서 `http://localhost:3000` 접속

---

## 📝 API 엔드포인트

### `POST /api/chat`
사용자의 메시지를 처리하고 AI 응답을 반환합니다.

**요청:**
```json
{
  "message": "안녕하세요",
  "chat_history": [
    {"role": "user", "content": "이전 메시지"},
    {"role": "assistant", "content": "이전 응답"}
  ]
}
```

**응답:**
```json
{
  "response": "안녕하세요! 무엇을 도와드릴까요?",
  "session_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

### `GET /health`
서버 상태 확인

**응답:**
```json
{
  "status": "ok"
}
```

---

## 🗄️ PostgreSQL 스키마

자동으로 생성됩니다! (`main.go`의 `createTables()` 함수)

```sql
-- 대화 테이블
CREATE TABLE conversations (
  id SERIAL PRIMARY KEY,
  session_id UUID UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 메시지 테이블
CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  conversation_id INT REFERENCES conversations(id) ON DELETE CASCADE,
  role VARCHAR(20),
  content TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id);
```

---

## ⌨️ 키보드 단축키

- **Enter**: 메시지 전송
- **Shift + Enter**: 줄바꿈

---

## 📦 배포

### 백엔드 (Go) 배포

```bash
# 단일 바이너리로 빌드
go build -o chatbot-api

# 실행
./chatbot-api
```

배포 플랫폼 추천:
- **Railway.app** - Go 친화적, 무료 계획
- **Render** - 간단한 설정
- **Heroku** - 레거시 (추천 안함)

### 프론트엔드 (React) 배포

```bash
cd frontend
npm run build
```

생성된 `dist/` 폴더를 다음에 배포:
- **Vercel** - React 최적화
- **Netlify** - 간단한 설정
- **AWS S3 + CloudFront**

---

## 🔍 개발 팁

### Go 배우기
- Go는 문법이 간단하고 명시적입니다
- `main.go`의 주석을 읽으며 학습하세요
- 에러 처리는 `if err != nil` 패턴이 표준입니다

### 디버깅
```bash
# 서버 로그 보기
go run main.go

# Go 파일 감시하며 자동 재시작 (air 필요)
go install github.com/cosmtrek/air@latest
air
```

### PostgreSQL 쿼리 테스트
```bash
# psql 연결
psql postgresql://username:password@localhost:5432/chatbot

# 대화 조회
SELECT * FROM conversations;

# 메시지 조회
SELECT * FROM messages;
```

---

## 💡 왜 Go를 선택했는가?

| 항목 | Python | **Go** |
|------|--------|--------|
| 성능 | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| 메모리 | ⭐⭐ 200MB+ | ⭐⭐⭐⭐⭐ 20MB |
| 배포 | 복잡함 | 단일 바이너리 .exe |
| 학습곡선 | 쉬움 | 명확하고 직관적 |
| 동시성 | 어려움 | ⭐⭐⭐⭐⭐ 우수 |

---

## 📚 외부 라이브러리

- **lib/pq** - PostgreSQL 드라이버
- **go-openai** - OpenAI API 클라이언트
- **uuid** - UUID 생성
- **net/http** - HTTP 서버 (표준 라이브러리)

---

## ❓ 자주 묻는 질문

**Q: PostgreSQL vs MongoDB 무엇이 나은가?**
> A: PostgreSQL이 더 낫습니다. 채팅 데이터는 정규화가 필요하고, 복잡한 쿼리가 필요합니다.

**Q: Go 처음인데 괜찮을까요?**
> A: 네! Go는 배우기 쉽고 `main.go`의 주석을 따라가면 됩니다.

**Q: 배포는 어떻게 하나요?**
> A: `go build`로 단일 바이너리 생성 후 Railway.app에 배포하면 됩니다.

---

## 📝 라이센스

MIT
