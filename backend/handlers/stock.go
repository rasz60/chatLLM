package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"sync"
	"time"

	"chatbot/config"
)

const kisBaseURL = "https://openapi.koreainvestment.com:9443"

type StockHandler struct {
	cfg         *config.Config
	token       string
	tokenExpiry time.Time
	mu          sync.Mutex
	client      *http.Client
}

func NewStockHandler(cfg *config.Config) *StockHandler {
	return &StockHandler{
		cfg:    cfg,
		client: &http.Client{Timeout: 10 * time.Second},
	}
}

func (h *StockHandler) getToken() (string, error) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if h.token != "" && time.Now().Before(h.tokenExpiry) {
		return h.token, nil
	}

	payload := map[string]string{
		"grant_type": "client_credentials",
		"appkey":     h.cfg.KISAppKey,
		"appsecret":  h.cfg.KISAppSecret,
	}
	b, _ := json.Marshal(payload)

	resp, err := h.client.Post(kisBaseURL+"/oauth2/tokenP", "application/json", bytes.NewReader(b))
	if err != nil {
		return "", fmt.Errorf("token request: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
		Message     string `json:"message"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("token decode: %w", err)
	}
	if result.AccessToken == "" {
		return "", fmt.Errorf("empty token: %s", result.Message)
	}

	h.token = result.AccessToken
	h.tokenExpiry = time.Now().Add(time.Duration(result.ExpiresIn-300) * time.Second)
	log.Printf("[Stock] 토큰 갱신 완료 (유효 %ds)", result.ExpiresIn)
	return h.token, nil
}

func (h *StockHandler) kisGet(path, trID string) ([]byte, error) {
	token, err := h.getToken()
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest("GET", kisBaseURL+path, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("authorization", "Bearer "+token)
	req.Header.Set("appkey", h.cfg.KISAppKey)
	req.Header.Set("appsecret", h.cfg.KISAppSecret)
	req.Header.Set("tr_id", trID)
	req.Header.Set("content-type", "application/json; charset=utf-8")

	resp, err := h.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	return io.ReadAll(resp.Body)
}

func (h *StockHandler) checkConfig(w http.ResponseWriter) bool {
	if h.cfg.KISAppKey == "" || h.cfg.KISAppSecret == "" {
		jsonResponse(w, map[string]string{"error": "KIS API 키가 설정되지 않았습니다. .env 파일에 KIS_APP_KEY, KIS_APP_SECRET을 입력해주세요."}, http.StatusBadRequest)
		return false
	}
	return true
}

// POST /api/stock/search  body: {"query": "005930" | "삼성전자"}
func (h *StockHandler) Search(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if !h.checkConfig(w) {
		return
	}

	var req struct {
		Query string `json:"query"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Query == "" {
		jsonResponse(w, map[string]string{"error": "query required"}, http.StatusBadRequest)
		return
	}

	path := fmt.Sprintf("/uapi/domestic-stock/v1/quotations/search-stock-info?PRDT_TYPE_CD=300&PDNO=%s", req.Query)
	data, err := h.kisGet(path, "CTPF1702R")
	if err != nil {
		log.Printf("[Stock.Search] %v", err)
		jsonResponse(w, map[string]string{"error": "조회 실패"}, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write(data)
}

// POST /api/stock/price  body: {"code": "005930"}
func (h *StockHandler) Price(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if !h.checkConfig(w) {
		return
	}

	var req struct {
		Code string `json:"code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Code == "" {
		jsonResponse(w, map[string]string{"error": "code required"}, http.StatusBadRequest)
		return
	}

	path := fmt.Sprintf("/uapi/domestic-stock/v1/quotations/inquire-price?FID_COND_MRKT_DIV_CODE=J&FID_INPUT_ISCD=%s", req.Code)
	data, err := h.kisGet(path, "FHKST01010100")
	if err != nil {
		log.Printf("[Stock.Price] %v", err)
		jsonResponse(w, map[string]string{"error": "조회 실패"}, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write(data)
}
