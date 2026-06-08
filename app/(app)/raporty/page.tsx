'use client'

import { useState } from 'react'
import { FileText, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'

const MODULES = [
  { id: 'temperatury', label: 'Rejestr temperatur' },
  { id: 'dostawy', label: 'Przyjęcie dostaw' },
  { id: 'mycie', label: 'Mycie i dezynfekcja' },
  { id: 'szkolenia', label: 'Szkolenia pracowników' },
  { id: 'niezgodnosci', label: 'Niezgodności' },
  { id: 'ddd', label: 'Kontrola DDD' },
]

const MONTHS = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień',
]

export default function RaportyPage() {
  const today = new Date()
  const [selectedModules, setSelectedModules] = useState<string[]>(['temperatury', 'dostawy', 'mycie'])
  const [month, setMonth] = useState(today.getMonth())
  const [year, setYear] = useState(today.getFullYear())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function toggleModule(id: string) {
    setSelectedModules((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    )
  }

  const allSelected = selectedModules.length === MODULES.length

  function toggleAll() {
    setSelectedModules(allSelected ? [] : MODULES.map((m) => m.id))
  }

  async function handleGenerate() {
    setLoading(true)
    setError('')
    const params = new URLSearchParams({
      modules: selectedModules.join(','),
      month: String(month + 1),
      year: String(year),
    })

    try {
      const res = await fetch(`/api/export/pdf?${params}`)
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `HACCP_${MONTHS[month]}_${year}.pdf`
        a.click()
        URL.revokeObjectURL(url)
      } else {
        const text = await res.text()
        setError(`Błąd serwera (${res.status}): ${text.slice(0, 300)}`)
      }
    } catch (e) {
      setError('Błąd połączenia: ' + (e instanceof Error ? e.message : String(e)))
    }
    setLoading(false)
  }

  const years = [today.getFullYear() - 1, today.getFullYear()]

  return (
    <div className="max-w-lg space-y-6">
      <PageHeader title="Raporty PDF" subtitle="Generuj raporty dla Sanepidu i własnej dokumentacji" />

      <div className="card space-y-5">
        <div>
          <label className="label">Okres</label>
          <div className="flex gap-3">
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="input flex-1"
            >
              {MONTHS.map((m, i) => (
                <option key={i} value={i}>{m}</option>
              ))}
            </select>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="input w-28"
            >
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="label">Moduły do raportu</label>
            <button type="button" onClick={toggleAll} className="text-xs font-medium text-brand-green hover:text-brand-green-dark">
              {allSelected ? 'Odznacz wszystkie' : 'Zaznacz wszystkie'}
            </button>
          </div>
          <div className="space-y-2">
            {MODULES.map((m) => (
              <label key={m.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="checkbox"
                  checked={selectedModules.includes(m.id)}
                  onChange={() => toggleModule(m.id)}
                  className="rounded text-brand-green focus:ring-brand-green"
                />
                <span className="text-sm text-gray-700">{m.label}</span>
              </label>
            ))}
          </div>
        </div>

        <Button
          onClick={handleGenerate}
          loading={loading}
          disabled={selectedModules.length === 0}
          size="lg"
          className="w-full"
        >
          <Download size={16} />
          Generuj raport PDF — {MONTHS[month]} {year}
        </Button>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg p-3 font-mono break-all">
            {error}
          </div>
        )}

        <p className="text-xs text-gray-400 text-center">
          Raport zostanie pobrany jako plik PDF gotowy do wydruku lub przesłania do Sanepidu.
        </p>
      </div>

      <div className="card bg-gray-50 border-dashed">
        <div className="flex items-center gap-2 mb-2">
          <FileText size={16} className="text-gray-400" />
          <p className="text-sm font-medium text-gray-600">Poprzednie raporty</p>
        </div>
        <p className="text-xs text-gray-400">Historia wygenerowanych raportów — dostępna wkrótce.</p>
      </div>
    </div>
  )
}
