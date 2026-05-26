package db

import (
	"database/sql"
	"fmt"
	"log"

	_ "github.com/lib/pq"
)

func Connect(databaseURL string) *sql.DB {
	database, err := sql.Open("postgres", databaseURL)
	if err != nil {
		log.Fatal("DB 연결 실패:", err)
	}
	if err := database.Ping(); err != nil {
		log.Fatal("DB Ping 실패:", err)
	}
	log.Println("✓ PostgreSQL 연결 성공")
	return database
}

func Migrate(database *sql.DB) error {
	statements := []string{
		// UUID 생성 함수에 필요한 pgcrypto 확장
		`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`,
		`CREATE TABLE IF NOT EXISTS conversations (
			id         SERIAL PRIMARY KEY,
			session_id UUID UNIQUE,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS messages (
			id              SERIAL PRIMARY KEY,
			conversation_id INT REFERENCES conversations(id) ON DELETE CASCADE,
			role            VARCHAR(20),
			content         TEXT,
			created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id)`,
		`CREATE TABLE IF NOT EXISTS stocks (
			id      SERIAL PRIMARY KEY,
			code    TEXT NOT NULL,
			name    TEXT NOT NULL,
			market  TEXT NOT NULL,
			country TEXT NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS idx_stocks_code ON stocks (code)`,
		`CREATE INDEX IF NOT EXISTS idx_stocks_name ON stocks (name)`,
		`CREATE TABLE IF NOT EXISTS stock_ref_prices (
			user_id    TEXT    NOT NULL DEFAULT 'default',
			code       TEXT    NOT NULL,
			ref_price  NUMERIC NOT NULL,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (user_id, code)
		)`,
		`CREATE TABLE IF NOT EXISTS users (
			id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			username      TEXT NOT NULL UNIQUE,
			password_hash TEXT NOT NULL,
			email         TEXT,
			phone         TEXT,
			role          TEXT NOT NULL DEFAULT 'user',
			created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)`,
		// 기존 users 테이블에 컬럼 추가 (이미 존재하는 경우 무시)
		`DO $$ BEGIN
			IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='email') THEN
				ALTER TABLE users ADD COLUMN email TEXT;
			END IF;
			IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='phone') THEN
				ALTER TABLE users ADD COLUMN phone TEXT;
			END IF;
			IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='role') THEN
				ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';
			END IF;
		END $$`,
		`CREATE TABLE IF NOT EXISTS verification_codes (
			id         SERIAL PRIMARY KEY,
			target     TEXT NOT NULL,
			code       TEXT NOT NULL,
			expires_at TIMESTAMP NOT NULL,
			verified   BOOLEAN DEFAULT FALSE,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE INDEX IF NOT EXISTS idx_verification_codes_target ON verification_codes (target)`,
		`CREATE TABLE IF NOT EXISTS stock_watchlist (
			user_id   TEXT NOT NULL,
			code      TEXT NOT NULL,
			name      TEXT NOT NULL,
			market    TEXT NOT NULL DEFAULT '',
			added_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (user_id, code)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_stock_watchlist_user ON stock_watchlist (user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_stock_ref_prices_user ON stock_ref_prices (user_id)`,
		// rename _id → id if table was created with wrong column name
		`DO $$ BEGIN
			IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='works' AND column_name='_id') THEN
				ALTER TABLE works RENAME COLUMN _id TO id;
			END IF;
		END $$`,
		`CREATE TABLE IF NOT EXISTS works (
			id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			category      VARCHAR(50),
			title         VARCHAR(500) NOT NULL,
			content       TEXT,
			ex_start_date TIMESTAMP,
			ex_end_date   TIMESTAMP,
			start_date    TIMESTAMP,
			end_date      TIMESTAMP,
			progress      INT DEFAULT 0,
			create_date   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			update_date   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			status        INT DEFAULT 0
		)`,
	}

	for _, stmt := range statements {
		if _, err := database.Exec(stmt); err != nil {
			return fmt.Errorf("마이그레이션 실패: %w", err)
		}
	}
	log.Println("✓ 마이그레이션 완료")
	return nil
}
