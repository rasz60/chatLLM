package handlers

import (
	cryptorand "crypto/rand"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"net/smtp"
	"regexp"
	"strings"
	"time"

	"chatbot/config"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

var (
	reUsername = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9_-]{4,19}$`)
	reEmail    = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)
	rePhone    = regexp.MustCompile(`^01[0-9]-\d{3,4}-\d{4}$`)
	reLetter   = regexp.MustCompile(`[a-zA-Z]`)
	reDigit    = regexp.MustCompile(`[0-9]`)
)

func checkUsername(s string) string {
	s = strings.TrimSpace(s)
	if len(s) < 5 {
		return "아이디는 5자 이상이어야 합니다."
	}
	if len(s) > 20 {
		return "아이디는 20자 이하여야 합니다."
	}
	if !reUsername.MatchString(s) {
		return "영문/숫자로 시작, 영문·숫자·밑줄(_)·하이픈(-) 만 사용 가능합니다."
	}
	return ""
}

func checkPassword(s string) string {
	if len(s) < 8 {
		return "비밀번호는 8자 이상이어야 합니다."
	}
	if len(s) > 30 {
		return "비밀번호는 30자 이하여야 합니다."
	}
	if !reLetter.MatchString(s) {
		return "영문(a-zA-Z)를 포함해야 합니다."
	}
	if !reDigit.MatchString(s) {
		return "숫자(0-9)를 포함해야 합니다."
	}
	return ""
}

type AuthHandler struct {
	db  *sql.DB
	cfg *config.Config
}

func NewAuthHandler(db *sql.DB, cfg *config.Config) *AuthHandler {
	return &AuthHandler{db: db, cfg: cfg}
}

func (h *AuthHandler) makeToken(userID, username, role string) (string, error) {
	claims := jwtClaims{
		UserID:   userID,
		Username: username,
		Role:     role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(h.cfg.JWTSecret))
}

func (h *AuthHandler) sendEmail(to, code string) error {
	from := h.cfg.SMTPFrom
	subject := "[DEVSIXT] 이메일 인증코드"

	html := fmt.Sprintf(`<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0e1117;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0e1117;padding:40px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#1a1d2e;border-radius:14px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">

        <!-- 헤더 -->
        <tr>
          <td style="background:linear-gradient(135deg,#1e3a5f,#2d5a9e);padding:32px 40px;text-align:center;">
            <div style="font-size:36px;margin-bottom:8px;">
				<span style="
					width: 100px;
					height: 100px;
					display: inline-block;
					font-size: 26pt;
					color: #fff;
					border-radius: 50%;
					background-color: #252c50;
				">ㅁ-ㅁ7</span>
			</div>
          </td>
        </tr>

        <!-- 본문 -->
        <tr>
          <td style="padding:36px 40px;">
            <p style="color:rgba(255,255,255,0.6);font-size:15px;margin:0 0 24px;">
              안녕하세요! 이메일 인증을 완료하려면 아래 인증코드를 입력해주세요.
            </p>

            <!-- 인증코드 박스 -->
            <table width="100%%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:8px 0 28px;">
                  <div style="display:inline-block;background:#0e1117;border:1px solid rgba(99,179,237,0.4);border-radius:12px;padding:20px 48px;">
                    <div style="color:rgba(255,255,255,0.4);font-size:12px;letter-spacing:2px;margin-bottom:8px;">VERIFICATION CODE</div>
                    <div style="color:#63b3ed;font-size:38px;font-weight:700;letter-spacing:12px;">%s</div>
                  </div>
                </td>
              </tr>
            </table>

            <p style="color:rgba(255,255,255,0.4);font-size:13px;margin:0 0 8px;">
              ⏱ 이 코드는 <strong style="color:rgba(255,255,255,0.7);">5분</strong> 후에 만료됩니다.
            </p>
            <p style="color:rgba(255,255,255,0.3);font-size:12px;margin:0;">
              본인이 요청하지 않은 경우 이 이메일을 무시하세요.
            </p>
          </td>
        </tr>

        <!-- 푸터 -->
        <tr>
          <td style="background:rgba(0,0,0,0.25);padding:16px 40px;text-align:center;">
            <p style="color:rgba(255,255,255,0.2);font-size:11px;margin:0;">
              © 2026 DEVSIXT NOTEPAD · 자동 발송 메일입니다.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`, code)

	msg := fmt.Sprintf(
		"From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n%s",
		from, to, subject, html,
	)
	auth := smtp.PlainAuth("", h.cfg.SMTPUser, h.cfg.SMTPPass, h.cfg.SMTPHost)
	return smtp.SendMail(h.cfg.SMTPHost+":"+h.cfg.SMTPPort, auth, from, []string{to}, []byte(msg))
}

// POST /api/auth/send-code
// body: {"target": "test@email.com", "type": "email"|"phone"}
func (h *AuthHandler) SendCode(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		Target string `json:"target"`
		Type   string `json:"type"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonResponse(w, map[string]string{"error": "invalid request"}, http.StatusBadRequest)
		return
	}
	req.Target = strings.TrimSpace(req.Target)
	if req.Target == "" || (req.Type != "email" && req.Type != "phone") {
		jsonResponse(w, map[string]string{"error": "target, type 필수"}, http.StatusBadRequest)
		return
	}
	if req.Type == "email" && !reEmail.MatchString(req.Target) {
		jsonResponse(w, map[string]string{"error": "올바른 이메일 형식이 아닙니다."}, http.StatusBadRequest)
		return
	}
	if req.Type == "phone" && !rePhone.MatchString(req.Target) {
		jsonResponse(w, map[string]string{"error": "올바른 형식이 아닙니다. (예: 010-1234-5678)"}, http.StatusBadRequest)
		return
	}

	// 1분 이내 재발송 방지
	var lastCreated time.Time
	if err := h.db.QueryRow(
		"SELECT created_at FROM verification_codes WHERE target=$1 ORDER BY created_at DESC LIMIT 1",
		req.Target,
	).Scan(&lastCreated); err == nil && time.Since(lastCreated) < 60*time.Second {
		jsonResponse(w, map[string]string{"error": "잠시 후 다시 시도해주세요. (1분 후 재발송 가능)"}, http.StatusTooManyRequests)
		return
	}

	// 6자리 인증코드 생성
	n, _ := cryptorand.Int(cryptorand.Reader, big.NewInt(1000000))
	code := fmt.Sprintf("%06d", n.Int64())

	// 이전 코드 삭제 후 새 코드 저장
	h.db.Exec("DELETE FROM verification_codes WHERE target=$1", req.Target)
	if _, err := h.db.Exec(
		"INSERT INTO verification_codes (target, code, expires_at) VALUES ($1, $2, NOW() + INTERVAL '5 minutes')",
		req.Target, code,
	); err != nil {
		log.Printf("[Auth.SendCode] DB error: %v", err)
		jsonResponse(w, map[string]string{"error": "발송 실패"}, http.StatusInternalServerError)
		return
	}

	if req.Type == "email" {
		if h.cfg.SMTPHost != "" {
			if err := h.sendEmail(req.Target, code); err != nil {
				log.Printf("[Auth.SendCode] 이메일 발송 실패: %v", err)
				jsonResponse(w, map[string]string{"error": "이메일 발송에 실패했습니다."}, http.StatusInternalServerError)
				return
			}
		} else {
			log.Printf("[VERIFICATION] 이메일 인증코드 → %s : %s (SMTP 미설정 — 백엔드 로그 확인)", req.Target, code)
		}
	} else {
		// SMS는 외부 서비스 연동 필요 (Twilio 등). 현재는 백엔드 로그 출력.
		log.Printf("[VERIFICATION] SMS 인증코드 → %s : %s (SMS 서비스 미연동 — 백엔드 로그 확인)", req.Target, code)
	}

	jsonResponse(w, map[string]string{"ok": "1"}, http.StatusOK)
}

