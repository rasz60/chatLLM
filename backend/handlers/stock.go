package handlers

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"chatbot/config"
)

const kisBaseURL = "https://openapi.koreainvestment.com:9443"

type StockHandler struct {
	cfg         *config.Config
	db          *sql.DB
	token       string
	tokenExpiry time.Time
	mu          sync.Mutex
	client      *http.Client
}

func NewStockHandler(cfg *config.Config, db *sql.DB) *StockHandler {
	return &StockHandler{
		cfg:    cfg,
		db:     db,
		client: &http.Client{Timeout: 15 * time.Second},
	}
}

// ── KIS 인증 ─────────────────────────────────────────────────────
// Author: rassayzsixt X Claude
// Desc
//*KIS API는 OAuth2 Client Credentials 방식으로 인증
//*토큰은 유효기간이 1시간이므로, 만료 5분 전에 갱신하도록 구현 
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
	req.Header.Set("custtype", "P")

	resp, err := h.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	return io.ReadAll(resp.Body)
}

func (h *StockHandler) checkConfig(w http.ResponseWriter) bool {
	if h.cfg.KISAppKey == "" || h.cfg.KISAppSecret == "" {
		jsonResponse(w, map[string]string{"error": "KIS API 키가 설정되지 않았습니다."}, http.StatusBadRequest)
		return false
	}
	return true
}

// ── 공통 타입 ────────────────────────────────────────────────────

// stockSearchResult: 검색/가격 조회에 공통으로 사용하는 종목 정보
// market: "KOSPI"|"KOSDAQ" (국내) / "overseas:NAS"|"overseas:NYS" 등 (해외)
type stockSearchResult struct {
	Pdno     string `json:"pdno"`
	PrdtName string `json:"prdt_name"`
	Market   string `json:"market,omitempty"`
}

func hasKorean(s string) bool {
	for _, c := range s {
		if (c >= 0xAC00 && c <= 0xD7A3) || (c >= 0x3131 && c <= 0x318E) {
			return true
		}
	}
	return false
}

// ── 검색: DB (국내/해외 공통) ────────────────────────────────────
//
// stocks 테이블(seed_stocks.py로 시드)에 국내+해외 종목이 모두 들어있으므로
// 한글명·영문명·종목코드 모두 ILIKE로 검색한다.
// 정렬: 완전일치 코드 → 완전일치 이름 → 전방일치 코드 → 전방일치 이름 → 부분일치

func (h *StockHandler) searchDB(query string) ([]stockSearchResult, error) {
	rows, err := h.db.Query(`
		SELECT code, name, market FROM stocks
		WHERE name ILIKE $1 OR code ILIKE $1
		ORDER BY
			CASE WHEN LOWER(code) = LOWER($2) THEN 0
			     WHEN LOWER(name) = LOWER($2) THEN 1
			     WHEN code ILIKE $3            THEN 2
			     WHEN name ILIKE $3            THEN 3
			     ELSE 4 END
		LIMIT 10
	`, "%"+query+"%", query, query+"%")
	if err != nil {
		return nil, fmt.Errorf("DB search: %w", err)
	}
	defer rows.Close()

	var results []stockSearchResult
	for rows.Next() {
		var r stockSearchResult
		if err := rows.Scan(&r.Pdno, &r.PrdtName, &r.Market); err != nil {
			continue
		}
		results = append(results, r)
	}
	return results, rows.Err()
}

// ── 검색 fallback: 해외 KIS 직접 조회 ───────────────────────────
//
// DB에 없는 종목(신규 상장 등)을 위한 fallback.
// 한글 쿼리는 DB에서만 처리하므로 이 경로에 진입하지 않는다.

var kisExchanges = []struct{ code string }{
	{"NAS"}, {"NYS"}, {"AMS"}, {"TSE"}, {"HKS"}, {"SHS"}, {"SZS"},
}

