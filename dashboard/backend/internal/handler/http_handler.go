package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/vllm-sandbox/dashboard-backend/internal/domain"
	"github.com/vllm-sandbox/dashboard-backend/internal/repository"
	"github.com/vllm-sandbox/dashboard-backend/internal/service"
)

type HTTPHandler struct {
	dockerSvc  service.DockerService
	presetRepo repository.PresetRepository
	chatSvc    service.ChatService
}

func NewHTTPHandler(
	dockerSvc service.DockerService,
	presetRepo repository.PresetRepository,
	chatSvc service.ChatService,
) *HTTPHandler {
	return &HTTPHandler{
		dockerSvc:  dockerSvc,
		presetRepo: presetRepo,
		chatSvc:    chatSvc,
	}
}

func (h *HTTPHandler) RegisterRoutes(r *gin.Engine) {
	api := r.Group("/api")
	{
		vllm := api.Group("/vllm")
		{
			vllm.GET("/status", h.GetStatus)
			vllm.POST("/start", h.Start)
			vllm.POST("/stop", h.Stop)
			vllm.POST("/restart", h.Restart)
			vllm.GET("/presets", h.GetPresets)
			vllm.POST("/presets", h.SavePreset)
			vllm.DELETE("/presets/:name", h.DeletePreset)
		}
		api.POST("/chat", h.Chat)
	}
}

func (h *HTTPHandler) GetStatus(c *gin.Context) {
	status, err := h.dockerSvc.GetStatus(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, status)
}

func (h *HTTPHandler) Start(c *gin.Context) {
	var cfg domain.VLLMConfig
	if err := c.ShouldBindJSON(&cfg); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid configuration payload: " + err.Error()})
		return
	}

	if err := h.dockerSvc.Start(c.Request.Context(), cfg); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Failed to start vLLM: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "vLLM starting with model: " + cfg.ModelID,
	})
}

func (h *HTTPHandler) Stop(c *gin.Context) {
	if err := h.dockerSvc.Stop(c.Request.Context()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Failed to stop: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "vLLM engine stopped. VRAM released.",
	})
}

func (h *HTTPHandler) Restart(c *gin.Context) {
	if err := h.dockerSvc.Restart(c.Request.Context()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Failed to restart: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "vLLM restarting...",
	})
}

func (h *HTTPHandler) GetPresets(c *gin.Context) {
	presets, err := h.presetRepo.GetAll()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, presets)
}

func (h *HTTPHandler) SavePreset(c *gin.Context) {
	var preset domain.Preset
	if err := c.ShouldBindJSON(&preset); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.presetRepo.Save(preset); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Preset saved"})
}

func (h *HTTPHandler) DeletePreset(c *gin.Context) {
	name := c.Param("name")
	if err := h.presetRepo.Delete(name); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func (h *HTTPHandler) Chat(c *gin.Context) {
	var req domain.ChatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	resp, err := h.chatSvc.Chat(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"detail": "vLLM inference error: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, resp)
}
