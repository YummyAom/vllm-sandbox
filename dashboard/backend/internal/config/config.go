package config

import (
	"os"
)

type Config struct {
	Port              string
	VLLMContainerName string
	VLLMImage         string
	VLLMAPIBase       string
	HFToken           string
	VLLMAPIKey        string
	DockerNetwork     string
	PresetsFile       string
	DCGMExporterURL   string
}

func Load() *Config {
	return &Config{
		Port:              getEnv("PORT", "8080"),
		VLLMContainerName: getEnv("VLLM_CONTAINER_NAME", "vllm-server"),
		VLLMImage:         getEnv("VLLM_IMAGE", "vllm/vllm-openai:latest"),
		VLLMAPIBase:       getEnv("VLLM_API_BASE", "http://vllm-server:8000"),
		HFToken:           getEnv("HF_TOKEN", ""),
		VLLMAPIKey:        getEnv("VLLM_API_KEY", ""),
		DockerNetwork:     getEnv("DOCKER_NETWORK", "vllm_vllm_net"),
		PresetsFile:       getEnv("PRESETS_FILE", "/data/presets.json"),
		DCGMExporterURL:   getEnv("DCGM_EXPORTER_URL", "http://vllm-dcgm-exporter:9400/metrics"),
	}
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}
