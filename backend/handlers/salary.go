package handlers

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/chromedp/chromedp"
)

type SalaryHandler struct {
	dataDir string
}

func NewSalaryHandler(dataDir string) *SalaryHandler {
	return &SalaryHandler{dataDir: dataDir}
}

// GET /api/salary/get_list
func (h *SalaryHandler) GetList(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	data := map[string][]string{}

	if _, err := os.Stat(h.dataDir); os.IsNotExist(err) {
		jsonResponse(w, data, http.StatusOK)
		return
	}

	entries, err := os.ReadDir(h.dataDir)
	if err != nil {
		jsonResponse(w, data, http.StatusOK)
		return
	}

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		year := entry.Name()
		yearDir := filepath.Join(h.dataDir, year)
		files, err := os.ReadDir(yearDir)
		if err != nil {
			continue
		}
		var months []string
		for _, f := range files {
			if !f.IsDir() && strings.HasSuffix(f.Name(), ".html") {
				months = append(months, strings.TrimSuffix(f.Name(), ".html"))
			}
		}
		sort.Strings(months)
		if len(months) > 0 {
			data[year] = months
		}
	}

	jsonResponse(w, data, http.StatusOK)
}

// POST /api/salary/open_file
func (h *SalaryHandler) OpenFile(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Year     string `json:"year"`
		Month    string `json:"month"`
		Password string `json:"password"`
		Viewtype string `json:"viewtype"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonResponse(w, map[string]string{"status": "error", "msg": "잘못된 요청입니다."}, http.StatusBadRequest)
		return
	}

	filePath := filepath.Join(h.dataDir, req.Year, req.Month+".html")
	absPath, err := filepath.Abs(filePath)
	if err != nil {
		jsonResponse(w, map[string]string{"status": "error", "msg": "경로 오류입니다."}, http.StatusBadRequest)
		return
	}
	if _, err := os.Stat(absPath); os.IsNotExist(err) {
		jsonResponse(w, map[string]string{"status": "error", "msg": "파일을 찾을 수 없습니다."}, http.StatusNotFound)
		return
	}

	ctx, cancel := chromedp.NewContext(context.Background())
	defer cancel()
	ctx, cancel = context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	fileURL := "file:///" + strings.ReplaceAll(absPath, `\`, "/")

	unlockErr := chromedp.Run(ctx,
		chromedp.Navigate(fileURL),
		chromedp.WaitVisible(`input[type='password']`, chromedp.ByQuery),
		chromedp.SendKeys(`input[type='password']`, req.Password, chromedp.ByQuery),
		chromedp.KeyEvent("\r"),
		chromedp.WaitVisible(`#MyDiv`, chromedp.ByQuery),
		chromedp.Sleep(1*time.Second),
	)
	if unlockErr != nil {
		jsonResponse(w, map[string]interface{}{"status": "error", "msg": "비밀번호가 틀렸거나 파일을 열 수 없습니다."}, http.StatusBadRequest)
		return
	}

	if req.Viewtype == "img" {
		var boxJSON string
		chromedp.Run(ctx, chromedp.Evaluate(
			`JSON.stringify(document.querySelector('div#MyDiv table').getBoundingClientRect())`,
			&boxJSON,
		))

		var box map[string]float64
		if err := json.Unmarshal([]byte(boxJSON), &box); err == nil {
			w64 := int64(box["width"]) + 50
			h64 := int64(box["height"]) + 300
			if w64 < 100 {
				w64 = 1200
			}
			if h64 < 100 {
				h64 = 900
			}
			chromedp.Run(ctx, chromedp.EmulateViewport(w64, h64))
			chromedp.Run(ctx, chromedp.Sleep(500*time.Millisecond))
		}

		var buf []byte
		if err := chromedp.Run(ctx, chromedp.Screenshot(`div#MyDiv table`, &buf, chromedp.NodeVisible, chromedp.ByQuery)); err != nil {
			jsonResponse(w, map[string]interface{}{"status": "error", "msg": "스크린샷 캡처에 실패했습니다."}, http.StatusInternalServerError)
			return
		}
		screenshot := base64.StdEncoding.EncodeToString(buf)
		jsonResponse(w, map[string]interface{}{"status": "success", "data": []interface{}{}, "screenshot": screenshot}, http.StatusOK)
	} else {
		var result string
		if err := chromedp.Run(ctx, chromedp.Evaluate(parseTableJS, &result)); err != nil {
			jsonResponse(w, map[string]interface{}{"status": "error", "msg": "데이터 파싱에 실패했습니다."}, http.StatusInternalServerError)
			return
		}
		var data []interface{}
		json.Unmarshal([]byte(result), &data)
		if data == nil {
			data = []interface{}{}
		}
		jsonResponse(w, map[string]interface{}{"status": "success", "data": data, "screenshot": ""}, http.StatusOK)
	}
}