func (h *StockHandler) searchOverseasByCode(code string) ([]stockSearchResult, error) {
	code = strings.ToUpper(strings.TrimSpace(code))
	for _, exch := range kisExchanges {
		path := fmt.Sprintf("/uapi/overseas-price/v1/quotations/search-stock-info?EXCD=%s&PDNO=%s", exch.code, code)
		data, err := h.kisGet(path, "CTPF1702R")
		if err != nil {
			log.Printf("[Stock.Search] KIS %s/%s req error: %v", exch.code, code, err)
			continue
		}
		var resp struct {
			RtCd   string `json:"rt_cd"`
			Output struct {
				Pdno     string `json:"pdno"`
				PrdtName string `json:"prdt_name"`
			} `json:"output"`
		}
		if err := json.Unmarshal(data, &resp); err != nil || resp.RtCd != "0" || resp.Output.Pdno == "" {
			continue
		}
		return []stockSearchResult{{
			Pdno:     resp.Output.Pdno,
			PrdtName: resp.Output.PrdtName,
			Market:   "overseas:" + exch.code,
		}}, nil
	}
	return nil, nil
}

// yahooToKIS: Yahoo Finance 거래소 코드 → KIS 거래소 코드
var yahooToKIS = map[string]string{
	"NMS": "NAS", "NGM": "NAS", "NCM": "NAS",
	"NYQ": "NYS",
	"ASE": "AMS",
	"TKS": "TSE", "OSA": "TSE",
	"HKG": "HKS",
	"SHH": "SHS", "SHZ": "SZS",
}

