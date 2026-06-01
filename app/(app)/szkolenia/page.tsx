'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { GraduationCap, Plus, ChevronDown, ChevronUp, Users, AlertTriangle } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

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
  valid_until: string | null
  notes: string | null
}

function getDaysLeft(dateStr: string | null): number | null {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - new Date().setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24))
}

function ExpiryBadge({ validUntil }: { validUntil: string | null }) {
  const days = getDaysLeft(validUntil)
  if (days === null) return null
  if (days < 0) return <span className="text-xs font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded-full">Wygasło {Math.abs(days)}d temu</span>
  if (days <= 30) return <span className="text-xs font-medium text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">Wygasa za {days}d</span>
  return <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">Ważne do {formatDate(validUntil!)}</span>
}

export default function SzkoleniaPage() {
  const [logs, setLogs] = useState<Log[]>([])
  const [expanded, setExpanded] = useState(false)
  const [form, setForm] = useState({ topic: '', trainer: '', attendees: '', valid_until: '', notes: '' })
  const [loading, setLoading] = useState(false)
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
    if (!form.topic) { toast.error('Wpisz temat szkolenia'); return }
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
      valid_until: form.valid_until || null,
      notes: form.notes || null,
    })
    setLoading(false)
    if (error) { toast.error('Błąd zapisu: ' + error.message); return }
    toast.success('Szkolenie zapisane!')
    setForm({ topic: '', trainer: '', attendees: '', valid_until: '', notes: '' })
    setExpanded(false)
    fetchLogs()
  }

  const alerts = logs.filter((l) => { const d = getDaysLeft(l.valid_until); return d !== null && d <= 30 })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Szkolenia pracowników</h1>
        <p className="text-sm text-gray-500 mt-0.5">Rejestr szkoleń z zakresu HACCP i higieny</p>
      </div>

      {alerts.length > 0 && (
        <div className="card border-orange-200 bg-orange-50">
          <div className="flex items-center gap-2 text-orange-700 mb-2">
            <AlertTriangle size={16} />
            <p className="font-semibold text-sm">Certyfikaty wymagające odnowienia ({alerts.length})</p>
          </div>
          {alerts.map((l) => (
            <div key={l.id} className="flex items-center gap-2 text-sm text-orange-700 py-0.5 flex-wrap">
              <span>• {l.topic} — {l.attendees.join(', ')}</span>
              <ExpiryBadge validUntil={l.valid_until} />
            </div>
          ))}
        </div>
      )}

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
              <div className="flex flex-wrap gap-2 mb-2">
                {TOPICS.map((t) => (
                  <button key={t} type="button" onClick={() => setForm((p) => ({ ...p, topic: t }))}
                    className={cn('px-3 py-1.5 rounded-lg text-sm border transition-colors',
                      form.topic === t ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-medium' : 'border-gray-200 hover:border-gray-300')}>
                    {t}
                  </button>
                ))}
              </div>
              <input className="input text-sm" placeholder="Lub wpisz temat ręcznie" value={form.topic}
                onChange={(e) => setForm((p) => ({ ...p, topic: e.target.value }))} required />
            </div>

            <Input label="Prowadzący / szkoleniowiec" placeholder="np. Anna Nowak, firma zewnętrzna"
              value={form.trainer} onChange={(e) => setForm((p) => ({ ...p, trainer: e.target.value }))} required />
            <Input label="Uczestnicy (rozdziel przecinkami)" placeholder="Jan Kowalski, Maria Wiśniewska"
              value={form.attendees} onChange={(e) => setForm((p) => ({ ...p, attendees: e.target.value }))} />

            <div>
              <label className="label">Ważność certyfikatu do (opcjonalnie)</label>
              <input type="date" className="input" value={form.valid_until}
                onChange={(e) => setForm((p) => ({ ...p, valid_until: e.target.value }))} />
            </div>

            <Input label="Uwagi" placeholder="Zakres, materiały, certyfikaty"
              value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />

            <Button type="submit" loading={loading}>Zapisz szkolenie</Button>
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
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm text-gray-900">{log.topic}</p>
                      <ExpiryBadge validUntil={log.valid_until} />
                    </div>
                    <p className="text-xs text-gray-500">Prowadzący: {log.trainer}</p>
                    {log.attendees.length > 0 && (
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                        <Users size={10} /> {log.attendees.join(', ')}
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
