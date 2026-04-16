# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LLM chatbot with a Go backend and React + TypeScript frontend. Uses Ollama for local LLM inference, Supabase PostgreSQL + pgvector for vector search (RAG), and session-based conversation management.

## Commands

### Backend (Go)
```bash
cd backend
go mod download       # install dependencies
go run .              # run dev server (port 8000)
go build -o chatbot-api .  # production build
```

### Frontend (React + TypeScript)
```bash
cd frontend
npm install
npm run dev           # dev server (port 3000)
npm run build         # production build → dist/
```

### Document Upload (RAG)
```bash
cd backend
pip install python-docx pdfplumber psycopg2 requests python-dotenv
python upload_documents.py
```

## Architecture

The request flow is:

```
React (ChatWidget.tsx)
  └─► POST /api/chat  { message, chat_history, session_id }
        │
        ├─► SearchService.Search()          # services/search.go
        │     ├── GetEmbedding() → Ollama /api/embed
        │     └── pgvector cosine search (fallback: ILIKE keyword search)
        │
        └─► LLMService.Chat()               # services/llm.go
              ├── detectLanguage() — Korean unicode range → "ko", else "en"
              ├── route to CHAT_MODEL_KO (gemma3:4b) or CHAT_MODEL_EN (llama3.2)
              └── inject retrieved docs into system prompt → Ollama /v1/chat/completions
```

**Backend package layout:**
- `config/` — env var loading via godotenv
- `db/` — PostgreSQL connection + auto-migration (creates `conversations`, `messages` tables)
- `models/` — shared structs: `Message`, `ChatRequest`, `ChatResponse`
- `services/llm.go` — language detection, model routing, Ollama chat + embedding calls
- `services/search.go` — vector search with keyword fallback
- `handlers/chat.go` — HTTP handlers for `POST /api/chat` and `GET /health`
- `middleware/cors.go` — CORS wrapper

**Frontend:** `ChatWidget.tsx` owns session_id state (stored per component mount), sends full `chat_history` on each request. Vite proxies `/api` → `http://localhost:8000`.

## Environment Setup

Copy `backend/.env.example` to `backend/.env`:
```env
DATABASE_URL=postgresql://user:password@host:5432/postgres
OLLAMA_BASE_URL=http://localhost:11434
CHAT_MODEL_KO=gemma3:4b
CHAT_MODEL_EN=llama3.2
EMBEDDING_MODEL=nomic-embed-text
PORT=:8000
```

Required Ollama models:
```bash
ollama pull gemma3:4b          # Korean (~3.3 GB)
ollama pull llama3.2           # English (~2 GB)
ollama pull nomic-embed-text   # Embeddings, 768-dim (~274 MB)
```

## Database

`conversations` and `messages` tables are auto-created on backend startup via `db.Migrate()`.

The `documents` table must be created manually in Supabase before uploading documents:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE documents (
    id SERIAL PRIMARY KEY,
    filename TEXT,
    content TEXT,
    embedding vector(768)
);
CREATE INDEX IF NOT EXISTS idx_documents_embedding
    ON documents USING ivfflat (embedding vector_cosine_ops);
```

If re-uploading documents, run `DELETE FROM documents;` first to avoid NULL embedding rows.

## Key Behaviors

- **Language routing**: Korean Unicode detection in `detectLanguage()` selects model and writes system prompt in the same language to improve instruction-following. qwen2.5 is explicitly avoided (responds in Chinese for Korean input).
- **RAG fallback**: if Ollama embedding fails, `SearchService` silently falls back to `ILIKE` keyword search so the chat always responds.
- **Session management**: empty `session_id` in request → server creates new UUID and returns it; subsequent requests pass it back to continue the conversation thread.
- **No streaming**: responses are returned as a single JSON object after full generation.