func (h *StockHandler) searchOverseasByName(query string) ([]stockSearchResult, error) {
	apiURL := "https://query2.finance.yahoo.com/v1/finance/search?q=" +
		url.QueryEscape(query) + "&quotesCount=10&newsCount=0&listsCount=0"

	req, err := http.NewRequest("GET", apiURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
	req.Header.Set("Accept", "application/json")

	resp, err := h.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("Yahoo Finance: %w", err)
	}
	defer resp.Body.Close()

	var yahooResp struct {
		Quotes []struct {
			Symbol    string `json:"symbol"`
			Shortname string `json:"shortname"`
			Longname  string `json:"longname"`
			Exchange  string `json:"exchange"`
			TypeDisp  string `json:"typeDisp"`
		} `json:"quotes"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&yahooResp); err != nil {
		return nil, fmt.Errorf("Yahoo Finance decode: %w", err)
	}

	var results []stockSearchResult
	for _, q := range yahooResp.Quotes {
		if q.TypeDisp != "Equity" || q.Symbol == "" {
			continue
		}
		name := q.Shortname
		if name == "" {
			name = q.Longname
		}
		if name == "" {
			name = q.Symbol
		}
		kisCode := yahooToKIS[q.Exchange]
		if kisCode == "" {
			continue
		}
		results = append(results, stockSearchResult{
			Pdno:     q.Symbol,
			PrdtName: name,
			Market:   "overseas:" + kisCode,
		})
		if len(results) >= 8 {
			break
		}
	}
	return results, nil
}

// isLikelyTicker: 1~5자 대문자 영문/숫자 조합이면 해외 종목코드로 판단
func isLikelyTicker(s string) bool {
	if len(s) < 1 || len(s) > 5 {
		return false
	}
	for _, c := range s {
		if !((c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '.' || c == '-') {
			return false
		}
	}
	return true
}

// searchOverseas: DB fallback용 해외 종목 검색
// 티커처럼 보이면 KIS 직접 조회 → 그 외엔 Yahoo Finance 이름 검색
func (h *StockHandler) searchOverseas(query string) ([]stockSearchResult, error) {
	upper := strings.ToUpper(strings.TrimSpace(query))
	if isLikelyTicker(upper) {
		results, _ := h.searchOverseasByCode(upper)
		if len(results) > 0 {
			return results, nil
		}
	}
	return h.searchOverseasByName(query)
}

// ── 핸들러 ───────────────────────────────────────────────────────

// POST /api/stock/search
// body: {"query": "삼성전자" | "005930" | "AAPL" | "Apple"}
// 흐름: DB ILIKE 검색 → (DB 미스 + 비한글) 해외 API fallback
func (h *StockHandler) Search(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Query string `json:"query"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || strings.TrimSpace(req.Query) == "" {
		jsonResponse(w, map[string]string{"error": "query required"}, http.StatusBadRequest)
		return
	}
	query := strings.TrimSpace(req.Query)

	if len([]rune(query)) < 2 {
		jsonResponse(w, map[string]any{"output": []stockSearchResult{}}, http.StatusOK)
		return
	}

	var results []stockSearchResult
	var err error

	if h.db != nil {
		results, err = h.searchDB(query)
		if err != nil {
			log.Printf("[Stock.Search] DB query=%q: %v", query, err)
		}
	}

	// DB에 없고 한글이 아닌 경우(영문 티커·이름)만 해외 API 시도
	if len(results) == 0 && !hasKorean(query) && h.cfg.KISAppKey != "" {
		results, err = h.searchOverseas(query)
		if err != nil {
			log.Printf("[Stock.Search] overseas query=%q: %v", query, err)
		}
	}
	if results == nil {
		results = []stockSearchResult{}
	}

	jsonResponse(w, map[string]any{"output": results}, http.StatusOK)
}

// ── 기준가 CRUD ──────────────────────────────────────────────────
// Authorization: Bearer <token> 헤더에서 user_id 추출.
// 토큰 없으면 "default" 사용 (개발/테스트용 fallback).

func (h *StockHandler) resolveUserID(r *http.Request) string {
	userID, _, err := extractUserID(r, h.cfg.JWTSecret)
	if err != nil || userID == "" {
		return "default"
	}
	return userID
}

// GET /api/stock/refprice
// 해당 유저의 전체 기준가 반환: {"data": {"005930": 75000, "AAPL": 180.5}}
func (h *StockHandler) GetRefPrices(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	userID := h.resolveUserID(r)

	rows, err := h.db.Query(
		"SELECT code, ref_price FROM stock_ref_prices WHERE user_id = $1", userID)
	if err != nil {
		log.Printf("[Stock.RefPrice] GET error: %v", err)
		jsonResponse(w, map[string]string{"error": "조회 실패"}, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	data := map[string]float64{}
	for rows.Next() {
		var code string
		var price float64
		if err := rows.Scan(&code, &price); err != nil {
			continue
		}
		data[code] = price
	}
	jsonResponse(w, map[string]any{"data": data}, http.StatusOK)
}

// POST /api/stock/refprice
// body: {"code": "005930", "ref_price": 75000}
func (h *StockHandler) SetRefPrice(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	userID := h.resolveUserID(r)

	var req struct {
		Code     string  `json:"code"`
		RefPrice float64 `json:"ref_price"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Code == "" || req.RefPrice <= 0 {
		jsonResponse(w, map[string]string{"error": "invalid request"}, http.StatusBadRequest)
		return
	}

	_, err := h.db.Exec(`
		INSERT INTO stock_ref_prices (user_id, code, ref_price, updated_at)
		VALUES ($1, $2, $3, NOW())
		ON CONFLICT (user_id, code) DO UPDATE
		SET ref_price = $3, updated_at = NOW()
	`, userID, req.Code, req.RefPrice)
	if err != nil {
		log.Printf("[Stock.RefPrice] SET error: %v", err)
		jsonResponse(w, map[string]string{"error": "저장 실패"}, http.StatusInternalServerError)
		return
	}
	jsonResponse(w, map[string]string{"ok": "1"}, http.StatusOK)
}

// DELETE /api/stock/refprice
// body: {"code": "005930"}
func (h *StockHandler) DeleteRefPrice(w http.ResponseWriter, r *http.Request) {
	if r.Method != "DELETE" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	userID := h.resolveUserID(r)

	var req struct {
		Code string `json:"code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Code == "" {
		jsonResponse(w, map[string]string{"error": "invalid request"}, http.StatusBadRequest)
		return
	}

	h.db.Exec("DELETE FROM stock_ref_prices WHERE user_id = $1 AND code = $2", userID, req.Code)
	jsonResponse(w, map[string]string{"ok": "1"}, http.StatusOK)
}

// ── 관심종목 CRUD ─────────────────────────────────────────────────

// GET /api/stock/watchlist
// 해당 유저의 관심종목 목록: {"stocks": [{code, name, market}, ...]}
func (h *StockHandler) GetWatchlist(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	userID := h.resolveUserID(r)

	rows, err := h.db.Query(
		"SELECT code, name, market FROM stock_watchlist WHERE user_id = $1 ORDER BY added_at", userID)
	if err != nil {
		log.Printf("[Stock.Watchlist] GET error: %v", err)
		jsonResponse(w, map[string]string{"error": "조회 실패"}, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type watchItem struct {
		Code   string `json:"code"`
		Name   string `json:"name"`
		Market string `json:"market"`
	}
	items := []watchItem{}
	for rows.Next() {
		var item watchItem
		if err := rows.Scan(&item.Code, &item.Name, &item.Market); err != nil {
			continue
		}
		items = append(items, item)
	}
	jsonResponse(w, map[string]any{"stocks": items}, http.StatusOK)
}

// POST /api/stock/watchlist
// body: {"code": "005930", "name": "삼성전자", "market": "KOSPI"}
func (h *StockHandler) AddToWatchlist(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	userID := h.resolveUserID(r)

	var req struct {
		Code   string `json:"code"`
		Name   string `json:"name"`
		Market string `json:"market"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Code == "" || req.Name == "" {
		jsonResponse(w, map[string]string{"error": "code and name required"}, http.StatusBadRequest)
		return
	}

	_, err := h.db.Exec(`
		INSERT INTO stock_watchlist (user_id, code, name, market)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (user_id, code) DO UPDATE SET name = $3, market = $4
	`, userID, req.Code, req.Name, req.Market)
	if err != nil {
		log.Printf("[Stock.Watchlist] ADD error: %v", err)
		jsonResponse(w, map[string]string{"error": "저장 실패"}, http.StatusInternalServerError)
		return
	}
	jsonResponse(w, map[string]string{"ok": "1"}, http.StatusOK)
}

// DELETE /api/stock/watchlist
// body: {"code": "005930"}
func (h *StockHandler) RemoveFromWatchlist(w http.ResponseWriter, r *http.Request) {
	if r.Method != "DELETE" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	userID := h.resolveUserID(r)

	var req struct {
		Code string `json:"code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Code == "" {
		jsonResponse(w, map[string]string{"error": "code required"}, http.StatusBadRequest)
		return
	}

	h.db.Exec("DELETE FROM stock_watchlist WHERE user_id = $1 AND code = $2", userID, req.Code)
	jsonResponse(w, map[string]string{"ok": "1"}, http.StatusOK)
}

// POST /api/stock/price
// body (국내): {"code": "005930", "market": "KOSPI"|"KOSDAQ"}
// body (해외): {"code": "AAPL",   "market": "overseas:NAS"}
// market은 검색 결과의 market 필드를 그대로 전달한다.
func (h *StockHandler) Price(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if !h.checkConfig(w) {
		return
	}

	var req struct {
		Code   string `json:"code"`
		Market string `json:"market"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Code == "" {
		jsonResponse(w, map[string]string{"error": "code required"}, http.StatusBadRequest)
		return
	}

	var path, trID string
	if excd, ok := strings.CutPrefix(req.Market, "overseas:"); ok {
		// 해외: HHDFS00000300
		path = fmt.Sprintf("/uapi/overseas-price/v1/quotations/price?AUTH=&EXCD=%s&SYMB=%s", excd, req.Code)
		trID = "HHDFS00000300"
	} else {
		// 국내: FHKST01010100 (KOSPI=J, KOSDAQ=Q)
		mrktDiv := "J"
		if req.Market == "KOSDAQ" {
			mrktDiv = "Q"
		}
		path = fmt.Sprintf("/uapi/domestic-stock/v1/quotations/inquire-price?FID_COND_MRKT_DIV_CODE=%s&FID_INPUT_ISCD=%s", mrktDiv, req.Code)
		trID = "FHKST01010100"
	}

	data, err := h.kisGet(path, trID)
	if err != nil {
		log.Printf("[Stock.Price] %v", err)
		jsonResponse(w, map[string]string{"error": "조회 실패"}, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write(data)
}
