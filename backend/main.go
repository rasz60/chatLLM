package main

import (
	"log"
	"net/http"

	"chatbot/config"
	"chatbot/db"
	"chatbot/handlers"
	"chatbot/middleware"
	"chatbot/services"
)

func main() {
	cfg := config.Load()

	database := db.Connect(cfg.DatabaseURL)
	defer database.Close()

	db.Migrate(database)

	llmSvc := services.NewLLMService(cfg.OllamaBaseURL, cfg.ChatModelKo, cfg.ChatModelEn, cfg.EmbeddingModel)
	searchSvc := services.NewSearchService(database, llmSvc)
	chatHandler := handlers.NewChatHandler(database, llmSvc, searchSvc)

	http.HandleFunc("/health", middleware.CORS(chatHandler.Health))
	http.HandleFunc("/api/chat", middleware.CORS(chatHandler.Chat))

	log.Printf("✓ 서버 시작: http://localhost%s", cfg.Port)
	if err := http.ListenAndServe(cfg.Port, nil); err != nil {
		log.Fatal("서버 시작 실패:", err)
	}
}
