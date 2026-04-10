# LLM Chatbot - Go + PostgreSQL + RAG

Go 백엔드, React + TypeScript 프론트엔드, Ollama 로컬 LLM, Supabase pgvector 기반 RAG 챗봇 애플리케이션입니다.

## 기능

- **Go 백엔드**: 패키지 구조로 분리된 고성능 서버
- **RAG**: 회사 내규 문서를 pgvector 코사인 유사도 검색으로 참조하여 답변
- **언어별 모델 라우팅**: 한국어 입력 → 한국어 특화 모델, 영어 입력 → 영어 모델 자동 전환
- **완전 로컬 AI**: Ollama를 통한 오프라인 추론 (인터넷 불필요)
- **Supabase PostgreSQL + pgvector**: 채팅 히스토리 저장 + 벡터 유사도 검색
- **세션 관리**: session_id 기반으로 대화 흐름 추적, 중복 저장 방지
- **임베디드 챗 위젯**: 어느 웹사이트에나 통합 가능한 React 컴포넌트

---

## 프로젝트 구조

```
chatchat/
├── frontend/                   # React + TypeScript
│   ├── src/
│   │   ├── App.tsx             # 메인 앱 (헤더, 플로팅 버튼)
│   │   ├── App.css
│   │   ├── ChatWidget.tsx      # 챗봇 위젯 컴포넌트 (session_id 관리)
│   │   ├── ChatWidget.css
│   │   └── main.tsx            # 엔트리 포인트
│   ├── package.json
│   ├── vite.config.ts          # Vite 설정 (프록시: /api → localhost:8000)
│   └── index.html
│
└── backend/                    # Go
    ├── main.go                 # 서버 시작 진입점
    ├── config/
    │   └── config.go           # 환경변수 로딩
    ├── db/
    │   └── db.go               # DB 연결 + 마이그레이션
    ├── models/
    │   └── types.go            # 공용 구조체 (Message, ChatRequest, ChatResponse)
    ├── services/
    │   ├── llm.go              # 언어 감지 + 모델 라우팅 + Ollama API 호출
    │   └── search.go           # 벡터 검색 (폴백: 키워드 ILIKE 검색)
    ├── handlers/
    │   └── chat.go             # HTTP 핸들러 (/api/chat, /health)
    ├── middleware/
    │   └── cors.go             # CORS 미들웨어
    ├── upload_documents.py     # 문서 청킹 + 임베딩 업로드 스크립트 (Python)
    ├── go.mod
    ├── .env.example
    └── .gitignore
```

---

## 아키텍처

```
사용자
  │
  ▼
React (ChatWidget)
  │  POST /api/chat
  │  { message, chat_history, session_id }
  ▼
Go 백엔드 (handlers/chat.go)
  │
  ├─► SearchService (services/search.go)
  │     └─► Ollama /api/embed → pgvector 코사인 유사도 검색
  │           (임베딩 실패 시 ILIKE 키워드 검색으로 폴백)
  │
  └─► LLMService (services/llm.go)
        ├─► 언어 감지 (한글 유니코드 포함 여부)
        │     ├── 한국어 → CHAT_MODEL_KO (gemma3:4b) + 한국어 시스템 프롬프트
        │     └── 영어   → CHAT_MODEL_EN (llama3.2)  + 영어 시스템 프롬프트
        └─► Ollama /v1/chat/completions
              └─► 시스템 프롬프트에 검색된 문서 주입 (RAG)
  │
  ▼
Supabase PostgreSQL
  ├── conversations  (session_id 기반 대화 관리)
  ├── messages       (user / assistant 메시지 저장)
  └── documents      (filename, content, embedding vector)
```

---

## 필수 요구사항

- **Node.js 18+**
- **Go 1.21+**
- **Python 3.9+** (문서 업로드 시)
- **Ollama** (로컬 LLM 실행)
- **Supabase 계정** (PostgreSQL + pgvector)

---

## 설치 및 실행

### 1. Ollama 모델 설치

```bash
# 한국어 채팅 모델 (gemma3:4b 권장 — 한국어 지시 준수율 높음)
ollama pull gemma3:4b

# 영어 채팅 모델
ollama pull llama3.2

# 임베딩 모델 (RAG용)
ollama pull nomic-embed-text
```

> 모델 용량: gemma3:4b ≈ 3.3GB / llama3.2 ≈ 2GB / nomic-embed-text ≈ 274MB

> qwen2.5는 중국 모델로 한국어 입력 시 중국어로 응답하는 문제가 있어 사용하지 않습니다.

### 2. Supabase 스키마 설정

Supabase SQL 에디터에서 실행:

```sql
-- pgvector 확장 활성화
CREATE EXTENSION IF NOT EXISTS vector;

-- 문서 테이블 (RAG)
CREATE TABLE IF NOT EXISTS documents (
    id        SERIAL PRIMARY KEY,
    filename  TEXT,
    content   TEXT,
    embedding vector(768)   -- nomic-embed-text: 768차원
);

-- 벡터 검색 인덱스 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_documents_embedding
    ON documents USING ivfflat (embedding vector_cosine_ops);
```

