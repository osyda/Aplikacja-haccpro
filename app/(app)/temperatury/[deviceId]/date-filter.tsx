'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useState, Suspense } from 'react'
import { cn } from '@/lib/utils'

type Period = '1d' | '7d' | '30d' | 'month' | 'custom'

const PRESETS: { value: Period; label: string }[] = [
  { value: '1d',   label: 'Dziś' },
  { value: '7d',   label: '7 dni' },
  { value: '30d',  label: '30 dni' },
  { value: 'month', label: 'Ten miesiąc' },
  { value: 'custom', label: 'Własny zakres' },
]

function DateFilterInner() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const activePeriod = (searchParams.get('period') ?? '30d') as Period
  const [from, setFrom] = useState(searchParams.get('from') ?? '')
  const [to, setTo]     = useState(searchParams.get('to')   ?? '')
  const [showCustom, setShowCustom] = useState(activePeriod === 'custom')

  function selectPeriod(p: Period) {
    if (p === 'custom') { setShowCustom(true); return }
    setShowCustom(false)
    router.push(`${pathname}?period=${p}`)
  }

  function applyCustom() {
    if (!from || !to) return
    router.push(`${pathname}?period=custom&from=${from}&to=${to}`)
  }

  return (
    <div className="card space-y-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Zakres dat</p>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map(p => (
          <button
            key={p.value}
            onClick={() => selectPeriod(p.value)}
            className={cn(
              'px-3.5 py-2 rounded-full text-xs font-semibold border transition-colors',
              activePeriod === p.value
                ? 'bg-brand-navy text-white border-brand-navy'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {showCustom && (
        <div className="flex flex-wrap items-end gap-2 pt-1">
          <div>
            <p className="text-xs text-gray-500 mb-1">Od</p>
            <input type="date" className="input text-sm h-10" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Do</p>
            <input type="date" className="input text-sm h-10" value={to} onChange={e => setTo(e.target.value)} />
          </div>
          <button
            onClick={applyCustom}
            disabled={!from || !to}
            className="px-4 py-2 h-10 bg-brand-green text-white text-sm font-medium rounded-lg hover:bg-brand-green-dark disabled:opacity-40 transition-colors"
          >
            Pokaż
          </button>
        </div>
      )}
    </div>
  )
}

export function DateFilter() {
  return (
    <Suspense fallback={null}>
      <DateFilterInner />
    </Suspense>
  )
}
