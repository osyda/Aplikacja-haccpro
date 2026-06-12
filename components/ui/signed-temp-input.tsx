'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface SignedTempInputProps {
  value: string
  onChange: (value: string) => void
  defaultNegative?: boolean
  placeholder?: string
}

// iOS Safari's numeric keypad (triggered by inputMode="decimal"/"numeric")
// has no minus-sign key, making it impossible to type negative values like
// freezer temperatures. This sign-toggle button works around that.
export function SignedTempInput({ value, onChange, defaultNegative, placeholder }: SignedTempInputProps) {
  const [negative, setNegative] = useState(() => value.startsWith('-') || (!value && !!defaultNegative))

  useEffect(() => {
    if (value) setNegative(value.startsWith('-'))
  }, [value])

  const digits = value.replace('-', '')

  function toggleSign() {
    setNegative(n => {
      const next = !n
      if (digits) onChange(next ? `-${digits}` : digits)
      return next
    })
  }

  function handleDigitsChange(d: string) {
    onChange(d && negative ? `-${d}` : d)
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={toggleSign}
        aria-label={negative ? 'Wartość ujemna — kliknij, aby zmienić na dodatnią' : 'Wartość dodatnia — kliknij, aby zmienić na ujemną'}
        className={cn(
          'w-14 h-14 rounded-xl border-2 text-2xl font-bold flex items-center justify-center shrink-0 select-none transition-colors',
          negative ? 'border-brand-navy bg-brand-navy text-white' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
        )}
      >
        {negative ? '−' : '+'}
      </button>
      <input
        type="number"
        step="0.1"
        min="0"
        inputMode="decimal"
        className="input font-mono text-xl text-center py-3 h-14 flex-1"
        placeholder={placeholder}
        value={digits}
        onChange={e => handleDigitsChange(e.target.value)}
      />
    </div>
  )
}