// POST /api/salary/upload_check
func (h *SalaryHandler) UploadCheck(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if err := r.ParseMultipartForm(32 << 20); err != nil {
		jsonResponse(w, map[string]string{"status": "error", "msg": "파일 파싱에 실패했습니다."}, http.StatusBadRequest)
		return
	}

	file, _, err := r.FormFile("file")
	if err != nil {
		jsonResponse(w, map[string]string{"status": "error", "msg": "파일을 업로드해주세요."}, http.StatusBadRequest)
		return
	}
	defer file.Close()

	password := r.FormValue("password")
	overwrite := r.FormValue("overwrite") == "true"

	os.MkdirAll(h.dataDir, os.ModePerm)
	tempPath := filepath.Join(h.dataDir, "temp_upload.html")
	tempFile, err := os.Create(tempPath)
	if err != nil {
		jsonResponse(w, map[string]string{"status": "error", "msg": "임시 파일 생성에 실패했습니다."}, http.StatusInternalServerError)
		return
	}
	io.Copy(tempFile, file)
	tempFile.Close()

	absTemp, _ := filepath.Abs(tempPath)
	fileURL := "file:///" + strings.ReplaceAll(absTemp, `\`, "/")

	ctx, cancel := chromedp.NewContext(context.Background())
	defer cancel()
	ctx, cancel = context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	unlockErr := chromedp.Run(ctx,
		chromedp.Navigate(fileURL),
		chromedp.WaitVisible(`input[type='password']`, chromedp.ByQuery),
		chromedp.SendKeys(`input[type='password']`, password, chromedp.ByQuery),
		chromedp.KeyEvent("\r"),
		chromedp.WaitVisible(`#MyDiv`, chromedp.ByQuery),
		chromedp.Sleep(1*time.Second),
	)
	if unlockErr != nil {
		os.Remove(tempPath)
		jsonResponse(w, map[string]string{"status": "error", "msg": "비밀번호가 틀렸거나 파일을 열 수 없습니다."}, http.StatusBadRequest)
		return
	}

	var targetVal string
	chromedp.Run(ctx, chromedp.Evaluate(`
		(function() {
			var el = document.querySelector('div#myDiv table:nth-child(1) table:nth-child(1) td:nth-child(2) b');
			if (!el) el = document.querySelector('div#MyDiv table table td b');
			return el ? el.innerText : '';
		})()
	`, &targetVal))

	if targetVal == "" {
		os.Remove(tempPath)
		jsonResponse(w, map[string]string{"status": "error", "msg": "날짜 정보를 찾을 수 없습니다."}, http.StatusBadRequest)
		return
	}

	re := regexp.MustCompile(`\d+`)
	nums := re.FindAllString(targetVal, -1)
	if len(nums) < 2 {
		os.Remove(tempPath)
		jsonResponse(w, map[string]string{"status": "error", "msg": "날짜 파싱에 실패했습니다."}, http.StatusBadRequest)
		return
	}
	year, month := nums[0], nums[1]

	targetDir := filepath.Join(h.dataDir, year)
	targetFile := filepath.Join(targetDir, month+".html")

	if _, err := os.Stat(targetFile); err == nil && !overwrite {
		os.Remove(tempPath)
		jsonResponse(w, map[string]interface{}{
			"status": "exists",
			"msg":    year + "년 " + month + "월 파일이 이미 존재합니다.",
		}, http.StatusOK)
		return
	}

	os.MkdirAll(targetDir, os.ModePerm)
	if err := os.Rename(tempPath, targetFile); err != nil {
		os.Remove(tempPath)
		jsonResponse(w, map[string]string{"status": "error", "msg": "파일 저장에 실패하였습니다."}, http.StatusInternalServerError)
		return
	}

	jsonResponse(w, map[string]interface{}{
		"status": "success",
		"path":   year + "/" + month + ".html",
	}, http.StatusOK)
}

const parseTableJS = `(function() {
	var tables = document.querySelectorAll('div#MyDiv table table');
	if (!tables || tables.length < 7) return '[]';
	var target = tables[6];
	var rows = target.querySelectorAll('tr');
	var result = [];
	var currentGroupName = '';
	var currentGroupData = {};
	var i = 0;
	while (i < rows.length) {
		var cells = rows[i].querySelectorAll('td');
		if (!cells.length) { i++; continue; }
		var rowspan = cells[0].getAttribute('rowspan');
		var keyCells;
		if (rowspan && parseInt(rowspan) > 1) {
			if (currentGroupName) {
				var obj = {}; obj[currentGroupName] = currentGroupData;
				result.push(obj);
			}
			currentGroupName = cells[0].innerText.replace(/\n/g,'').replace(/ /g,'');
			currentGroupData = {};
			keyCells = Array.from(cells).slice(1);
		} else {
			keyCells = Array.from(cells);
		}
		var keys = [];
		keyCells.forEach(function(c) {
			var txt = c.innerText.trim();
			if (txt && c.getAttribute('width') !== '1') keys.push(txt);
		});
		if (i+1 < rows.length && keys.length) {
			var valueCells = rows[i+1].querySelectorAll('td');
			var values = [];
			Array.from(valueCells).forEach(function(c) {
				if (c.getAttribute('width') === '1') return;
				var inp = c.querySelector('input');
				if (inp) {
					var v = inp.value.trim();
					if (i+2 === rows.length && v === '') return;
					values.push(v);
				} else {
					var v = c.innerText.trim();
					if (v) values.push(v);
				}
			});
			for (var j = 0; j < keys.length; j++) {
				if (j < values.length) currentGroupData[keys[j]] = values[j];
			}
			i += 2;
		} else { i++; }
	}
	if (currentGroupName) {
		var obj = {}; obj[currentGroupName] = currentGroupData;
		result.push(obj);
	}
	return JSON.stringify(result);
})()`
