package models

// ==================== Chat ====================

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type ChatRequest struct {
	Message     string    `json:"message"`
	ChatHistory []Message `json:"chat_history"`
	SessionID   string    `json:"session_id"`
}

type ChatResponse struct {
	Response  string `json:"response"`
	SessionID string `json:"session_id"`
}

// ==================== Work Journal ====================

type Work struct {
	ID          string `json:"_id"`
	Category    string `json:"category"`
	Title       string `json:"title"`
	Content     string `json:"content"`
	Progress    int    `json:"progress"`
	ExStartDate string `json:"exStartDate"`
	ExEndDate   string `json:"exEndDate"`
	StartDate   string `json:"startDate"`
	EndDate     string `json:"endDate"`
	CreateDate  string `json:"createDate"`
	UpdateDate  string `json:"updateDate"`
	Status      int    `json:"status"`
	Expected    int    `json:"expected"`
}

type WorkCreateRequest struct {
	Category    string `json:"category"`
	Title       string `json:"title"`
	Content     string `json:"content"`
	ExStartDate string `json:"exStartDate"`
	ExEndDate   string `json:"exEndDate"`
	StartDate   string `json:"startDate"`
	EndDate     string `json:"endDate"`
	Progress    int    `json:"progress"`
}

type WorkReadRequest struct {
	ID        string `json:"id"`
	StartDate string `json:"startDate"`
	EndDate   string `json:"endDate"`
	Category  string `json:"category"`
	Keyword   string `json:"keyword"`
	Status    string `json:"status"`
	Page      int    `json:"page"`
	Limit     int    `json:"limit"`
}

type WorkUpdateRequest struct {
	ID          string `json:"id"`
	Category    string `json:"category"`
	Title       string `json:"title"`
	Content     string `json:"content"`
	ExStartDate string `json:"exStartDate"`
	ExEndDate   string `json:"exEndDate"`
	StartDate   string `json:"startDate"`
	EndDate     string `json:"endDate"`
	Progress    int    `json:"progress"`
}

type WorkListResponse struct {
	List  []Work `json:"list"`
	Total int    `json:"total"`
	Page  int    `json:"page"`
	Limit int    `json:"limit"`
}
