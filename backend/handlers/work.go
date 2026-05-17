package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"strconv"
	"time"

	"chatbot/models"
)

type WorkHandler struct {
	db *sql.DB
}

func NewWorkHandler(db *sql.DB) *WorkHandler {
	return &WorkHandler{db: db}
}

var workCategories = []string{
	"문의", "점검", "환경설정", "장애조치", "개발", "테스트",
	"회의", "교육", "인수인계", "보고", "출장", "기타",
}

func calcExpected(startDate, endDate *time.Time) int {
	if startDate == nil || endDate == nil {
		return 0
	}
	loc := time.Local
	now := time.Now().In(loc)
	start := time.Date(startDate.Year(), startDate.Month(), startDate.Day(), 9, 0, 0, 0, loc)
	end := time.Date(endDate.Year(), endDate.Month(), endDate.Day(), 18, 0, 0, 0, loc)
	if now.Before(start) {
		return -1
	}
	if !now.Before(end) {
		return 100
	}
	total := end.Sub(start).Seconds()
	if total <= 0 {
		return 0
	}
	current := now.Sub(start).Seconds()
	return int(math.Min(math.Round(current/total*100), 100))
}

func scanWorkRow(id string, category, content sql.NullString, title string, progress int,
	exStart, exEnd, startDate, endDate, createDate, updateDate sql.NullTime, status int) *models.Work {

	var sdPtr, edPtr *time.Time
	if startDate.Valid {
		t := startDate.Time
		sdPtr = &t
	}
	if endDate.Valid {
		t := endDate.Time
		edPtr = &t
	}
	expected := calcExpected(sdPtr, edPtr)

	w := &models.Work{
		ID:       id,
		Title:    title,
		Progress: progress,
		Status:   status,
		Expected: expected,
	}
	if category.Valid {
		w.Category = category.String
	}
	if content.Valid {
		w.Content = content.String
	}
	if exStart.Valid {
		w.ExStartDate = exStart.Time.Format("2006-01-02T15:04:05")
	}
	if exEnd.Valid {
		w.ExEndDate = exEnd.Time.Format("2006-01-02T15:04:05")
	}
	if startDate.Valid {
		w.StartDate = startDate.Time.Format("2006-01-02T15:04:05")
	}
	if endDate.Valid {
		w.EndDate = endDate.Time.Format("2006-01-02T15:04:05")
	}
	if createDate.Valid {
		w.CreateDate = createDate.Time.Format("2006-01-02T15:04:05")
	}
	if updateDate.Valid {
		w.UpdateDate = updateDate.Time.Format("2006-01-02T15:04:05")
	}
	return w
}

const workSelectCols = `SELECT id, category, title, content, progress,
	ex_start_date, ex_end_date, start_date, end_date, create_date, update_date, status
	FROM works`

func scanFromRow(row *sql.Row) (*models.Work, error) {
	var (
		id         string
		category   sql.NullString
		title      string
		content    sql.NullString
		progress   int
		exStart    sql.NullTime
		exEnd      sql.NullTime
		startDate  sql.NullTime
		endDate    sql.NullTime
		createDate sql.NullTime
		updateDate sql.NullTime
		status     int
	)
	err := row.Scan(&id, &category, &title, &content, &progress,
		&exStart, &exEnd, &startDate, &endDate, &createDate, &updateDate, &status)
	if err != nil {
		return nil, err
	}
	return scanWorkRow(id, category, content, title, progress, exStart, exEnd, startDate, endDate, createDate, updateDate, status), nil
}

func scanFromRows(rows *sql.Rows) (*models.Work, error) {
	var (
		id         string
		category   sql.NullString
		title      string
		content    sql.NullString
		progress   int
		exStart    sql.NullTime
		exEnd      sql.NullTime
		startDate  sql.NullTime
		endDate    sql.NullTime
		createDate sql.NullTime
		updateDate sql.NullTime
		status     int
	)
	err := rows.Scan(&id, &category, &title, &content, &progress,
		&exStart, &exEnd, &startDate, &endDate, &createDate, &updateDate, &status)
	if err != nil {
		return nil, err
	}
	return scanWorkRow(id, category, content, title, progress, exStart, exEnd, startDate, endDate, createDate, updateDate, status), nil
}

