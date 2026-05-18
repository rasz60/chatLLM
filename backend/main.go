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

	if err := db.Migrate(database); err != nil {
		log.Fatal("마이그레이션 실패:", err)
	}

	llmSvc := services.NewLLMService(cfg.OllamaBaseURL, cfg.ChatModelKo, cfg.ChatModelEn, cfg.EmbeddingModel)
	searchSvc := services.NewSearchService(database, llmSvc)
	chatHandler := handlers.NewChatHandler(database, llmSvc, searchSvc)
	workHandler := handlers.NewWorkHandler(database)
	salaryHandler := handlers.NewSalaryHandler(cfg.SalaryDir)
	stockHandler := handlers.NewStockHandler(cfg)

	// Chat
	http.HandleFunc("/health", middleware.CORS(chatHandler.Health))
	http.HandleFunc("/api/chat", middleware.CORS(chatHandler.Chat))

	// Work journal
	http.HandleFunc("/api/work/create", middleware.CORS(workHandler.Create))
	http.HandleFunc("/api/work/read", middleware.CORS(workHandler.Read))
	http.HandleFunc("/api/work/update", middleware.CORS(workHandler.Update))
	http.HandleFunc("/api/work/delete", middleware.CORS(workHandler.Delete))
	http.HandleFunc("/api/work/categories", middleware.CORS(workHandler.Categories))

	// Salary
	http.HandleFunc("/api/salary/get_list", middleware.CORS(salaryHandler.GetList))
	http.HandleFunc("/api/salary/open_file", middleware.CORS(salaryHandler.OpenFile))
	http.HandleFunc("/api/salary/upload_check", middleware.CORS(salaryHandler.UploadCheck))

	// Stock
	http.HandleFunc("/api/stock/search", middleware.CORS(stockHandler.Search))
	http.HandleFunc("/api/stock/price", middleware.CORS(stockHandler.Price))

	log.Printf("✓ 서버 시작: http://localhost%s", cfg.Port)
	if err := http.ListenAndServe(cfg.Port, nil); err != nil {
		log.Fatal("서버 시작 실패:", err)
	}
}
