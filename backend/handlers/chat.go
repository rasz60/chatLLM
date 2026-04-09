package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"

	"github.com/google/uuid"

	"chatbot/models"
	"chatbot/services"
)

type ChatHandler struct {
	db     *sql.DB
	llm    *services.LLMService
	search *services.SearchService
}

func NewChatHandler(db *sql.DB, llm *services.LLMService, search *services.SearchService) *ChatHandler {
	return &ChatHandler{db: db, llm: llm, search: search}
}

func (h *ChatHandler) Health(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func (h *ChatHandler) Chat(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req models.ChatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// 관련 문서 검색
	relevantDocs := h.search.Search(req.Message)

	// LLM 응답 생성
	response, err := h.llm.Chat(req.Message, req.ChatHistory, relevantDocs)
	if err != nil {
		log.Println("LLM 오류:", err)
		http.Error(w, "LLM 오류", http.StatusInternalServerError)
		return
	}

	// session_id로 기존 conversation 찾기, 없으면 신규 생성
	conversationID, sessionID, err := h.getOrCreateConversation(req.SessionID)
	if err != nil {
		log.Println("conversation 처리 실패:", err)
		http.Error(w, "DB 오류", http.StatusInternalServerError)
		return
	}

	// 새 메시지만 저장 (user + assistant)
	h.saveMessage(conversationID, "user", req.Message)
	h.saveMessage(conversationID, "assistant", response)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(models.ChatResponse{
		Response:  response,
		SessionID: sessionID,
	})
}

// getOrCreateConversation: session_id가 있으면 기존 conversation 반환, 없으면 새로 생성
func (h *ChatHandler) getOrCreateConversation(sessionID string) (int, string, error) {
	if sessionID != "" {
		var conversationID int
		err := h.db.QueryRow(
			"SELECT id FROM conversations WHERE session_id = $1", sessionID,
		).Scan(&conversationID)
		if err == nil {
			return conversationID, sessionID, nil
		}
	}

	newSessionID := uuid.New().String()
	var conversationID int
	err := h.db.QueryRow(
		"INSERT INTO conversations (session_id) VALUES ($1) RETURNING id", newSessionID,
	).Scan(&conversationID)
	return conversationID, newSessionID, err
}

func (h *ChatHandler) saveMessage(conversationID int, role, content string) {
	_, err := h.db.Exec(
		"INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3)",
		conversationID, role, content,
	)
	if err != nil {
		log.Printf("메시지 저장 실패 [%s]: %v", role, err)
	}
}
