'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Bug, Plus, ChevronDown, ChevronUp } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import { PageHeader } from '@/components/ui/page-header'

const AREAS = ['Kuchnia', 'Magazyn', 'Sala', 'Toalety', 'Zaplecze', 'Zewnętrze']
const RESULTS = ['Brak szkodników', 'Ślady aktywności', 'Znaleziono szkodniki', 'Pułapki puste', 'Pułapki z połowem']

interface Log {
  id: string
  area: string
  result: string
  action_taken: string | null
  inspected_at: string
  inspector: string
  notes: string | null
}

export default function DddPage() {
  const [logs, setLogs] = useState<Log[]>([])
  const [expanded, setExpanded] = useState(false)
  const [form, setForm] = useState({ area: '', result: '', action_taken: '', inspector: '', notes: '' })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const supabase = createClient()

  async function fetchLogs() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('location_id').eq('id', user!.id).single()
    const { data } = await supabase.from('ddd_logs').select('*').eq('location_id', profile?.location_id ?? '').order('inspected_at', { ascending: false }).limit(30)
    setLogs(data ?? [])
  }

  useEffect(() => { fetchLogs() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('location_id').eq('id', user!.id).single()

    const { error } = await supabase.from('ddd_logs').insert({
      location_id: profile?.location_id ?? '',
      area: form.area,
      result: form.result,
      action_taken: form.action_taken || null,
      inspected_at: new Date().toISOString(),
      inspector: form.inspector,
      notes: form.notes || null,
    })

    setLoading(false)
    if (!error) {
      setSuccess(true)
      setForm({ area: '', result: '', action_taken: '', inspector: '', notes: '' })
      fetchLogs()
      setTimeout(() => { setSuccess(false); setExpanded(false) }, 2000)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Kontrola DDD" subtitle="Rejestr deratyzacji, dezynsekcji i dezynfekcji" />

      <div className="card">
        <button type="button" onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between text-left">
          <div className="flex items-center gap-2">
            <div className="bg-brand-navy p-1.5 rounded-lg"><Plus size={14} className="text-white" /></div>
            <span className="font-semibold text-gray-900">Dodaj kontrolę DDD</span>
          </div>
          {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </button>

        {expanded && (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <p className="label">Obszar kontroli</p>
              <div className="flex flex-wrap gap-2">
                {AREAS.map((a) => (
                  <button key={a} type="button" onClick={() => setForm((p) => ({ ...p, area: a }))}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${form.area === a ? 'border-green-700 bg-green-50 text-green-800 font-medium' : 'border-gray-200 hover:border-gray-300'}`}>
                    {a}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="label">Wynik kontroli</p>
              <div className="flex flex-wrap gap-2">
                {RESULTS.map((r) => (
                  <button key={r} type="button" onClick={() => setForm((p) => ({ ...p, result: r }))}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${form.result === r ? 'border-green-700 bg-green-50 text-green-800 font-medium' : 'border-gray-200 hover:border-gray-300'}`}>
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <Input label="Inspektor / firma DDD" placeholder="np. Jan Nowak / Firma DDD Sp. z o.o." value={form.inspector} onChange={(e) => setForm((p) => ({ ...p, inspector: e.target.value }))} required />
            <Input label="Podjęte działania" placeholder="np. Wymiana pułapek, oprysk insektycydem" value={form.action_taken} onChange={(e) => setForm((p) => ({ ...p, action_taken: e.target.value }))} />
            <Input label="Uwagi" placeholder="Dodatkowe informacje" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />

            <Button type="submit" loading={loading} className={success ? 'bg-green-600' : ''}>
              {success ? 'Zapisano!' : 'Zapisz kontrolę'}
            </Button>
          </form>
        )}
      </div>

      {logs.length > 0 ? (
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-3">Historia kontroli ({logs.length})</h2>
          <div className="divide-y divide-gray-50">
            {logs.map((log) => (
              <div key={log.id} className="py-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-sm text-gray-900">{log.area}</p>
                    <p className="text-xs text-gray-600">{log.result}</p>
                    {log.action_taken && <p className="text-xs text-gray-500 mt-0.5">Działanie: {log.action_taken}</p>}
                    <p className="text-xs text-gray-400 mt-0.5">Inspektor: {log.inspector}</p>
                  </div>
                  <p className="text-xs text-gray-400 whitespace-nowrap ml-4">{formatDateTime(log.inspected_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="card border-dashed border-2 border-gray-200 text-center py-12">
          <Bug size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">Brak wpisów kontroli DDD. Dodaj pierwszą kontrolę powyżej.</p>
        </div>
      )}
    </div>
  )
}
