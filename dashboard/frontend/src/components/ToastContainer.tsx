import { cn } from '../lib/utils'
import type { Toast } from '../hooks/useToast'

const toastStyles: Record<Toast['type'], string> = {
  success: 'border-success/30 text-success',
  error: 'border-danger/30 text-danger',
  warn: 'border-warning/30 text-warning',
  info: 'border-primary/30 text-primary',
}

const icons: Record<Toast['type'], string> = {
  success: '✓',
  error: '✕',
  warn: '⚠',
  info: 'ℹ',
}

export function ToastContainer({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="fixed bottom-5 right-5 flex flex-col gap-2 z-[999]">
      {toasts.map(t => (
        <div
          key={t.id}
          className={cn(
            'flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium bg-elevated border shadow-[0_8px_30px_rgba(0,0,0,0.4)] animate-toast-in max-w-xs',
            toastStyles[t.type]
          )}
        >
          <span className="text-base">{icons[t.type]}</span>
          <span className="text-white/90">{t.message}</span>
        </div>
      ))}
    </div>
  )
}
