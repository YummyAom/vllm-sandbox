import { useState, useEffect, useRef, useCallback } from 'react'
import type { VLLMStatus, Preset, VLLMConfig, LogLine, ChatMessage, ChatStats } from '../types'
import { classifyLogLine, formatTs, nextLogId } from '../lib/utils'

const DEFAULT_CONFIG: VLLMConfig = {
  model_id: 'Qwen/Qwen2.5-0.5B-Instruct',
  gpu_memory_utilization: 0.85,
  max_model_len: 4096,
  dtype: 'auto',
  quantization: undefined,
  tensor_parallel_size: 1,
  trust_remote_code: true,
  enable_prefix_caching: false,
}

// ─── Status Hook ─────────────────────────────────────────────────────────────
export function useVLLMStatus() {
  const [status, setStatus] = useState<VLLMStatus>({ status: 'stopped', label: 'Checking...', color: 'gray' })

  const poll = useCallback(async () => {
    try {
      const res = await fetch('/api/vllm/status')
      const data: VLLMStatus = await res.json()
      setStatus(data)
    } catch {
      setStatus({ status: 'unreachable', label: 'API Unreachable', color: 'red' })
    }
  }, [])

  useEffect(() => {
    poll()
    const id = setInterval(poll, 4000)
    return () => clearInterval(id)
  }, [poll])

  return status
}

// ─── Presets Hook ─────────────────────────────────────────────────────────────
export function usePresets() {
  const [presets, setPresets] = useState<Preset[]>([])

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/vllm/presets')
      setPresets(await res.json())
    } catch {}
  }, [])

  useEffect(() => { load() }, [load])

  const save = async (name: string, config: VLLMConfig) => {
    await fetch('/api/vllm/presets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, config }),
    })
    await load()
  }

  const remove = async (name: string) => {
    await fetch(`/api/vllm/presets/${encodeURIComponent(name)}`, { method: 'DELETE' })
    await load()
  }

  return { presets, save, remove }
}

// ─── Config Hook ──────────────────────────────────────────────────────────────
export function useConfig() {
  const [config, setConfig] = useState<VLLMConfig>(DEFAULT_CONFIG)
  const update = (patch: Partial<VLLMConfig>) => setConfig(c => ({ ...c, ...patch }))
  return { config, update, setConfig }
}

// ─── vLLM Lifecycle Hook ──────────────────────────────────────────────────────
export function useVLLMLifecycle() {
  const [loading, setLoading] = useState<'launch' | 'stop' | 'restart' | null>(null)

  const launch = async (config: VLLMConfig): Promise<string> => {
    setLoading('launch')
    try {
      const res = await fetch('/api/vllm/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Unknown error')
      return data.message
    } finally {
      setLoading(null)
    }
  }

  const stop = async (): Promise<string> => {
    setLoading('stop')
    try {
      const res = await fetch('/api/vllm/stop', { method: 'POST' })
      const data = await res.json()
      return data.message
    } finally {
      setLoading(null)
    }
  }

  const restart = async (): Promise<string> => {
    setLoading('restart')
    try {
      const res = await fetch('/api/vllm/restart', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail)
      return data.message
    } finally {
      setLoading(null)
    }
  }

  return { launch, stop, restart, loading }
}

// ─── Log Stream Hook ──────────────────────────────────────────────────────────
export function useLogStream() {
  const [logs, setLogs] = useState<LogLine[]>([])
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const rawRef = useRef<string[]>([])

  const appendLog = useCallback((text: string) => {
    const line: LogLine = {
      id: nextLogId(),
      text,
      ts: formatTs(),
      type: classifyLogLine(text),
    }
    rawRef.current.push(text)
    if (rawRef.current.length > 2000) rawRef.current.shift()
    setLogs(prev => {
      const next = [...prev, line]
      return next.length > 2000 ? next.slice(-2000) : next
    })
  }, [])

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${protocol}://${window.location.host}/ws/vllm/logs`)
    wsRef.current = ws

    ws.onopen = () => { setConnected(true); appendLog('[Connected to log stream]') }
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data)
      if (msg.type === 'log') appendLog(msg.message)
      else if (msg.type === 'error') appendLog('[Error: ' + msg.message + ']')
    }
    ws.onclose = () => { setConnected(false); appendLog('[Log stream disconnected]') }
    ws.onerror = () => appendLog('[WebSocket error — is vLLM container running?]')
  }, [appendLog])

  const disconnect = useCallback(() => wsRef.current?.close(), [])
  const clear = useCallback(() => { setLogs([]); rawRef.current = [] }, [])
  const getRaw = () => rawRef.current.join('\n')

  return { logs, connected, connect, disconnect, clear, getRaw }
}

// ─── Chat Hook ────────────────────────────────────────────────────────────────
export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [stats, setStats] = useState<ChatStats | null>(null)
  const [streaming, setStreaming] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const aiMsgIdRef = useRef<string | null>(null)

  const sendMessage = useCallback((prompt: string, temperature: number, maxTokens: number) => {
    if (streaming) return

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: prompt }
    const aiMsg: ChatMessage = { id: crypto.randomUUID(), role: 'ai', content: '', streaming: true }
    aiMsgIdRef.current = aiMsg.id

    setMessages(prev => [...prev, userMsg, aiMsg])
    setStats(null)
    setStreaming(true)

    const ensureSocket = (cb: (ws: WebSocket) => void) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        cb(wsRef.current)
        return
      }
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
      const ws = new WebSocket(`${protocol}://${window.location.host}/ws/chat`)
      wsRef.current = ws

      ws.onopen = () => cb(ws)
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data)
        if (msg.type === 'token') {
          setMessages(prev => prev.map(m =>
            m.id === aiMsgIdRef.current ? { ...m, content: m.content + msg.content } : m
          ))
        } else if (msg.type === 'done') {
          setMessages(prev => prev.map(m =>
            m.id === aiMsgIdRef.current ? { ...m, streaming: false } : m
          ))
          setStats({ tokens_per_sec: msg.tokens_per_sec, ttft_sec: msg.ttft_sec, elapsed_sec: msg.elapsed_sec, token_count: msg.token_count })
          setStreaming(false)
        } else if (msg.type === 'error') {
          setMessages(prev => prev.map(m =>
            m.id === aiMsgIdRef.current ? { ...m, content: '⚠️ Error: ' + msg.message, streaming: false } : m
          ))
          setStreaming(false)
        }
      }
      ws.onerror = () => {
        setMessages(prev => prev.map(m =>
          m.id === aiMsgIdRef.current ? { ...m, content: '⚠️ Connection failed. Is vLLM running?', streaming: false } : m
        ))
        setStreaming(false)
      }
    }

    ensureSocket((ws) => {
      ws.send(JSON.stringify({ prompt, temperature, max_tokens: maxTokens }))
    })
  }, [streaming])

  return { messages, stats, streaming, sendMessage }
}
