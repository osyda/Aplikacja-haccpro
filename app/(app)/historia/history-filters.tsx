'use client'

import { Suspense } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { FilterChips } from '@/components/ui/filter-chips'

type ActionFilter = 'all' | 'INSERT' | 'UPDATE' | 'DELETE'

const ACTION_OPTIONS: { value: ActionFilter; label: string }[] = [
  { value: 'all', label: 'Wszystkie' },
  { value: 'INSERT', label: 'Dodane' },
  { value: 'UPDATE', label: 'Zmienione' },
  { value: 'DELETE', label: 'Usunięte' },
]

interface HistoryFiltersProps {
  moduleOptions: { value: string; label: string }[]
}

function HistoryFiltersInner({ moduleOptions }: HistoryFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const action = (searchParams.get('action') ?? 'all') as ActionFilter
  const table = searchParams.get('table') ?? 'all'

  function update(next: { action?: string; table?: string }) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(next)) {
      if (value === undefined) continue
      if (value === 'all') params.delete(key)
      else params.set(key, value)
    }
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  return (
    <div className="space-y-3">
      <FilterChips value={action} onChange={v => update({ action: v })} options={ACTION_OPTIONS} />
      <select
        className="input text-sm w-full sm:w-64"
        value={table}
        onChange={e => update({ table: e.target.value })}
      >
        <option value="all">Wszystkie moduły</option>
        {moduleOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
      </select>
    </div>
  )
}

export function HistoryFilters(props: HistoryFiltersProps) {
  return (
    <Suspense fallback={null}>
      <HistoryFiltersInner {...props} />
    </Suspense>
  )
}
