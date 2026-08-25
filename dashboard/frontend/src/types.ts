// Types for vLLM Control Dashboard

export interface VLLMConfig {
  model_id: string
  served_model_name?: string
  gpu_memory_utilization: number
  max_model_len: number
  dtype: string
  quantization?: string
  tensor_parallel_size: number
  trust_remote_code: boolean
  enable_prefix_caching: boolean
  extra_args?: string
}

export interface Preset {
  name: string
  config: VLLMConfig
}

export interface VLLMStatus {
  status: 'ready' | 'running' | 'stopped' | 'error' | 'restarting' | 'unreachable'
  label: string
  color: 'green' | 'yellow' | 'red' | 'gray' | 'orange'
  model?: string
  vram_used_mb?: number
  vram_total_mb?: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'ai'
  content: string
  streaming?: boolean
}

export interface ChatStats {
  tokens_per_sec?: number
  ttft_sec?: number
  elapsed_sec?: number
  token_count?: number
}

export interface LogLine {
  id: number
  text: string
  ts: string
  type: 'error' | 'warn' | 'success' | 'info' | 'default'
}
