package main

import (
	"log"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/vllm-sandbox/dashboard-backend/internal/config"
	"github.com/vllm-sandbox/dashboard-backend/internal/handler"
	"github.com/vllm-sandbox/dashboard-backend/internal/repository"
	"github.com/vllm-sandbox/dashboard-backend/internal/service"
)

func main() {
	cfg := config.Load()

	// Set Gin mode
	gin.SetMode(gin.ReleaseMode)
	router := gin.New()
	router.Use(gin.Recovery())

	// CORS configuration
	corsConfig := cors.DefaultConfig()
	corsConfig.AllowAllOrigins = true
	corsConfig.AllowHeaders = []string{"Origin", "Content-Length", "Content-Type", "Authorization", "Accept"}
	router.Use(cors.New(corsConfig))

	// Dependency Injection / Clean Layering
	dockerSvc, err := service.NewDockerService(cfg)
	if err != nil {
		log.Fatalf("Failed to initialize Docker service: %v", err)
	}

	presetRepo := repository.NewFilePresetRepository(cfg.PresetsFile)
	chatSvc := service.NewChatService(cfg)

	// Register Handlers
	httpHandler := handler.NewHTTPHandler(dockerSvc, presetRepo, chatSvc)
	httpHandler.RegisterRoutes(router)

	wsHandler := handler.NewWSHandler(dockerSvc, cfg)
	wsHandler.RegisterRoutes(router)

	log.Printf("🚀 vLLM Control Dashboard (Go Edition) listening on :%s", cfg.Port)
	if err := router.Run(":" + cfg.Port); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
