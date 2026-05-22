package handlers

import (
	"bytes"
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
	token       string
	tokenExpiry time.Time
	mu          sync.Mutex
	client      *http.Client
}

func NewStockHandler(cfg *config.Config) *StockHandler {
	return &StockHandler{
		cfg:    cfg,
		client: &http.Client{Timeout: 15 * time.Second},
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

// ── 검색 결과 공통 타입 ──────────────────────────────────────────

type stockSearchResult struct {
	Pdno     string `json:"pdno"`
	PrdtName string `json:"prdt_name"`
	Market   string `json:"market,omitempty"` // "KOSPI"|"KOSDAQ" / "overseas:NAS" 등
}

// detectQueryType: "domestic_code" | "domestic_name" | "overseas"
func detectQueryType(q string) string {
	// 6자리 숫자 → 국내 종목코드
	if len(q) == 6 {
		allDig := true
		for _, c := range q {
			if c < '0' || c > '9' {
				allDig = false
				break
			}
		}
		if allDig {
			return "domestic_code"
		}
	}
	// 한글 포함 → 국내 종목명
	for _, c := range q {
		if (c >= 0xAC00 && c <= 0xD7A3) || (c >= 0x3131 && c <= 0x318E) {
			return "domestic_name"
		}
	}
	return "overseas"
}

// ── 국내: Yahoo Finance 검색 (KSC=KOSPI, KOE=KOSDAQ) ────────────

var yahooKorExch = map[string]string{
	"KSC": "KOSPI",
	"KOE": "KOSDAQ",
}

func (h *StockHandler) searchDomestic(query string, exactCode bool) ([]stockSearchResult, error) {
	apiURL := "https://query2.finance.yahoo.com/v1/finance/search?q=" +
		url.QueryEscape(query) + "&quotesCount=15&newsCount=0&listsCount=0"

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

	var yr struct {
		Quotes []struct {
			Symbol    string `json:"symbol"`
			Shortname string `json:"shortname"`
			Longname  string `json:"longname"`
			Exchange  string `json:"exchange"`
			TypeDisp  string `json:"typeDisp"`
		} `json:"quotes"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&yr); err != nil {
		return nil, fmt.Errorf("Yahoo Finance decode: %w", err)
	}

	var results []stockSearchResult
	for _, q := range yr.Quotes {
		if q.TypeDisp != "Equity" || q.Symbol == "" {
			continue
		}
		market, ok := yahooKorExch[q.Exchange]
		if !ok {
			continue
		}
		code := strings.SplitN(q.Symbol, ".", 2)[0]
		if exactCode && code != query {
			continue
		}
		name := q.Shortname
		if name == "" {
			name = q.Longname
		}
		if name == "" {
			name = code
		}
		results = append(results, stockSearchResult{Pdno: code, PrdtName: name, Market: market})
		if len(results) >= 10 {
			break
		}
	}
	return results, nil
}

// ── 해외: KIS 코드 직접 조회 ─────────────────────────────────────

// kisExchanges: KIS 코드 → 표시명 (market 필드: "overseas:NAS" 형태로 저장)
var kisExchanges = []struct{ code, display string }{
	{"NAS", "NASDAQ"},
	{"NYS", "NYSE"},
	{"AMS", "AMEX"},
	{"TSE", "도쿄"},
	{"HKS", "홍콩"},
	{"SHS", "상해"},
	{"SZS", "심천"},
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

// ── 해외: Yahoo Finance 이름 검색 (영문/한글) ────────────────────

// Yahoo exchange code → KIS exchange code
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

		if mkt, isKor := yahooKorExch[q.Exchange]; isKor {
			code := strings.SplitN(q.Symbol, ".", 2)[0]
			results = append(results, stockSearchResult{Pdno: code, PrdtName: name, Market: mkt})
		} else {
			kisCode := yahooToKIS[q.Exchange]
			if kisCode == "" {
				continue
			}
			results = append(results, stockSearchResult{
				Pdno:     q.Symbol,
				PrdtName: name,
				Market:   "overseas:" + kisCode,
			})
		}
		if len(results) >= 8 {
			break
		}
	}
	return results, nil
}

// isLikelyTicker: 1~6자 영문/숫자/점/하이픈 조합 → 종목코드로 판단
func isLikelyTicker(s string) bool {
	if len(s) < 1 || len(s) > 6 {
		return false
	}
	for _, c := range s {
		if !((c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '.' || c == '-') {
			return false
		}
	}
	return true
}

func (h *StockHandler) searchOverseas(query string) ([]stockSearchResult, error) {
	upper := strings.ToUpper(strings.TrimSpace(query))

	// 짧은 영문 코드처럼 보이면 KIS 직접 조회 우선
	if isLikelyTicker(upper) {
		results, _ := h.searchOverseasByCode(upper)
		if len(results) > 0 {
			return results, nil
		}
	}

	// 이름 검색 (영문/한글) → Yahoo Finance
	return h.searchOverseasByName(query)
}

// ── 핸들러 ───────────────────────────────────────────────────────

// POST /api/stock/search  body: {"query": "005930" | "삼성" | "AAPL" | "Apple" | "애플"}
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

	// 이름 검색 최소 2글자
	if len([]rune(query)) < 2 {
		jsonResponse(w, map[string]any{"output": []stockSearchResult{}}, http.StatusOK)
		return
	}

	qtype := detectQueryType(query)
	var results []stockSearchResult
	var err error

	switch qtype {
	case "domestic_code":
		results, err = h.searchDomestic(query, true)
	case "domestic_name":
		results, err = h.searchDomestic(query, false)
	case "overseas":
		if h.cfg.KISAppKey != "" {
			results, err = h.searchOverseas(query)
		}
	}

	if err != nil {
		log.Printf("[Stock.Search] %s query=%q: %v", qtype, query, err)
	}
	if results == nil {
		results = []stockSearchResult{}
	}

	jsonResponse(w, map[string]any{"output": results}, http.StatusOK)
}

// POST /api/stock/price  body: {"code": "005930", "market": "KOSPI"} or {"code": "AAPL", "market": "overseas:NAS"}
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
		path = fmt.Sprintf("/uapi/overseas-price/v1/quotations/price?AUTH=&EXCD=%s&SYMB=%s", excd, req.Code)
		trID = "HHDFS00000300"
	} else {
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
