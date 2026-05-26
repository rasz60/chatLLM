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
	ChatModelKo    string
	ChatModelEn    string
	Port           string
	SalaryDir      string
	KISAppKey      string
	KISAppSecret   string
	JWTSecret      string
	SMTPHost       string
	SMTPPort       string
	SMTPFrom       string
	SMTPUser       string
	SMTPPass       string
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
		ChatModelKo:    getEnvOrDefault("CHAT_MODEL_KO", "gemma3:4b"),
		ChatModelEn:    getEnvOrDefault("CHAT_MODEL_EN", "llama3.2"),
		Port:           getEnvOrDefault("PORT", ":8000"),
		SalaryDir:      getEnvOrDefault("SALARY_DIR", "./salary_data"),
		KISAppKey:      os.Getenv("KIS_APP_KEY"),
		KISAppSecret:   os.Getenv("KIS_APP_SECRET"),
		JWTSecret:      getEnvOrDefault("JWT_SECRET", "change-me-in-production"),
		SMTPHost:       os.Getenv("SMTP_HOST"),
		SMTPPort:       getEnvOrDefault("SMTP_PORT", "587"),
		SMTPFrom:       os.Getenv("SMTP_FROM"),
		SMTPUser:       os.Getenv("SMTP_USER"),
		SMTPPass:       os.Getenv("SMTP_PASS"),
	}

	log.Printf("📝 DATABASE_URL: %s", cfg.DatabaseURL)
	log.Printf("📝 ChatModel KO: %s / EN: %s", cfg.ChatModelKo, cfg.ChatModelEn)
	log.Printf("📝 SalaryDir: %s", cfg.SalaryDir)
	return cfg
}

func getEnvOrDefault(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultVal
}
