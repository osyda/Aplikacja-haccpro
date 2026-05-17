'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { GraduationCap, Plus, ChevronDown, ChevronUp, Users } from 'lucide-react'
import { formatDate } from '@/lib/utils'

const TOPICS = [
  'Zasady HACCP', 'Higiena osobista', 'Alergie pokarmowe',
  'Mycie i dezynfekcja', 'Magazynowanie żywności', 'BHP', 'Prawo żywnościowe',
]

interface Log {
  id: string
  topic: string
  trainer: string
  trained_at: string
  attendees: string[]
  notes: string | null
}

export default function SzkoleniaPage() {
  const [logs, setLogs] = useState<Log[]>([])
  const [expanded, setExpanded] = useState(false)
  const [form, setForm] = useState({ topic: '', trainer: '', attendees: '', notes: '' })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const supabase = createClient()

  async function fetchLogs() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('location_id').eq('id', user!.id).single()
    const { data } = await supabase.from('training_logs').select('*').eq('location_id', profile?.location_id ?? '').order('trained_at', { ascending: false }).limit(30)
    setLogs(data ?? [])
  }

  useEffect(() => { fetchLogs() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('location_id').eq('id', user!.id).single()

    const attendees = form.attendees.split(',').map((s) => s.trim()).filter(Boolean)

    const { error } = await supabase.from('training_logs').insert({
      location_id: profile?.location_id ?? '',
      topic: form.topic,
      trainer: form.trainer,
      trained_at: new Date().toISOString(),
      attendees,
      notes: form.notes || null,
    })

    setLoading(false)
    if (!error) {
      setSuccess(true)
      setForm({ topic: '', trainer: '', attendees: '', notes: '' })
      fetchLogs()
      setTimeout(() => { setSuccess(false); setExpanded(false) }, 2000)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Szkolenia pracowników</h1>
        <p className="text-sm text-gray-500 mt-0.5">Rejestr szkoleń z zakresu HACCP i higieny</p>
      </div>

      <div className="card">
        <button type="button" onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between text-left">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-500 p-1.5 rounded-lg"><Plus size={14} className="text-white" /></div>
            <span className="font-semibold text-gray-900">Dodaj szkolenie</span>
          </div>
          {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </button>

        {expanded && (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <p className="label">Temat szkolenia</p>
              <div className="flex flex-wrap gap-2">
                {TOPICS.map((t) => (
                  <button key={t} type="button" onClick={() => setForm((p) => ({ ...p, topic: t }))}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${form.topic === t ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-medium' : 'border-gray-200 hover:border-gray-300'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <Input label="Temat (ręcznie)" placeholder="np. Obsługa pieca konwekcyjnego" value={form.topic} onChange={(e) => setForm((p) => ({ ...p, topic: e.target.value }))} required />
            <Input label="Prowadzący / szkoleniowiec" placeholder="np. Anna Nowak, firma zewnętrzna" value={form.trainer} onChange={(e) => setForm((p) => ({ ...p, trainer: e.target.value }))} required />
            <Input label="Uczestnicy (rozdziel przecinkami)" placeholder="Jan Kowalski, Maria Wiśniewska" value={form.attendees} onChange={(e) => setForm((p) => ({ ...p, attendees: e.target.value }))} />
            <Input label="Uwagi" placeholder="Zakres, materiały, certyfikaty" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />

            <Button type="submit" loading={loading} className={success ? 'bg-green-600' : ''}>
              {success ? 'Zapisano!' : 'Zapisz szkolenie'}
            </Button>
          </form>
        )}
      </div>

      {logs.length > 0 ? (
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-3">Historia szkoleń ({logs.length})</h2>
          <div className="divide-y divide-gray-50">
            {logs.map((log) => (
              <div key={log.id} className="py-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-sm text-gray-900">{log.topic}</p>
                    <p className="text-xs text-gray-500">Prowadzący: {log.trainer}</p>
                    {log.attendees.length > 0 && (
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                        <Users size={10} />
                        {log.attendees.join(', ')}
                      </p>
                    )}
                    {log.notes && <p className="text-xs text-gray-400 mt-0.5">{log.notes}</p>}
                  </div>
                  <p className="text-xs text-gray-400 whitespace-nowrap ml-4">{formatDate(log.trained_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="card border-dashed border-2 border-gray-200 text-center py-12">
          <GraduationCap size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">Brak wpisów szkoleń. Dodaj pierwsze szkolenie powyżej.</p>
        </div>
      )}
    </div>
  )
}
