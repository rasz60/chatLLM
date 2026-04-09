package services

import (
	"database/sql"
	"fmt"
	"log"
	"strconv"
	"strings"
)

type SearchService struct {
	db  *sql.DB
	llm *LLMService
}

func NewSearchService(db *sql.DB, llm *LLMService) *SearchService {
	return &SearchService{db: db, llm: llm}
}

// Search는 벡터 검색을 시도하고, 실패 시 키워드 검색으로 폴백합니다.
func (s *SearchService) Search(query string) []string {
	embedding, err := s.llm.GetEmbedding(query)
	if err != nil {
		log.Println("⚠️ 임베딩 실패, 키워드 검색으로 전환:", err)
		return s.keywordSearch(query)
	}
	return s.vectorSearch(embedding, query)
}

func (s *SearchService) vectorSearch(embedding []float64, query string) []string {
	vectorStr := floatSliceToVector(embedding)

	rows, err := s.db.Query(`
		SELECT content FROM documents
		WHERE embedding IS NOT NULL
		ORDER BY embedding <=> $1::vector
		LIMIT 3
	`, vectorStr)
	if err != nil {
		log.Println("⚠️ 벡터 검색 실패, 키워드 검색으로 전환:", err)
		return s.keywordSearch(query)
	}
	defer rows.Close()
	return scanRows(rows, query)
}

func (s *SearchService) keywordSearch(query string) []string {
	rows, err := s.db.Query(`
		SELECT content FROM documents
		WHERE content ILIKE '%' || $1 || '%'
		LIMIT 3
	`, query)
	if err != nil {
		log.Println("⚠️ 키워드 검색 실패:", err)
		return []string{}
	}
	defer rows.Close()
	return scanRows(rows, query)
}

func scanRows(rows *sql.Rows, query string) []string {
	var results []string
	for rows.Next() {
		var content string
		if err := rows.Scan(&content); err != nil {
			continue
		}
		results = append(results, content)
	}
	if len(results) > 0 {
		log.Printf("✓ '%s' 검색결과: %d개 문서", query, len(results))
	} else {
		log.Printf("⚠️ '%s' 검색결과: 없음", query)
	}
	return results
}

func floatSliceToVector(v []float64) string {
	strs := make([]string, len(v))
	for i, f := range v {
		strs[i] = strconv.FormatFloat(f, 'f', -1, 64)
	}
	return fmt.Sprintf("[%s]", strings.Join(strs, ","))
}