func parseDate(s string) (time.Time, error) {
	if s == "" {
		return time.Time{}, fmt.Errorf("empty date")
	}
	// try ISO date
	if t, err := time.Parse("2006-01-02", s); err == nil {
		return t, nil
	}
	// try ISO datetime
	if t, err := time.Parse("2006-01-02T15:04:05", s); err == nil {
		return t, nil
	}
	return time.Time{}, fmt.Errorf("cannot parse date: %s", s)
}

// POST /api/work/create
func (h *WorkHandler) Create(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req models.WorkCreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonResponse(w, map[string]string{"message": "잘못된 요청입니다."}, http.StatusBadRequest)
		return
	}

	exStart, err := parseDate(req.ExStartDate)
	if err != nil {
		jsonResponse(w, map[string]string{"message": "시작예정일 형식이 올바르지 않습니다."}, http.StatusBadRequest)
		return
	}
	exEnd, err := parseDate(req.ExEndDate)
	if err != nil {
		jsonResponse(w, map[string]string{"message": "종료예정일 형식이 올바르지 않습니다."}, http.StatusBadRequest)
		return
	}

	startDate := exStart
	endDate := exEnd
	if req.StartDate != "" {
		if t, e := parseDate(req.StartDate); e == nil {
			startDate = t
		}
	}
	if req.EndDate != "" {
		if t, e := parseDate(req.EndDate); e == nil {
			endDate = t
		}
	}

	_, err = h.db.Exec(
		`INSERT INTO works (category, title, content, ex_start_date, ex_end_date, start_date, end_date, progress, status)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0)`,
		req.Category, req.Title, req.Content, exStart, exEnd, startDate, endDate, req.Progress,
	)
	if err != nil {
		jsonResponse(w, map[string]string{"message": "업무 일지 저장에 실패하였습니다. 관리자에게 문의해주세요."}, http.StatusInternalServerError)
		return
	}
	jsonResponse(w, map[string]string{"message": "업무 일지 저장에 성공하였습니다."}, http.StatusCreated)
}

// POST /api/work/read
func (h *WorkHandler) Read(w http.ResponseWriter, r *http.Request) {

	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req models.WorkReadRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonResponse(w, []interface{}{}, http.StatusBadRequest)
		return
	}

	if req.Page == 0 {
		req.Page = 1
	}
	if req.Limit == 0 {
		req.Limit = 15
	}

	// Single record by ID
	if req.ID != "" {
		row := h.db.QueryRow(workSelectCols+` WHERE id = $1`, req.ID)
		work, err := scanFromRow(row)
		if err != nil {
			jsonResponse(w, []models.Work{}, http.StatusOK)
			return
		}
		jsonResponse(w, []models.Work{*work}, http.StatusCreated)
		return
	}

	// Build query
	query := workSelectCols + ` WHERE 1=1`
	args := []interface{}{}
	idx := 1

	// Status filter
	switch req.Status {
	case "0", "1":
		query += fmt.Sprintf(" AND status = $%d", idx)
		statusInt, _ := strconv.Atoi(req.Status)
		args = append(args, statusInt)
		idx++
	default:
		// Progress-based filters (2-5) always query active records
		query += fmt.Sprintf(" AND status = $%d", idx)
		args = append(args, 0)
		idx++
	}

	// Date range
	if req.StartDate != "" && req.EndDate != "" {
		if sd, err := parseDate(req.StartDate); err == nil {
			if ed, err := parseDate(req.EndDate); err == nil {
				query += fmt.Sprintf(" AND start_date >= $%d AND end_date <= $%d", idx, idx+1)
				args = append(args, sd, ed.Add(24*time.Hour))
				idx += 2
			}
		}
	}

	// Category
	if req.Category != "" && req.Category != "전체" {
		query += fmt.Sprintf(" AND category = $%d", idx)
		args = append(args, req.Category)
		idx++
	}

	// Keyword
	if req.Keyword != "" {
		query += fmt.Sprintf(" AND (title ILIKE $%d OR content ILIKE $%d)", idx, idx)
		args = append(args, "%"+req.Keyword+"%")
		idx++
	}

	query += " ORDER BY create_date DESC"
	rows, err := h.db.Query(query, args...)
	if err != nil {
		empty := models.WorkListResponse{List: []models.Work{}, Total: 0, Page: req.Page, Limit: req.Limit}
		jsonResponse(w, empty, http.StatusOK)
		return
	}
	defer rows.Close()

	var all []models.Work
	for rows.Next() {
		work, err := scanFromRows(rows)
		if err != nil {
			continue
		}
		all = append(all, *work)
	}

	// Progress-based status filters (applied in Go)
	if req.Status == "2" || req.Status == "3" || req.Status == "4" || req.Status == "5" {
		filtered := []models.Work{}
		for _, wk := range all {
			switch req.Status {
			case "2": // 진행 중
				if wk.Progress < 100 && wk.Expected >= 0 && wk.Expected < 100 && wk.Progress >= wk.Expected {
					filtered = append(filtered, wk)
				}
			case "3": // 예정
				if wk.Progress < 100 && wk.Expected == -1 {
					filtered = append(filtered, wk)
				}
			case "4": // 지연
				if (wk.Expected >= 0 && wk.Expected < 100 && wk.Progress < wk.Expected) ||
					(wk.Progress < 100 && wk.Expected == 100) {
					filtered = append(filtered, wk)
				}
			case "5": // 완료
				if wk.Progress == 100 {
					filtered = append(filtered, wk)
				}
			}
		}
		all = filtered
	}

	total := len(all)
	skip := (req.Page - 1) * req.Limit
	end := skip + req.Limit
	if skip > total {
		skip = total
	}
	if end > total {
		end = total
	}

	pageData := all[skip:end]
	if pageData == nil {
		pageData = []models.Work{}
	}

	jsonResponse(w, models.WorkListResponse{
		List:  pageData,
		Total: total,
		Page:  req.Page,
		Limit: req.Limit,
	}, http.StatusCreated)
}

