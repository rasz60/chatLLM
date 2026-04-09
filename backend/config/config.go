package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	DatabaseURL    string
	OllamaBaseURL  string
	EmbeddingModel string
	ChatModelKo    string // 한국어 전용 모델
	ChatModelEn    string // 영어 전용 모델
	Port           string
}

func Load() *Config {
	if err := godotenv.Load(); err != nil {
		log.Println("⚠️ .env 파일 로드 실패:", err)
	} else {
		log.Println("✓ .env 파일 로드 성공")
	}

	cfg := &Config{
		DatabaseURL:    os.Getenv("DATABASE_URL"),
		OllamaBaseURL:  getEnvOrDefault("OLLAMA_BASE_URL", "http://localhost:11434"),
		EmbeddingModel: getEnvOrDefault("EMBEDDING_MODEL", "nomic-embed-text"),
		ChatModelKo:    getEnvOrDefault("CHAT_MODEL_KO", "qwen2.5:7b"),
		ChatModelEn:    getEnvOrDefault("CHAT_MODEL_EN", "llama3.2"),
		Port:           getEnvOrDefault("PORT", ":8000"),
	}

	log.Printf("📝 DATABASE_URL: %s", cfg.DatabaseURL)
	log.Printf("📝 ChatModel KO: %s / EN: %s", cfg.ChatModelKo, cfg.ChatModelEn)
	return cfg
}

func getEnvOrDefault(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultVal
}
