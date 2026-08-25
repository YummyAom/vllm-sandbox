package domain

// VLLMConfig represents the deployment parameters for vLLM.
type VLLMConfig struct {
	ModelID              string   `json:"model_id"`
	ServedModelName      *string  `json:"served_model_name,omitempty"`
	GPUMemoryUtilization float64  `json:"gpu_memory_utilization"`
	MaxModelLen          int      `json:"max_model_len"`
	DType                string   `json:"dtype"`
	Quantization         *string  `json:"quantization,omitempty"`
	TensorParallelSize   int      `json:"tensor_parallel_size"`
	TrustRemoteCode      bool     `json:"trust_remote_code"`
	EnablePrefixCaching  bool     `json:"enable_prefix_caching"`
	ExtraArgs            *string  `json:"extra_args,omitempty"`
}

// Preset represents a saved configuration template.
type Preset struct {
	Name   string     `json:"name"`
	Config VLLMConfig `json:"config"`
}

// VLLMStatus represents the current runtime and health status.
type VLLMStatus struct {
	Status      string  `json:"status"`
	Label       string  `json:"label"`
	Color       string  `json:"color"`
	Model       *string `json:"model,omitempty"`
	VRAMUsedMB  *int    `json:"vram_used_mb,omitempty"`
	VRAMTotalMB *int    `json:"vram_total_mb,omitempty"`
}

// ChatRequest represents the inference request payload.
type ChatRequest struct {
	Prompt      string  `json:"prompt"`
	MaxTokens   int     `json:"max_tokens"`
	Temperature float64 `json:"temperature"`
	Stream      bool    `json:"stream"`
}

// ChatResponse represents the response from inference.
type ChatResponse struct {
	Response         string  `json:"response"`
	ElapsedSec       float64 `json:"elapsed_sec"`
	TokensPerSec     float64 `json:"tokens_per_sec"`
	CompletionTokens int     `json:"completion_tokens"`
	PromptTokens     int     `json:"prompt_tokens"`
}
