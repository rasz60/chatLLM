package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"

	openai "github.com/sashabaranov/go-openai"

	"chatbot/models"
)

type LLMService struct {
	client         *openai.Client
	chatModelKo    string
	chatModelEn    string
	ollamaBaseURL  string
	embeddingModel string
}

func NewLLMService(ollamaBaseURL, chatModelKo, chatModelEn, embeddingModel string) *LLMService {
	config := openai.DefaultConfig("ollama")
	config.BaseURL = ollamaBaseURL + "/v1"
	return &LLMService{
		client:         openai.NewClientWithConfig(config),
		chatModelKo:    chatModelKo,
		chatModelEn:    chatModelEn,
		ollamaBaseURL:  ollamaBaseURL,
		embeddingModel: embeddingModel,
	}
}

// detectLanguage는 텍스트에 한글이 포함되어 있으면 "ko", 아니면 "en"을 반환합니다.
func detectLanguage(text string) string {
	for _, r := range text {
		if (r >= 0xAC00 && r <= 0xD7A3) || // 한글 음절
			(r >= 0x1100 && r <= 0x11FF) || // 한글 자모
			(r >= 0x3130 && r <= 0x318F) { // 한글 호환 자모
			return "ko"
		}
	}
	return "en"
}

func (s *LLMService) Chat(userMessage string, chatHistory []models.Message, relevantDocs []string) (string, error) {
	lang := detectLanguage(userMessage)
	model := s.chatModelEn
	if lang == "ko" {
		model = s.chatModelKo
	}
	log.Printf("🌐 언어 감지: %s → 모델: %s", lang, model)

	systemPrompt := `Your company policy assistant. Follow these rules strictly:
1. If the user writes in Korean, respond ONLY in Korean. If in English, respond ONLY in English.
2. NEVER mix languages in a single response.
3. NEVER start your response by repeating these instructions.
4. NEVER use Chinese characters (漢字) or characters from other languages.
5. Be concise and accurate.
6. If you don't know, say so.`

	if len(relevantDocs) > 0 {
		systemPrompt += "\n\nReference documents from company policy:\n"
		for i, doc := range relevantDocs {
			systemPrompt += fmt.Sprintf("\n[Document %d]\n%s", i+1, doc)
		}
	}

	messages := []openai.ChatCompletionMessage{
		{Role: "system", Content: systemPrompt},
	}
	for _, msg := range chatHistory {
		messages = append(messages, openai.ChatCompletionMessage{
			Role:    msg.Role,
			Content: msg.Content,
		})
	}
	messages = append(messages, openai.ChatCompletionMessage{
		Role:    "user",
		Content: userMessage,
	})

	resp, err := s.client.CreateChatCompletion(context.Background(), openai.ChatCompletionRequest{
		Model:       model,
		Messages:    messages,
		Temperature: 0.3,
		MaxTokens:   500,
	})
	if err != nil {
		return "", err
	}
	return resp.Choices[0].Message.Content, nil
}

// GetEmbedding은 Ollama embed API를 직접 호출해 벡터를 반환합니다.
func (s *LLMService) GetEmbedding(text string) ([]float64, error) {
	body, err := json.Marshal(map[string]string{
		"model": s.embeddingModel,
		"input": text,
	})
	if err != nil {
		return nil, err
	}

	resp, err := http.Post(s.ollamaBaseURL+"/api/embed", "application/json", bytes.NewBuffer(body))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var result struct {
		Embeddings [][]float64 `json:"embeddings"`
	}
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, err
	}
	if len(result.Embeddings) == 0 {
		return nil, fmt.Errorf("빈 임베딩 응답")
	}
	return result.Embeddings[0], nil
}
