import { useState } from 'react'
import { Loader2, Play, Square, RotateCcw, Save, X } from 'lucide-react'
import type { VLLMConfig, Preset } from '../types'
import { cn } from '../lib/utils'

// ─── Slider Field ──────────────────────────────────────────────────────────────
function SliderField({
  label, min, max, step, value, onChange, format,
}: {
  label: string; min: number; max: number; step: number
  value: number; onChange: (v: number) => void; format?: (v: number) => string
}) {
  const display = format ? format(value) : String(value)
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-white/60">{label}</label>
        <span className="text-[11px] font-semibold font-mono text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded min-w-[44px] text-center">
          {display}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="range-input"
      />
    </div>
  )
}

// ─── Toggle Field ──────────────────────────────────────────────────────────────
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none group">
      <div
        onClick={() => onChange(!checked)}
        className={cn(
          'relative w-8 h-4.5 rounded-full transition-colors duration-150 flex-shrink-0',
          checked ? 'bg-primary' : 'bg-border'
        )}
        style={{ height: '18px', width: '32px' }}
      >
        <span
          className={cn(
            'absolute top-[3px] w-3 h-3 rounded-full transition-all duration-150',
            checked ? 'left-[17px] bg-white' : 'left-[3px] bg-white/40'
          )}
        />
      </div>
      <span className="text-xs text-white/60 group-hover:text-white/80 transition-colors">{label}</span>
    </label>
  )
}

