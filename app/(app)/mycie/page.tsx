'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Droplets, Plus, ChevronDown, ChevronUp } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'

const AREAS = ['Kuchnia', 'Sala', 'Toalety', 'Magazyn', 'Witryna', 'Sprzęt kuchenny', 'Lodówki', 'Podłogi']
const AGENTS = ['Fairy', 'Domestos', 'Clinex', 'Suma Bac D10', 'Incidin Plus', 'Inny']

interface Log {
  id: string
  area: string
  agent: string
  concentration: string | null
  cleaned_at: string
  notes: string | null
}

export default function MyCiePage() {
  const [logs, setLogs] = useState<Log[]>([])
  const [expanded, setExpanded] = useState(false)
  const [form, setForm] = useState({ area: '', agent: '', concentration: '', notes: '' })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const supabase = createClient()

  async function fetchLogs() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('location_id').eq('id', user!.id).single()
    const { data } = await supabase.from('cleaning_logs').select('*').eq('location_id', profile?.location_id ?? '').order('cleaned_at', { ascending: false }).limit(50)
    setLogs(data ?? [])
  }

  useEffect(() => { fetchLogs() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('location_id').eq('id', user!.id).single()

    const { error } = await supabase.from('cleaning_logs').insert({
      location_id: profile?.location_id ?? '',
      area: form.area,
      agent: form.agent,
      concentration: form.concentration || null,
      cleaned_at: new Date().toISOString(),
      recorded_by: user!.id,
      notes: form.notes || null,
    })

    setLoading(false)
    if (!error) {
      setSuccess(true)
      setForm({ area: '', agent: '', concentration: '', notes: '' })
      fetchLogs()
      setTimeout(() => { setSuccess(false); setExpanded(false) }, 2000)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mycie i dezynfekcja</h1>
        <p className="text-sm text-gray-500 mt-0.5">Rejestr czynności mycia i dezynfekcji</p>
      </div>

      <div className="card">
        <button type="button" onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between text-left">
          <div className="flex items-center gap-2">
            <div className="bg-cyan-500 p-1.5 rounded-lg"><Plus size={14} className="text-white" /></div>
            <span className="font-semibold text-gray-900">Dodaj wpis mycia</span>
          </div>
          {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </button>

        {expanded && (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <p className="label">Obszar / miejsce</p>
              <div className="flex flex-wrap gap-2">
                {AREAS.map((a) => (
                  <button key={a} type="button" onClick={() => setForm((p) => ({ ...p, area: a }))}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${form.area === a ? 'border-cyan-500 bg-cyan-50 text-cyan-700 font-medium' : 'border-gray-200 hover:border-gray-300'}`}>
                    {a}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="label">Środek czyszczący</p>
              <div className="flex flex-wrap gap-2">
                {AGENTS.map((a) => (
                  <button key={a} type="button" onClick={() => setForm((p) => ({ ...p, agent: a }))}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${form.agent === a ? 'border-cyan-500 bg-cyan-50 text-cyan-700 font-medium' : 'border-gray-200 hover:border-gray-300'}`}>
                    {a}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input label="Obszar (ręcznie)" placeholder="np. Lodówka przy bufecie" value={form.area} onChange={(e) => setForm((p) => ({ ...p, area: e.target.value }))} required />
              <Input label="Środek (ręcznie)" placeholder="np. Domestos 5%" value={form.agent} onChange={(e) => setForm((p) => ({ ...p, agent: e.target.value }))} required />
              <Input label="Stężenie" placeholder="np. 2%, 5 ml/l" value={form.concentration} onChange={(e) => setForm((p) => ({ ...p, concentration: e.target.value }))} />
              <Input label="Uwagi" placeholder="Dodatkowe informacje" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
            </div>

            <Button type="submit" loading={loading} className={success ? 'bg-green-600' : ''}>
              {success ? 'Zapisano!' : 'Zapisz wpis'}
            </Button>
          </form>
        )}
      </div>

      {logs.length > 0 ? (
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-3">Historia ({logs.length})</h2>
          <div className="divide-y divide-gray-50">
            {logs.map((log) => (
              <div key={log.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm text-gray-900">{log.area}</p>
                  <p className="text-xs text-gray-500">{log.agent}{log.concentration ? ` • ${log.concentration}` : ''}</p>
                  {log.notes && <p className="text-xs text-gray-400 mt-0.5">{log.notes}</p>}
                </div>
                <p className="text-xs text-gray-400 whitespace-nowrap ml-4">{formatDateTime(log.cleaned_at)}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="card border-dashed border-2 border-gray-200 text-center py-12">
          <Droplets size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">Brak wpisów mycia. Dodaj pierwszy wpis powyżej.</p>
        </div>
      )}
    </div>
  )
}
