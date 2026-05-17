'use client'

import { useState } from 'react'
import { FileText, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

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

  function toggleModule(id: string) {
    setSelectedModules((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    )
  }

  async function handleGenerate() {
    setLoading(true)
    const params = new URLSearchParams({
      modules: selectedModules.join(','),
      month: String(month + 1),
      year: String(year),
    })

    const res = await fetch(`/api/export/pdf?${params}`)
    if (res.ok) {
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `HACCP_${MONTHS[month]}_${year}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    }
    setLoading(false)
  }

  const years = [today.getFullYear() - 1, today.getFullYear()]

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Raporty PDF</h1>
        <p className="text-sm text-gray-500 mt-0.5">Generuj raporty dla Sanepidu i własnej dokumentacji</p>
      </div>

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
          <label className="label">Moduły do raportu</label>
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
