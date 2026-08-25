import { useState, useRef, useEffect } from 'react'
import { Send } from 'lucide-react'
import type { ChatMessage, ChatStats } from '../types'

interface ChatPlaygroundProps {
  messages: ChatMessage[]
  stats: ChatStats | null
  streaming: boolean
  onSend: (prompt: string, temperature: number, maxTokens: number) => void
}

function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex gap-2.5 justify-end animate-msg-in">
      <div className="max-w-[75%] bg-primary text-white text-sm px-3.5 py-2.5 rounded-2xl rounded-br-sm leading-relaxed">
        {content}
      </div>
      <div className="w-8 h-8 rounded-full bg-elevated border border-border flex items-center justify-center text-sm flex-shrink-0">
        👤
      </div>
    </div>
  )
}

function AIBubble({ content, streaming }: { content: string; streaming?: boolean }) {
  return (
    <div className="flex gap-2.5 animate-msg-in">
      <div className="w-8 h-8 rounded-full bg-elevated border border-border flex items-center justify-center text-sm flex-shrink-0">
        🤖
      </div>
      <div className="max-w-[75%] bg-elevated border border-border text-white text-sm px-3.5 py-2.5 rounded-2xl rounded-bl-sm leading-relaxed whitespace-pre-wrap">
        {content}
        {streaming && (
          <span className="inline-block w-0.5 h-3.5 bg-primary ml-0.5 align-middle animate-blink" />
        )}
      </div>
    </div>
  )
}

export function ChatPlayground({ messages, stats, streaming, onSend }: ChatPlaygroundProps) {
  const [input, setInput] = useState('')
  const [temperature, setTemperature] = useState(0.7)
  const [maxTokens, setMaxTokens] = useState(512)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = () => {
    if (!input.trim() || streaming) return
    onSend(input.trim(), temperature, maxTokens)
    setInput('')
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-white/30 space-y-3">
            <span className="text-4xl">💬</span>
            <h3 className="text-base font-medium text-white/50">Quick Playground</h3>
            <p className="text-sm max-w-[260px]">Test your model with custom prompts. Latency metrics are measured automatically.</p>
          </div>
        ) : (
          messages.map(msg =>
            msg.role === 'user'
              ? <UserBubble key={msg.id} content={msg.content} />
              : <AIBubble key={msg.id} content={msg.content} streaming={msg.streaming} />
          )
        )}
        <div ref={bottomRef} />
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="flex gap-4 px-4 py-2 bg-surface border-t border-border text-xs text-white/50 flex-shrink-0">
          <span>🏎 <b className="text-success">{stats.tokens_per_sec} tok/s</b></span>
          <span>⏱ TTFT: <b className="text-white/70">{stats.ttft_sec ? `${(stats.ttft_sec * 1000).toFixed(0)}ms` : '—'}</b></span>
          <span>⏳ Total: <b className="text-white/70">{stats.elapsed_sec ? `${(stats.elapsed_sec * 1000).toFixed(0)}ms` : '—'}</b></span>
          <span>🔢 Tokens: <b className="text-white/70">{stats.token_count}</b></span>
        </div>
      )}

      {/* Input area */}
      <div className="bg-surface border-t border-border p-4 flex-shrink-0 space-y-3">
        {/* Settings */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex justify-between">
              <label className="text-[11px] font-medium text-white/50">Temperature</label>
              <span className="text-[11px] font-mono text-primary">{temperature}</span>
            </div>
            <input type="range" min={0} max={2} step={0.05} value={temperature}
              onChange={e => setTemperature(Number(e.target.value))} className="range-input" />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <label className="text-[11px] font-medium text-white/50">Max Tokens</label>
              <span className="text-[11px] font-mono text-primary">{maxTokens}</span>
            </div>
            <input type="range" min={64} max={4096} step={64} value={maxTokens}
              onChange={e => setMaxTokens(Number(e.target.value))} className="range-input" />
          </div>
        </div>

        {/* Compose */}
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            rows={3}
            placeholder="Type your prompt here... (Enter to send, Shift+Enter for new line)"
            className="flex-1 bg-elevated border border-border rounded-xl text-sm text-white px-3.5 py-2.5 outline-none resize-none placeholder:text-white/20 focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all leading-relaxed"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || streaming}
            className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center shadow-[0_2px_12px_rgba(79,142,247,0.3)] hover:bg-primary/90 hover:shadow-[0_4px_20px_rgba(79,142,247,0.45)] hover:-translate-y-px active:translate-y-0 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none flex-shrink-0"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
