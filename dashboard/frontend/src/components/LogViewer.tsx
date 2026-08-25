import { useRef, useEffect } from 'react'
import { cn } from '../lib/utils'
import type { LogLine } from '../types'

interface LogViewerProps {
  logs: LogLine[]
  connected: boolean
  onConnect: () => void
  onDisconnect: () => void
  onClear: () => void
  onCopy: () => void
}

const lineColor: Record<LogLine['type'], string> = {
  error: 'text-red-400',
  warn: 'text-warning',
  success: 'text-success',
  info: 'text-white/50',
  default: 'text-white/75',
}

export function LogViewer({ logs, connected, onConnect, onDisconnect, onClear, onCopy }: LogViewerProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const autoScrollRef = useRef(true)

  useEffect(() => {
    if (autoScrollRef.current && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'instant' })
    }
  }, [logs])

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-surface border-b border-border flex-shrink-0">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <div
              onClick={() => { autoScrollRef.current = !autoScrollRef.current }}
              className="relative w-7 h-4 rounded-full bg-border cursor-pointer"
              style={{ width: '28px', height: '16px' }}
            >
              <span className="absolute top-[3px] left-[3px] w-2.5 h-2.5 rounded-full bg-white/40 transition-all" />
            </div>
            <span className="text-xs text-white/50">Auto-scroll</span>
          </label>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onClear} className="text-xs text-white/40 hover:text-white border border-border px-2.5 py-1 rounded-md hover:border-primary/50 transition-all">
            🗑 Clear
          </button>
          <button onClick={onCopy} className="text-xs text-white/40 hover:text-white border border-border px-2.5 py-1 rounded-md hover:border-primary/50 transition-all">
            📋 Copy
          </button>
          <button
            onClick={connected ? onDisconnect : onConnect}
            className={cn(
              'text-xs font-medium border px-2.5 py-1 rounded-md transition-all',
              connected
                ? 'text-danger border-danger/30 bg-danger/10 hover:bg-danger/20'
                : 'text-primary border-primary/30 bg-primary/10 hover:bg-primary/20'
            )}
          >
            {connected ? '⏸ Disconnect' : '▶ Connect'}
          </button>
        </div>
      </div>

      {/* Console output */}
      <div className="flex-1 overflow-y-auto p-3 bg-[#080a10] console-font text-xs leading-relaxed">
        {logs.length === 0 ? (
          <div className="text-white/30 text-center mt-16 font-sans">
            Press <kbd className="bg-elevated border border-border rounded px-1.5 py-0.5 font-sans text-[10px]">▶ Connect</kbd> to stream live container logs...
          </div>
        ) : (
          logs.map(line => (
            <div key={line.id} className={cn('block py-px', lineColor[line.type])}>
              <span className="text-white/25 mr-2 text-[10px] select-none">{line.ts}</span>
              {line.text}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
