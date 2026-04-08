package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"os"

	_ "github.com/lib/pq"
	"github.com/google/uuid"
	openai "github.com/sashabaranov/go-openai"
)

// 환경 변수 저장
var (
	dbURL       = os.Getenv("DATABASE_URL")
	openaiKey   = os.Getenv("OPENAI_API_KEY")
	db          *sql.DB
	openaiClient *openai.Client
)

// 메시지 구조체
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// 채팅 요청 구조체
type ChatRequest struct {
	Message     string    `json:"message"`
	ChatHistory []Message `json:"chat_history"`
}

// 채팅 응답 구조체
type ChatResponse struct {
	Response  string `json:"response"`
	SessionID string `json:"session_id"`
}

// 초기화 함수
func init() {
	// PostgreSQL 데이터베이스 연결
	var err error
	db, err = sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatal("DB 연결 실패:", err)
	}

	// 연결 테스트
	if err := db.Ping(); err != nil {
		log.Fatal("DB Ping 실패:", err)
	}

	log.Println("✓ PostgreSQL 연결 성공")

	// OpenAI 클라이언트 초기화
	openaiClient = openai.NewClient(openaiKey)

	// 테이블 생성 (없으면)
	createTables()
}

// 테이블 생성 함수
func createTables() {
	conversationSQL := `
	CREATE TABLE IF NOT EXISTS conversations (
		id SERIAL PRIMARY KEY,
		session_id UUID UNIQUE,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);
	`

	messagesSQL := `
	CREATE TABLE IF NOT EXISTS messages (
		id SERIAL PRIMARY KEY,
		conversation_id INT REFERENCES conversations(id) ON DELETE CASCADE,
		role VARCHAR(20),
		content TEXT,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);
	`

	// 인덱스 생성
	indexSQL := `
	CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
	`

	if _, err := db.Exec(conversationSQL); err != nil {
		log.Println("conversations 테이블 생성 실패:", err)
	}

	if _, err := db.Exec(messagesSQL); err != nil {
		log.Println("messages 테이블 생성 실패:", err)
	}

	if _, err := db.Exec(indexSQL); err != nil {
		log.Println("인덱스 생성 실패:", err)
	}

	log.Println("✓ 테이블 생성 완료")
}

// OpenAI와 대화하는 함수
func chatWithLLM(userMessage string, chatHistory []Message) (string, error) {
	// 메시지 배열에 시스템 메시지와 채팅 히스토리 추가
	messages := []openai.ChatCompletionMessage{
		{
			Role: "system",
			Content: "You are a helpful AI assistant. Answer concisely and helpfully. Answer in Korean if the user speaks Korean.",
		},
	}

	// 이전 채팅 히스토리 추가
	for _, msg := range chatHistory {
		messages = append(messages, openai.ChatCompletionMessage{
			Role:    msg.Role,
			Content: msg.Content,
		})
	}

	// 새로운 사용자 메시지 추가
	messages = append(messages, openai.ChatCompletionMessage{
		Role:    "user",
		Content: userMessage,
	})

	// OpenAI API 호출
	resp, err := openaiClient.CreateChatCompletion(
		nil, // context
		openai.ChatCompletionRequest{
			Model:       openai.GPT3Dot5Turbo,
			Messages:    messages,
			Temperature: 0.7,
			MaxTokens:   500,
		},
	)

	if err != nil {
		return "", err
	}

	return resp.Choices[0].Message.Content, nil
}

// CORS 미들웨어
func corsMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next(w, r)
	}
}

// 헬스 체크 핸들러
func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// 채팅 핸들러 (핵심 로직)
func chatHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// 요청 파싱
	var req ChatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// OpenAI에서 응답 받기
	response, err := chatWithLLM(req.Message, req.ChatHistory)
	if err != nil {
		log.Println("OpenAI 오류:", err)
		http.Error(w, "LLM 오류", http.StatusInternalServerError)
		return
	}

	// 세션 ID 생성
	sessionID := generateUUID()

	// 데이터베이스에 저장
	var conversationID int
	err = db.QueryRow(
		"INSERT INTO conversations (session_id) VALUES ($1) RETURNING id",
		sessionID,
	).Scan(&conversationID)

	if err != nil {
		log.Println("대화 저장 실패:", err)
		http.Error(w, "Save failed", http.StatusInternalServerError)
		return
	}

	// 채팅 히스토리 저장
	for _, msg := range req.ChatHistory {
		_, err := db.Exec(
			"INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3)",
			conversationID, msg.Role, msg.Content,
		)
		if err != nil {
			log.Println("메시지 저장 실패:", err)
		}
	}

	// 사용자 메시지 저장
	_, err = db.Exec(
		"INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3)",
		conversationID, "user", req.Message,
	)
	if err != nil {
		log.Println("사용자 메시지 저장 실패:", err)
	}

	// 봇 응답 저장
	_, err = db.Exec(
		"INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3)",
		conversationID, "assistant", response,
	)
	if err != nil {
		log.Println("봇 응답 저장 실패:", err)
	}

	// 응답 반환
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(ChatResponse{
		Response:  response,
		SessionID: sessionID,
	})
}

// UUID 생성 함수
func generateUUID() string {
	return uuid.New().String()
}

// main 함수
func main() {
	// 라우테 설정
	http.HandleFunc("/health", corsMiddleware(healthHandler))
	http.HandleFunc("/api/chat", corsMiddleware(chatHandler))

	// 서버 시작
	port := ":8000"
	log.Printf("✓ Go 서버 시작: http://localhost%s", port)

	if err := http.ListenAndServe(port, nil); err != nil {
		log.Fatal("서버 시작 실패:", err)
	}
}
