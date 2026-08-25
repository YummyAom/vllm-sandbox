package handler

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/vllm-sandbox/dashboard-backend/internal/config"
	"github.com/vllm-sandbox/dashboard-backend/internal/service"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins
	},
}

type WSHandler struct {
	dockerSvc service.DockerService
	cfg       *config.Config
}

func NewWSHandler(dockerSvc service.DockerService, cfg *config.Config) *WSHandler {
	return &WSHandler{dockerSvc: dockerSvc, cfg: cfg}
}

func (h *WSHandler) RegisterRoutes(r *gin.Engine) {
	ws := r.Group("/ws")
	{
		ws.GET("/vllm/logs", h.HandleLogs)
		ws.GET("/chat", h.HandleChat)
	}
}

// HandleLogs streams container logs over WebSocket using goroutine channels.
func (h *WSHandler) HandleLogs(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	ctx, cancel := context.WithCancel(c.Request.Context())
	defer cancel()

	lineChan := make(chan string, 100)
	errChan := make(chan error, 1)

	go h.dockerSvc.StreamLogs(ctx, lineChan, errChan)

	ticker := time.NewTicker(20 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case line, ok := <-lineChan:
			if !ok {
				_ = conn.WriteJSON(map[string]string{"type": "error", "message": "Log stream closed"})
				return
			}
			if err := conn.WriteJSON(map[string]string{"type": "log", "message": line}); err != nil {
				return
			}
		case err := <-errChan:
			if err != nil {
				_ = conn.WriteJSON(map[string]string{"type": "error", "message": err.Error()})
				return
			}
		case <-ticker.C:
			if err := conn.WriteJSON(map[string]string{"type": "ping"}); err != nil {
				return
			}
		}
	}
}

// HandleChat handles streaming chat completions over WebSocket.
func (h *WSHandler) HandleChat(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	for {
		_, msgBytes, err := conn.ReadMessage()
		if err != nil {
			return
		}

		var req struct {
			Prompt      string  `json:"prompt"`
			MaxTokens   int     `json:"max_tokens"`
			Temperature float64 `json:"temperature"`
		}
		if err := json.Unmarshal(msgBytes, &req); err != nil {
			_ = conn.WriteJSON(map[string]string{"type": "error", "message": "Invalid JSON"})
			continue
		}

		// Handle streaming completion
		h.streamChatToWS(conn, req.Prompt, req.MaxTokens, req.Temperature)
	}
}

func (h *WSHandler) streamChatToWS(conn *websocket.Conn, prompt string, maxTokens int, temp float64) {
	modelID := "default"
	reqModel, _ := http.NewRequest(http.MethodGet, fmt.Sprintf("%s/v1/models", h.cfg.VLLMAPIBase), nil)
	if resp, err := http.DefaultClient.Do(reqModel); err == nil {
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
			{"role": "user", "content": prompt},
		},
		"max_tokens":   maxTokens,
		"temperature": temp,
		"stream":      true,
	}
	payloadBytes, _ := json.Marshal(payload)

	httpReq, err := http.NewRequest(http.MethodPost, fmt.Sprintf("%s/v1/chat/completions", h.cfg.VLLMAPIBase), bytes.NewReader(payloadBytes))
	if err != nil {
		_ = conn.WriteJSON(map[string]string{"type": "error", "message": err.Error()})
		return
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "text/event-stream")
	if h.cfg.VLLMAPIKey != "" {
		httpReq.Header.Set("Authorization", "Bearer "+h.cfg.VLLMAPIKey)
	}

	tStart := time.Now()
	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		_ = conn.WriteJSON(map[string]string{"type": "error", "message": err.Error()})
		return
	}
	defer resp.Body.Close()

	tokenCount := 0
	var firstTokenTime *float64

	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		dataStr := strings.TrimPrefix(line, "data: ")
		if strings.TrimSpace(dataStr) == "[DONE]" {
			break
		}

		var chunk struct {
			Choices []struct {
				Delta struct {
					Content string `json:"content"`
				} `json:"delta"`
			} `json:"choices"`
		}
		if err := json.Unmarshal([]byte(dataStr), &chunk); err == nil && len(chunk.Choices) > 0 {
			content := chunk.Choices[0].Delta.Content
			if content != "" {
				if firstTokenTime == nil {
					ttft := time.Since(tStart).Seconds()
					firstTokenTime = &ttft
				}
				tokenCount++
				_ = conn.WriteJSON(map[string]string{"type": "token", "content": content})
			}
		}
	}

	elapsed := time.Since(tStart).Seconds()
	tokPerSec := 0.0
	if elapsed > 0 {
		tokPerSec = math.Round((float64(tokenCount)/elapsed)*10) / 10
	}

	_ = conn.WriteJSON(map[string]interface{}{
		"type":           "done",
		"elapsed_sec":    math.Round(elapsed*1000) / 1000,
		"tokens_per_sec": tokPerSec,
		"ttft_sec":       firstTokenTime,
		"token_count":    tokenCount,
	})
}
