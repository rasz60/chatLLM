"""
주식 종목 마스터 데이터 시드 스크립트

사용법:
    pip install finance-datareader psycopg2-binary python-dotenv
    python seed_stocks.py

국내(KOSPI/KOSDAQ/ETF): FinanceDataReader → KRX 데이터
해외(NASDAQ/NYSE/AMEX + US ETF): NASDAQ FTP 공개 파일
"""

import ftplib
import io
import os
import sys

import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("ERROR: DATABASE_URL 환경변수가 없습니다.")
    sys.exit(1)


# ── 국내 종목 + ETF (FinanceDataReader) ─────────────────────────

def get_korean_stocks():
    try:
        import FinanceDataReader as fdr
    except ImportError:
        print("  FinanceDataReader 없음. (pip install finance-datareader)")
        return []

    seen = set()
    results = []

    # 일반 주식 (KOSPI / KOSDAQ)
    for market in ("KOSPI", "KOSDAQ"):
        print(f"  [{market}] 종목 목록 조회 중...")
        try:
            df = fdr.StockListing(market)
            count = 0
            for _, row in df.iterrows():
                code = str(row.get("Code") or row.get("Symbol") or "").strip()
                name = str(row.get("Name") or "").strip()
                if code and name and code not in seen:
                    seen.add(code)
                    results.append((code, name, market, "KR"))
                    count += 1
            print(f"  [{market}] {count}개 완료")
        except Exception as e:
            print(f"  [{market}] 오류: {e}")

    # 국내 ETF
    print("  [ETF/KR] ETF 목록 조회 중...")
    try:
        df_etf = fdr.StockListing("ETF/KR")
        count = 0
        for _, row in df_etf.iterrows():
            code = str(row.get("Code") or row.get("Symbol") or "").strip()
            name = str(row.get("Name") or "").strip()
            if code and name and code not in seen:
                seen.add(code)
                results.append((code, name, "ETF", "KR"))
                count += 1
        print(f"  [ETF/KR] {count}개 완료")
    except Exception as e:
        print(f"  [ETF/KR] 오류 (건너뜀): {e}")

    return results


# ── 해외 종목 (NASDAQ FTP) ───────────────────────────────────────

def get_us_stocks():
    results = []
    try:
        ftp = ftplib.FTP("ftp.nasdaqtrader.com", timeout=30)
        ftp.login()
    except Exception as e:
        print(f"  NASDAQ FTP 연결 실패: {e}")
        print("  해외 종목 건너뜀.")
        return []

    # nasdaqlisted.txt: Symbol|Security Name|Market Category|Test Issue|Financial Status|Round Lot Size|ETF|NextShares
    print("  [NASDAQ+ETF] nasdaqlisted.txt 다운로드 중...")
    buf = io.BytesIO()
    ftp.retrbinary("RETR SymbolDirectory/nasdaqlisted.txt", buf.write)
    buf.seek(0)
    for line in buf.read().decode("utf-8").splitlines()[1:]:
        parts = line.split("|")
        if len(parts) < 7:
            continue
        code, name = parts[0].strip(), parts[1].strip()
        is_etf = parts[6].strip() == "Y"
        if not code or not name or "File Creation Time" in code:
            continue
        if "$" in code or "TEST" in name.upper():
            continue
        market = "ETF" if is_etf else "NASDAQ"
        results.append((code, name, market, "US"))
    print(f"  [NASDAQ+ETF] {len(results)}개")

    # otherlisted.txt: ACT Symbol|Security Name|Exchange|CQS Symbol|ETF|Round Lot Size|Test Issue|NASDAQ Symbol
    print("  [NYSE/AMEX+ETF] otherlisted.txt 다운로드 중...")
    buf = io.BytesIO()
    ftp.retrbinary("RETR SymbolDirectory/otherlisted.txt", buf.write)
    buf.seek(0)
    exchange_map = {"N": "NYSE", "A": "AMEX", "P": "NYSE"}
    before = len(results)
    for line in buf.read().decode("utf-8").splitlines()[1:]:
        parts = line.split("|")
        if len(parts) < 5:
            continue
        code, name, exch = parts[0].strip(), parts[1].strip(), parts[2].strip()
        is_etf = parts[4].strip() == "Y"
        if not code or not name or "File Creation Time" in code:
            continue
        if is_etf:
            market = "ETF"
        else:
            market = exchange_map.get(exch)
            if not market:
                continue
        results.append((code, name, market, "US"))
    print(f"  [NYSE/AMEX+ETF] {len(results) - before}개")

    ftp.quit()
    return results


# ── DB 삽입 ──────────────────────────────────────────────────────

def seed(stocks):
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    # 테이블이 없으면 생성
    cur.execute("""
        CREATE TABLE IF NOT EXISTS stocks (
            id      SERIAL PRIMARY KEY,
            code    TEXT NOT NULL,
            name    TEXT NOT NULL,
            market  TEXT NOT NULL,
            country TEXT NOT NULL
        )
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_stocks_code ON stocks (code)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_stocks_name ON stocks (name)")
    conn.commit()

    print("\nDB에 데이터 삽입 중...")
    cur.execute("TRUNCATE TABLE stocks RESTART IDENTITY")
    execute_values(
        cur,
        "INSERT INTO stocks (code, name, market, country) VALUES %s",
        stocks,
        page_size=500,
    )
    conn.commit()
    print(f"완료: {len(stocks)}개 종목 삽입")

    cur.close()
    conn.close()


if __name__ == "__main__":
    print("=== 국내 종목 수집 ===")
    kr = get_korean_stocks()

    print("\n=== 해외 종목 수집 ===")
    us = get_us_stocks()

    all_stocks = kr + us
    print(f"\n총 {len(all_stocks)}개 (국내 {len(kr)}, 해외 {len(us)})")

    if not all_stocks:
        print("수집된 종목이 없습니다. 종료합니다.")
        sys.exit(1)

    seed(all_stocks)
