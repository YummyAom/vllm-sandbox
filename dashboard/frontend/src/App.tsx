import { useState } from 'react'
import { Topbar } from './components/Topbar'
import { ConfigPanel } from './components/ConfigPanel'
import { LogViewer } from './components/LogViewer'
import { ChatPlayground } from './components/ChatPlayground'
import { ToastContainer } from './components/ToastContainer'
import {
  useVLLMStatus, usePresets, useConfig,
  useVLLMLifecycle, useLogStream, useChat,
} from './hooks/useVLLM'
import { useToast } from './hooks/useToast'
import { cn } from './lib/utils'

type Tab = 'logs' | 'chat'

export default function App() {
  const [tab, setTab] = useState<Tab>('logs')

  // Hooks
  const status = useVLLMStatus()
  const { presets, save: savePreset, remove: deletePreset } = usePresets()
  const { config, update: updateConfig, setConfig } = useConfig()
  const { launch, stop, restart, loading } = useVLLMLifecycle()
  const { logs, connected, connect, disconnect, clear: clearLogs, getRaw } = useLogStream()
  const { messages, stats, streaming, sendMessage } = useChat()
  const { toasts, toast } = useToast()

  // Handlers
  const handleLaunch = async () => {
    if (!config.model_id) { toast('Enter a Model ID', 'warn'); return }
    connect() // Auto-connect logs
    toast(`🚀 Launching ${config.model_id}...`, 'info')
    try {
      const msg = await launch(config)
      toast(msg, 'success')
    } catch (e: unknown) {
      toast('Launch failed: ' + (e instanceof Error ? e.message : String(e)), 'error')
    }
  }

  const handleStop = async () => {
    try {
      const msg = await stop()
      toast(msg, 'success')
    } catch (e: unknown) {
      toast('Stop failed: ' + (e instanceof Error ? e.message : String(e)), 'error')
    }
  }

  const handleRestart = async () => {
    try {
      const msg = await restart()
      toast(msg, 'success')
    } catch (e: unknown) {
      toast('Restart failed: ' + (e instanceof Error ? e.message : String(e)), 'error')
    }
  }

  const handleSavePreset = async (name: string) => {
    await savePreset(name, config)
    toast(`💾 Preset "${name}" saved`, 'success')
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(getRaw())
    toast('Logs copied to clipboard', 'success')
  }

  return (
    <div className="flex flex-col h-full bg-base">
      <Topbar status={status} />

      {/* Main layout */}
      <div className="flex flex-1 pt-[54px] overflow-hidden">

        {/* ── Left sidebar ── */}
        <aside className="w-[360px] flex-shrink-0 bg-surface border-r border-border overflow-y-auto p-4 space-y-4">
          <ConfigPanel
            config={config}
            presets={presets}
            loading={loading}
            onUpdate={updateConfig}
            onLaunch={handleLaunch}
            onStop={handleStop}
            onRestart={handleRestart}
            onSavePreset={handleSavePreset}
            onLoadPreset={setConfig}
            onDeletePreset={deletePreset}
          />
        </aside>

        {/* ── Right panel ── */}
        <main className="flex-1 flex flex-col overflow-hidden bg-base">
          {/* Tab bar */}
          <div className="flex border-b border-border bg-surface flex-shrink-0 px-4">
            {(['logs', 'chat'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'px-4 py-3.5 text-[13px] font-medium border-b-2 transition-all',
                  tab === t
                    ? 'text-primary border-primary'
                    : 'text-white/40 border-transparent hover:text-white/70'
                )}
              >
                {t === 'logs' ? '📜 Live Logs' : '💬 Playground'}
              </button>
            ))}
          </div>

          {/* Panes */}
          <div className="flex-1 overflow-hidden">
            {tab === 'logs' ? (
              <LogViewer
                logs={logs}
                connected={connected}
                onConnect={connect}
                onDisconnect={disconnect}
                onClear={clearLogs}
                onCopy={handleCopy}
              />
            ) : (
              <ChatPlayground
                messages={messages}
                stats={stats}
                streaming={streaming}
                onSend={sendMessage}
              />
            )}
          </div>
        </main>
      </div>

      <ToastContainer toasts={toasts} />
    </div>
  )
}
