import type { VLLMStatus } from '../types'
import { cn } from '../lib/utils'

import grafanaLogo from '../assets/grafana-logo.webp'

interface TopbarProps {
  status: VLLMStatus
}

export function Topbar({ status }: TopbarProps) {
  const dotClass = cn(
    'w-2 h-2 rounded-full flex-shrink-0 transition-all duration-300',
    {
      green: 'bg-success shadow-[0_0_8px_rgba(61,214,140,0.5)] animate-pulse-green',
      yellow: 'bg-warning shadow-[0_0_8px_rgba(245,166,35,0.4)] animate-pulse-yellow',
      red: 'bg-danger shadow-[0_0_8px_rgba(247,95,95,0.4)]',
      orange: 'bg-warning',
      gray: 'bg-border',
    }[status.color],
  )

  const vramPct = status.vram_used_mb && status.vram_total_mb
    ? Math.round(status.vram_used_mb / status.vram_total_mb * 100)
    : null

  return (
    <header className="fixed top-0 left-0 right-0 h-[54px] bg-surface border-b border-border flex items-center justify-between px-5 z-50 backdrop-blur-md">
      {/* Brand */}
      <div className="flex items-center gap-2">
        <span className="text-xl drop-shadow-[0_0_8px_rgba(79,142,247,0.8)]">⚡</span>
        <span className="text-[15px] font-bold tracking-tight text-white">vLLM Control</span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.8px] text-primary bg-primary/10 border border-primary/30 px-2 py-0.5 rounded-full">
          Dashboard
        </span>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        {/* Status pill */}
        <div className="flex items-center gap-2 bg-elevated border border-border px-3 py-1.5 rounded-full text-xs font-medium">
          <span className={dotClass} />
          <span className="text-white">{status.label}</span>
          {status.model && (
            <span className="text-[10px] text-primary/80 font-mono bg-primary/10 px-1.5 py-0.5 rounded ml-1 max-w-[160px] truncate">
              {status.model}
            </span>
          )}
        </div>

        {/* VRAM bar */}
        {vramPct !== null && (
          <div className="flex items-center gap-2 text-xs text-secondary">
            <span className="font-medium text-white/60">VRAM</span>
            <div className="w-20 h-1.5 bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500"
                style={{ width: `${vramPct}%` }}
              />
            </div>
            <span className="font-semibold text-white text-[11px] font-mono">
              {(status.vram_used_mb! / 1024).toFixed(1)}/{(status.vram_total_mb! / 1024).toFixed(1)} GB
            </span>
          </div>
        )}

        {/* Grafana link */}
        <a
          href="http://localhost:3000"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 text-xs font-medium text-secondary border border-border px-3 py-1.5 rounded-lg hover:text-white hover:border-[#F46800]/50 hover:bg-[#F46800]/10 transition-all duration-150 group"
          title="Open Grafana Observability Dashboard"
        >
          <img
            src={grafanaLogo}
            alt="Grafana"
            className="w-4 h-4 object-contain flex-shrink-0 transition-transform duration-200 group-hover:scale-110"
          />
          <span className="font-semibold text-white/90 group-hover:text-white">Grafana</span>
        </a>
      </div>
    </header>
  )
}