> `conversations`, `messages` 테이블은 백엔드 시작 시 자동 생성됩니다.

### 3. 환경변수 설정

```bash
cd backend
cp .env.example .env
```

`.env` 내용:
```env
# PostgreSQL 연결 문자열 (Supabase)
DATABASE_URL=postgresql://user:password@host:5432/postgres

# Ollama 설정
OLLAMA_BASE_URL=http://localhost:11434
CHAT_MODEL_KO=gemma3:4b          # 한국어 질문에 사용할 모델
CHAT_MODEL_EN=llama3.2           # 영어 질문에 사용할 모델
EMBEDDING_MODEL=nomic-embed-text

# 서버 포트
PORT=:8000
```

### 4. 문서 업로드 (RAG)

```bash
cd backend

# Python 의존성 설치
pip install python-docx pdfplumber psycopg2 requests python-dotenv

# 문서 업로드 (PDF/DOCX → 청킹 → 임베딩 → Supabase 저장)
python upload_documents.py
```

- 업로드 대상 경로는 `.env`의 `DOCUMENT_DIR`로 변경 가능 (기본값: `C:\Users\devsi\Documents\rule`)
- 이미 업로드된 문서가 있고 임베딩이 NULL인 경우, `DELETE FROM documents;` 후 재업로드 필요

### 5. 백엔드 실행

```bash
cd backend
go mod download
go run .
```

`http://localhost:8000` 에서 실행됩니다.

### 6. 프론트엔드 실행

```bash
cd frontend
npm install
npm run dev
```

`http://localhost:3000` 에서 실행됩니다.

---

## API 엔드포인트

### `POST /api/chat`

**요청:**
```json
{
  "message": "연차 규정이 어떻게 되나요?",
  "chat_history": [
    {"role": "user", "content": "이전 메시지"},
    {"role": "assistant", "content": "이전 응답"}
  ],
  "session_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

- `session_id`: 첫 요청 시 빈 문자열 전송 → 서버가 신규 생성 후 응답에 포함
- 이후 요청부터 응답받은 `session_id`를 그대로 포함하여 전송

**응답:**
```json
{
  "response": "연차는 입사 1년 미만의 경우 매월 1일씩...",
  "session_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

### `GET /health`

```json
{ "status": "ok" }
```

---

## DB 스키마

```sql
-- 자동 생성 (백엔드 시작 시)
CREATE TABLE conversations (
    id         SERIAL PRIMARY KEY,
    session_id UUID UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE messages (
    id              SERIAL PRIMARY KEY,
    conversation_id INT REFERENCES conversations(id) ON DELETE CASCADE,
    role            VARCHAR(20),   -- 'user' | 'assistant'
    content         TEXT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 수동 생성 필요 (Supabase SQL 에디터)
CREATE TABLE documents (
    id        SERIAL PRIMARY KEY,
    filename  TEXT,
    content   TEXT,
    embedding vector(768)
);
```

---

## 키보드 단축키

- **Enter**: 메시지 전송
- **Shift + Enter**: 줄바꿈

---

## 변경 이력

### 2026-04-10

**챗 위젯 UX 개선 (`ChatWidget.tsx` / `ChatWidget.css`)**

- **응답 생성 중 최소화 표시**: 질문 전송 후 채팅창을 최소화하면 로봇 아이콘 위에 보라색 말풍선 형태의 점점점(···) 애니메이션이 표시되어 응답이 생성 중임을 알 수 있음
  - `.chat-widget-wrapper` 래퍼로 감싸서 `overflow: hidden` 클리핑 문제 해결
  - 응답 완료 시 자동으로 사라짐
- **헤더 클릭으로 최소화**: 채팅창이 열려 있을 때 상단 제목 표시줄(`Chat❓Chat❗`) 영역을 클릭하면 최소화됨 (기존에는 `▼` 버튼만 가능)
- **레이아웃 안정화**: 최소화 ↔ 확장 전환 시 창 크기가 변하던 문제 수정
  - `.chat-widget-wrapper`에 고정 너비(`width: 500px`) 적용
  - 최소화 상태는 오른쪽 끝 정렬(`align-items: flex-end`) 유지하여 래퍼 크기 불변

---

## 배포

### 백엔드 빌드

```bash
cd backend
go build -o chatbot-api .
./chatbot-api
```

배포 플랫폼 추천: Railway.app, Render

### 프론트엔드 빌드

```bash
cd frontend
npm run build
# dist/ 폴더를 Vercel, Netlify 등에 배포
```

---

## 외부 라이브러리

**Go:**
- `lib/pq` - PostgreSQL 드라이버
- `go-openai` - Ollama OpenAI 호환 클라이언트
- `uuid` - UUID 생성
- `godotenv` - .env 파일 로딩

**Python:**
- `pdfplumber` - PDF 파싱
- `python-docx` - DOCX 파싱
- `psycopg2` - PostgreSQL 연결
- `requests` - Ollama API 호출
- `python-dotenv` - .env 파일 로딩

**Frontend:**
- `React 18` + `TypeScript`
- `axios` - HTTP 클라이언트
- `Vite` - 빌드 도구

---

## 라이센스

MIT
