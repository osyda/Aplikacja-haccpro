'use client'

import { cn } from '@/lib/utils'

interface TempStepInputProps {
  value: string
  onChange: (value: string) => void
  className?: string
}

// Mirrors the temperature-entry control used when recording fridge/freezer
// readings: ±0.1°C step buttons plus a sign-flip button, so a value like
// -18°C can be reached without ever typing "-" — iOS's numeric keypad
// (inputMode="decimal") has no minus key.
export function TempStepInput({ value, onChange, className }: TempStepInputProps) {
  function adjust(delta: number) {
    const current = parseFloat(value.replace(',', '.'))
    if (isNaN(current)) return
    onChange(String(Math.round((current + delta) * 10) / 10))
  }

  function flipSign() {
    const current = parseFloat(value.replace(',', '.'))
    if (isNaN(current) || current === 0) return
    onChange(String(-current))
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <button
        type="button"
        onClick={flipSign}
        title="Zmień znak (+/−)"
        className="w-12 h-14 rounded-xl border-2 border-gray-200 text-lg font-bold text-gray-500 hover:bg-gray-50 active:bg-gray-100 flex items-center justify-center shrink-0 select-none"
      >
        ±
      </button>
      <button
        type="button"
        onClick={() => adjust(-0.1)}
        className="w-14 h-14 rounded-xl border-2 border-gray-200 text-3xl font-bold text-gray-600 hover:bg-gray-50 active:bg-gray-100 flex items-center justify-center shrink-0 select-none"
      >
        −
      </button>
      <input
        type="number"
        step="0.1"
        inputMode="decimal"
        className="input font-mono text-2xl text-center py-3 h-14 flex-1 min-w-0"
        value={value}
        onChange={e => onChange(e.target.value)}
      />
      <button
        type="button"
        onClick={() => adjust(0.1)}
        className="w-14 h-14 rounded-xl border-2 border-gray-200 text-3xl font-bold text-gray-600 hover:bg-gray-50 active:bg-gray-100 flex items-center justify-center shrink-0 select-none"
      >
        +
      </button>
    </div>
  )
}
