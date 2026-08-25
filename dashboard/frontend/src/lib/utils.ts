import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function classifyLogLine(text: string): 'error' | 'warn' | 'success' | 'info' | 'default' {
  if (/error|exception|failed|traceback|oom|killed/i.test(text)) return 'error'
  if (/warn/i.test(text)) return 'warn'
  if (/ready|loaded|started|success/i.test(text)) return 'success'
  if (/^\[.*\]/.test(text)) return 'info'
  return 'default'
}

export function formatTs(): string {
  return new Date().toTimeString().slice(0, 8)
}

let logCounter = 0
export function nextLogId() {
  return ++logCounter
}
