package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"time"

	"github.com/vllm-sandbox/dashboard-backend/internal/config"
	"github.com/vllm-sandbox/dashboard-backend/internal/domain"
)

type ChatService interface {
	Chat(ctx context.Context, req domain.ChatRequest) (*domain.ChatResponse, error)
}

type chatService struct {
	cfg        *config.Config
	httpClient *http.Client
}

func NewChatService(cfg *config.Config) ChatService {
	return &chatService{
		cfg:        cfg,
		httpClient: &http.Client{Timeout: 120 * time.Second},
	}
}

func (s *chatService) Chat(ctx context.Context, req domain.ChatRequest) (*domain.ChatResponse, error) {
	modelID := "default"
	reqModel, _ := http.NewRequestWithContext(ctx, http.MethodGet, fmt.Sprintf("%s/v1/models", s.cfg.VLLMAPIBase), nil)
	if resp, err := s.httpClient.Do(reqModel); err == nil {
		defer resp.Body.Close()
		var res struct {
			Data []struct {
				ID string `json:"id"`
			} `json:"data"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&res); err == nil && len(res.Data) > 0 {
			modelID = res.Data[0].ID
		}
	}

	payload := map[string]interface{}{
		"model": modelID,
		"messages": []map[string]string{
			{"role": "user", "content": req.Prompt},
		},
		"max_tokens":   req.MaxTokens,
		"temperature": req.Temperature,
	}
	payloadBytes, _ := json.Marshal(payload)

	tStart := time.Now()
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, fmt.Sprintf("%s/v1/chat/completions", s.cfg.VLLMAPIBase), bytes.NewReader(payloadBytes))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	if s.cfg.VLLMAPIKey != "" {
		httpReq.Header.Set("Authorization", "Bearer "+s.cfg.VLLMAPIKey)
	}

	resp, err := s.httpClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("vLLM returned status code %d", resp.StatusCode)
	}

	var completion struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
		Usage struct {
			CompletionTokens int `json:"completion_tokens"`
			PromptTokens     int `json:"prompt_tokens"`
		} `json:"usage"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&completion); err != nil {
		return nil, err
	}

	elapsed := time.Since(tStart).Seconds()
	content := ""
	if len(completion.Choices) > 0 {
		content = completion.Choices[0].Message.Content
	}

	tokPerSec := 0.0
	if elapsed > 0 {
		tokPerSec = math.Round((float64(completion.Usage.CompletionTokens)/elapsed)*10) / 10
	}

	return &domain.ChatResponse{
		Response:         content,
		ElapsedSec:       math.Round(elapsed*1000) / 1000,
		TokensPerSec:     tokPerSec,
		CompletionTokens: completion.Usage.CompletionTokens,
		PromptTokens:     completion.Usage.PromptTokens,
	}, nil
}
