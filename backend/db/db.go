package db

import (
	"database/sql"
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

func Migrate(database *sql.DB) {
	statements := []string{
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
	}

	for _, stmt := range statements {
		if _, err := database.Exec(stmt); err != nil {
			log.Println("마이그레이션 실패:", err)
		}
	}
	log.Println("✓ 마이그레이션 완료")
}