// POST /api/auth/verify-code
// body: {"target": "test@email.com", "code": "123456"}
func (h *AuthHandler) VerifyCode(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		Target string `json:"target"`
		Code   string `json:"code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Target == "" || req.Code == "" {
		jsonResponse(w, map[string]string{"error": "invalid request"}, http.StatusBadRequest)
		return
	}

	var id int
	var expires time.Time
	err := h.db.QueryRow(
		"SELECT id, expires_at FROM verification_codes WHERE target=$1 AND code=$2 AND verified=FALSE ORDER BY created_at DESC LIMIT 1",
		req.Target, req.Code,
	).Scan(&id, &expires)

	if err == sql.ErrNoRows {
		jsonResponse(w, map[string]string{"error": "인증코드가 올바르지 않습니다."}, http.StatusBadRequest)
		return
	} else if err != nil {
		jsonResponse(w, map[string]string{"error": "인증 실패"}, http.StatusInternalServerError)
		return
	}
	if time.Now().After(expires) {
		jsonResponse(w, map[string]string{"error": "인증코드가 만료되었습니다. 재발송해주세요."}, http.StatusBadRequest)
		return
	}

	h.db.Exec("UPDATE verification_codes SET verified=TRUE WHERE id=$1", id)
	jsonResponse(w, map[string]string{"ok": "1"}, http.StatusOK)
}

// POST /api/auth/register
// body: {"username","password","email","phone"} — email, phone 중 인증된 하나만 있으면 됨
func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
		Email    string `json:"email"`
		Phone    string `json:"phone"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonResponse(w, map[string]string{"error": "invalid request"}, http.StatusBadRequest)
		return
	}
	req.Username = strings.TrimSpace(req.Username)
	req.Email = strings.TrimSpace(req.Email)
	req.Phone = strings.TrimSpace(req.Phone)

	if msg := checkUsername(req.Username); msg != "" {
		jsonResponse(w, map[string]string{"error": msg}, http.StatusBadRequest)
		return
	}
	if msg := checkPassword(req.Password); msg != "" {
		jsonResponse(w, map[string]string{"error": msg}, http.StatusBadRequest)
		return
	}

	// 이메일 또는 휴대폰 중 하나는 인증되어 있어야 함
	emailVerified := false
	phoneVerified := false

	if req.Email != "" && reEmail.MatchString(req.Email) {
		h.db.QueryRow(
			"SELECT verified FROM verification_codes WHERE target=$1 AND verified=TRUE ORDER BY created_at DESC LIMIT 1",
			req.Email,
		).Scan(&emailVerified)
	}
	if req.Phone != "" && rePhone.MatchString(req.Phone) {
		h.db.QueryRow(
			"SELECT verified FROM verification_codes WHERE target=$1 AND verified=TRUE ORDER BY created_at DESC LIMIT 1",
			req.Phone,
		).Scan(&phoneVerified)
	}

	if !emailVerified && !phoneVerified {
		jsonResponse(w, map[string]string{"error": "이메일 또는 휴대폰 인증이 필요합니다."}, http.StatusBadRequest)
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		jsonResponse(w, map[string]string{"error": "internal error"}, http.StatusInternalServerError)
		return
	}

	// email, phone 중 인증된 값만 저장 (빈 문자열은 NULL로)
	var emailVal, phoneVal *string
	if req.Email != "" {
		emailVal = &req.Email
	}
	if req.Phone != "" {
		phoneVal = &req.Phone
	}

	var userID string
	err = h.db.QueryRow(
		`INSERT INTO users (username, password_hash, email, phone, role) VALUES ($1,$2,$3,$4,'user') RETURNING id`,
		req.Username, string(hash), emailVal, phoneVal,
	).Scan(&userID)
	if err != nil {
		if strings.Contains(err.Error(), "unique") || strings.Contains(err.Error(), "duplicate") {
			jsonResponse(w, map[string]string{"error": "이미 사용 중인 아이디입니다."}, http.StatusConflict)
		} else {
			log.Printf("[Auth.Register] %v", err)
			jsonResponse(w, map[string]string{"error": "가입 실패"}, http.StatusInternalServerError)
		}
		return
	}

	token, err := h.makeToken(userID, req.Username, "user")
	if err != nil {
		jsonResponse(w, map[string]string{"error": "token error"}, http.StatusInternalServerError)
		return
	}
	jsonResponse(w, map[string]any{
		"token":    token,
		"user_id":  userID,
		"username": req.Username,
		"role":     "user",
	}, http.StatusOK)
}

