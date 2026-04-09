"""
회사 내규 문서를 Supabase pgvector에 업로드하는 스크립트

의존성 설치:
  pip install python-docx pdfplumber psycopg2 requests python-dotenv
"""

import os
import json
from pathlib import Path
from typing import List

import docx
import pdfplumber
import psycopg2
from psycopg2.extras import execute_values
import requests
from dotenv import load_dotenv

# .env 파일 로드
load_dotenv()

DATABASE_URL    = os.environ["DATABASE_URL"]
DOCUMENT_DIR    = os.getenv("DOCUMENT_DIR", r"C:\Users\devsi\Documents\rule")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "nomic-embed-text")
CHUNK_SIZE      = 500
CHUNK_OVERLAP   = 50


def read_pdf(file_path: str) -> str:
    text = ""
    try:
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                extracted = page.extract_text(layout=False)
                if extracted:
                    text += extracted + "\n"
        print(f"✓ PDF 읽기 완료: {file_path}")
    except Exception as e:
        print(f"✗ PDF 읽기 실패: {e}")
    return text


def read_docx(file_path: str) -> str:
    doc = docx.Document(str(file_path))
    return "\n".join([p.text for p in doc.paragraphs])


def chunk_text(text: str) -> List[str]:
    chunks = []
    start = 0
    while start < len(text):
        end = start + CHUNK_SIZE
        chunk = text[start:end]
        if end < len(text):
            last_period = chunk.rfind('.')
            if last_period > CHUNK_SIZE * 0.5:
                end = start + last_period + 1
        chunks.append(chunk.strip())
        start = end - CHUNK_OVERLAP
    return [c for c in chunks if len(c.strip()) > 50]


def get_embedding(text: str) -> List[float]:
    """Ollama embed API로 벡터 임베딩 생성"""
    try:
        resp = requests.post(
            f"{OLLAMA_BASE_URL}/api/embed",
            json={"model": EMBEDDING_MODEL, "input": text},
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        embeddings = data.get("embeddings", [])
        if embeddings:
            return embeddings[0]
    except Exception as e:
        print(f"⚠️ 임베딩 실패: {e}")
    return []


def upload_to_db(filename: str, chunks: List[str]):
    """청크 + 임베딩을 Supabase에 업로드"""
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()

        data = []
        for i, chunk in enumerate(chunks):
            embedding = get_embedding(chunk)
            embedding_val = json.dumps(embedding) if embedding else None
            data.append((filename, chunk, embedding_val))
            print(f"  [{i+1}/{len(chunks)}] 임베딩 {'완료' if embedding else '실패(NULL 저장)'}")

        if data:
            execute_values(
                cursor,
                "INSERT INTO documents (filename, content, embedding) VALUES %s",
                data,
                template="(%s, %s, %s::vector)" if any(d[2] for d in data) else None,
            )
            conn.commit()
            print(f"✓ {filename}: {len(data)}개 청크 저장 완료\n")

        cursor.close()
        conn.close()

    except Exception as e:
        print(f"✗ DB 저장 실패: {e}")


def main():
    print("=" * 60)
    print("회사 내규 문서 업로드 시작")
    print(f"  모델: {EMBEDDING_MODEL}")
    print(f"  문서 경로: {DOCUMENT_DIR}")
    print("=" * 60 + "\n")

    doc_dir = Path(DOCUMENT_DIR)
    if not doc_dir.exists():
        print(f"✗ 문서 경로 없음: {DOCUMENT_DIR}")
        return

    pdf_files  = list(doc_dir.glob("*.pdf"))
    docx_files = list(doc_dir.glob("*.docx"))

    print(f"발견된 파일:")
    print(f"  - PDF:  {len(pdf_files)}개")
    print(f"  - DOCX: {len(docx_files)}개\n")

    for pdf_file in pdf_files:
        print(f"📄 처리 중: {pdf_file.name}")
        text = read_pdf(str(pdf_file))
        if text:
            chunks = chunk_text(text)
            print(f"  → {len(chunks)}개 청크로 분할")
            upload_to_db(pdf_file.stem, chunks)

    for docx_file in docx_files:
        print(f"📄 처리 중: {docx_file.name}")
        content = read_docx(str(docx_file))
        if content:
            chunks = chunk_text(content)
            print(f"  → {len(chunks)}개 청크로 분할")
            upload_to_db(docx_file.stem, chunks)

    print("=" * 60)
    print("✓ 모든 문서 업로드 완료!")
    print("=" * 60)


if __name__ == "__main__":
    main()