// POST /api/work/update
func (h *WorkHandler) Update(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req models.WorkUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonResponse(w, map[string]string{"message": "잘못된 요청입니다."}, http.StatusBadRequest)
		return
	}
	if req.ID == "" {
		jsonResponse(w, map[string]string{"message": "업무 일지 수정에 실패하였습니다. 관리자에게 문의해주세요."}, http.StatusBadRequest)
		return
	}

	exStart, _ := parseDate(req.ExStartDate)
	exEnd, _ := parseDate(req.ExEndDate)

	startDate := exStart
	endDate := exEnd
	if req.StartDate != "" {
		if t, e := parseDate(req.StartDate); e == nil {
			startDate = t
		}
	}
	if req.EndDate != "" {
		if t, e := parseDate(req.EndDate); e == nil {
			endDate = t
		}
	}

	result, err := h.db.Exec(
		`UPDATE works SET category=$1, title=$2, content=$3, ex_start_date=$4, ex_end_date=$5,
		 start_date=$6, end_date=$7, progress=$8, update_date=NOW() WHERE id=$9`,
		req.Category, req.Title, req.Content, exStart, exEnd, startDate, endDate, req.Progress, req.ID,
	)
	if err != nil {
		jsonResponse(w, map[string]string{"message": "업무 일지 수정에 실패하였습니다. 관리자에게 문의해주세요."}, http.StatusInternalServerError)
		return
	}

	msg := "업무 일지 수정에 성공하였습니다."
	if n, _ := result.RowsAffected(); n == 0 {
		msg = "수정할 업무 일지를 찾지 못했습니다."
	}
	jsonResponse(w, map[string]string{"message": msg}, http.StatusCreated)
}

// POST /api/work/delete  (soft delete)
func (h *WorkHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ID == "" {
		jsonResponse(w, map[string]string{"message": "업무 일지 삭제에 실패하였습니다. 관리자에게 문의해주세요."}, http.StatusBadRequest)
		return
	}

	result, err := h.db.Exec(`UPDATE works SET status=1, update_date=NOW() WHERE id=$1`, req.ID)
	if err != nil {
		jsonResponse(w, map[string]string{"message": "업무 일지 삭제에 실패하였습니다. 관리자에게 문의해주세요."}, http.StatusInternalServerError)
		return
	}

	msg := "업무 일지 삭제에 성공하였습니다."
	if n, _ := result.RowsAffected(); n == 0 {
		msg = "삭제할 업무 일지를 찾지 못했습니다."
	}
	jsonResponse(w, map[string]string{"message": msg}, http.StatusCreated)
}

// GET /api/work/categories
func (h *WorkHandler) Categories(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	jsonResponse(w, map[string]interface{}{
		"data": workCategories,
		"msg":  "카테고리 조회에 성공했습니다.",
	}, http.StatusCreated)
}