// ─── Select Field ──────────────────────────────────────────────────────────────
function SelectField({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-white/60">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-surface border border-border rounded-md text-sm text-white px-3 py-2 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 appearance-none cursor-pointer"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

// ─── Config Panel ──────────────────────────────────────────────────────────────
interface ConfigPanelProps {
  config: VLLMConfig
  presets: Preset[]
  loading: 'launch' | 'stop' | 'restart' | null
  onUpdate: (patch: Partial<VLLMConfig>) => void
  onLaunch: () => void
  onStop: () => void
  onRestart: () => void
  onSavePreset: (name: string) => void
  onLoadPreset: (cfg: VLLMConfig) => void
  onDeletePreset: (name: string) => void
}

export function ConfigPanel({
  config, presets, loading, onUpdate, onLaunch, onStop, onRestart,
  onSavePreset, onLoadPreset, onDeletePreset,
}: ConfigPanelProps) {
  const [presetName, setPresetName] = useState('')

  return (
    <div className="space-y-4">
      {/* Card: Model Config */}
      <div className="bg-elevated border border-border rounded-xl p-4 space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-white/50">⚙️ Model Configuration</h2>

        {/* Model ID */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-white/60">HuggingFace Model ID</label>
          <input
            type="text"
            value={config.model_id}
            onChange={e => onUpdate({ model_id: e.target.value })}
            placeholder="e.g. Qwen/Qwen2.5-7B-Instruct"
            className="w-full bg-surface border border-border rounded-md text-sm text-white px-3 py-2 outline-none placeholder:text-white/20 focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
          />
        </div>

        {/* Presets */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-white/60">Presets</label>
          <div className="flex flex-wrap gap-1.5">
            {presets.map(p => (
              <div
                key={p.name}
                className="group flex items-center gap-1 bg-surface border border-border rounded-full px-2.5 py-1 text-[11px] font-medium text-white/60 hover:text-white hover:border-primary hover:bg-primary/5 transition-all cursor-pointer max-w-[180px]"
              >
                <span className="truncate" onClick={() => onLoadPreset(p.config)}>{p.name}</span>
                <button
                  onClick={() => onDeletePreset(p.name)}
                  className="opacity-0 group-hover:opacity-100 text-danger hover:text-danger/80 transition-opacity ml-0.5 flex-shrink-0"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={presetName}
              onChange={e => setPresetName(e.target.value)}
              placeholder="Preset name..."
              className="flex-1 bg-surface border border-border rounded-md text-xs text-white px-2.5 py-1.5 outline-none placeholder:text-white/20 focus:border-primary transition-all"
            />
            <button
              onClick={() => { if (presetName.trim()) { onSavePreset(presetName.trim()); setPresetName('') } }}
              className="flex items-center gap-1 text-xs font-medium text-white/60 border border-border px-2.5 py-1.5 rounded-md hover:text-white hover:border-primary hover:bg-primary/5 transition-all"
            >
              <Save size={11} /> Save
            </button>
          </div>
        </div>

        <div className="border-t border-border" />

        {/* Sliders */}
        <SliderField
          label="GPU Memory Utilization"
          min={0.1} max={0.98} step={0.01}
          value={config.gpu_memory_utilization}
          onChange={v => onUpdate({ gpu_memory_utilization: v })}
        />
        <SliderField
          label="Max Model Length (tokens)"
          min={512} max={131072} step={512}
          value={config.max_model_len}
          onChange={v => onUpdate({ max_model_len: v })}
          format={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
        />

        {/* Selects */}
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="DType"
            value={config.dtype}
            onChange={v => onUpdate({ dtype: v })}
            options={[
              { value: 'auto', label: 'auto' },
              { value: 'float16', label: 'float16' },
              { value: 'bfloat16', label: 'bfloat16' },
              { value: 'float32', label: 'float32' },
            ]}
          />
          <SelectField
            label="Quantization"
            value={config.quantization ?? ''}
            onChange={v => onUpdate({ quantization: v || undefined })}
            options={[
              { value: '', label: 'None' },
              { value: 'awq', label: 'AWQ' },
              { value: 'gptq', label: 'GPTQ' },
              { value: 'bitsandbytes', label: 'BitsAndBytes' },
            ]}
          />
        </div>

        {/* Toggles */}
        <div className="flex gap-5">
          <Toggle
            label="Trust Remote Code"
            checked={config.trust_remote_code}
            onChange={v => onUpdate({ trust_remote_code: v })}
          />
          <Toggle
            label="Prefix Caching"
            checked={config.enable_prefix_caching}
            onChange={v => onUpdate({ enable_prefix_caching: v })}
          />
        </div>

        {/* Extra args */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-white/60">
            Extra Args <span className="text-white/30 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={config.extra_args ?? ''}
            onChange={e => onUpdate({ extra_args: e.target.value || undefined })}
            placeholder="e.g. --enable-chunked-prefill"
            className="w-full bg-surface border border-border rounded-md text-xs text-white font-mono px-3 py-2 outline-none placeholder:text-white/20 focus:border-primary transition-all"
          />
        </div>

        <div className="border-t border-border" />

        {/* Lifecycle buttons */}
        <div className="flex gap-2">
          <button
            onClick={onLaunch}
            disabled={!!loading}
            className="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white text-sm font-semibold py-2.5 rounded-lg shadow-[0_2px_12px_rgba(79,142,247,0.3)] hover:shadow-[0_4px_20px_rgba(79,142,247,0.45)] hover:-translate-y-px active:translate-y-0 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
          >
            {loading === 'launch' ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            Launch Model
          </button>
          <button
            onClick={onStop}
            disabled={!!loading}
            className="flex items-center gap-1.5 text-danger border border-danger/30 bg-danger/10 hover:bg-danger/20 text-sm font-semibold px-3 py-2.5 rounded-lg hover:shadow-[0_0_16px_rgba(247,95,95,0.2)] transition-all disabled:opacity-40"
          >
            {loading === 'stop' ? <Loader2 size={14} className="animate-spin" /> : <Square size={14} />}
          </button>
          <button
            onClick={onRestart}
            disabled={!!loading}
            className="flex items-center gap-1.5 text-white/60 border border-border hover:text-white hover:border-primary hover:bg-primary/5 text-sm font-semibold px-3 py-2.5 rounded-lg transition-all disabled:opacity-40"
          >
            {loading === 'restart' ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
          </button>
        </div>
      </div>
    </div>
  )
}