// POST /api/auth/login
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonResponse(w, map[string]string{"error": "invalid request"}, http.StatusBadRequest)
		return
	}

	var userID, passwordHash, role string
	err := h.db.QueryRow(
		`SELECT id, password_hash, COALESCE(role,'user') FROM users WHERE username=$1`, req.Username,
	).Scan(&userID, &passwordHash, &role)
	if err == sql.ErrNoRows {
		jsonResponse(w, map[string]string{"error": "아이디 또는 비밀번호가 올바르지 않습니다."}, http.StatusUnauthorized)
		return
	} else if err != nil {
		log.Printf("[Auth.Login] %v", err)
		jsonResponse(w, map[string]string{"error": "로그인 실패"}, http.StatusInternalServerError)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.Password)); err != nil {
		jsonResponse(w, map[string]string{"error": "아이디 또는 비밀번호가 올바르지 않습니다."}, http.StatusUnauthorized)
		return
	}

	token, err := h.makeToken(userID, req.Username, role)
	if err != nil {
		jsonResponse(w, map[string]string{"error": "token error"}, http.StatusInternalServerError)
		return
	}
	jsonResponse(w, map[string]any{
		"token":    token,
		"user_id":  userID,
		"username": req.Username,
		"role":     role,
	}, http.StatusOK)
}

// GET /api/auth/me
func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	claims, err := extractClaims(r, h.cfg.JWTSecret)
	if err != nil {
		jsonResponse(w, map[string]string{"error": "unauthorized"}, http.StatusUnauthorized)
		return
	}
	jsonResponse(w, map[string]any{
		"user_id":  claims.UserID,
		"username": claims.Username,
		"role":     claims.Role,
	}, http.StatusOK)
}
