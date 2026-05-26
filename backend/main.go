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
	stockHandler := handlers.NewStockHandler(cfg, database)
	authHandler := handlers.NewAuthHandler(database, cfg)

	// Chat
	http.HandleFunc("/health", middleware.CORS(chatHandler.Health))
	http.HandleFunc("/api/chat", middleware.CORS(chatHandler.Chat))

	// Auth
	http.HandleFunc("/api/auth/register", middleware.CORS(authHandler.Register))
	http.HandleFunc("/api/auth/login", middleware.CORS(authHandler.Login))
	http.HandleFunc("/api/auth/me", middleware.CORS(authHandler.Me))
	http.HandleFunc("/api/auth/send-code", middleware.CORS(authHandler.SendCode))
	http.HandleFunc("/api/auth/verify-code", middleware.CORS(authHandler.VerifyCode))

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
	http.HandleFunc("/api/stock/refprice", middleware.CORS(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			stockHandler.GetRefPrices(w, r)
		case http.MethodPost:
			stockHandler.SetRefPrice(w, r)
		case http.MethodDelete:
			stockHandler.DeleteRefPrice(w, r)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	}))
	http.HandleFunc("/api/stock/watchlist", middleware.CORS(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			stockHandler.GetWatchlist(w, r)
		case http.MethodPost:
			stockHandler.AddToWatchlist(w, r)
		case http.MethodDelete:
			stockHandler.RemoveFromWatchlist(w, r)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	}))

	log.Printf("✓ 서버 시작: http://localhost%s", cfg.Port)
	if err := http.ListenAndServe(cfg.Port, nil); err != nil {
		log.Fatal("서버 시작 실패:", err)
	}
}
