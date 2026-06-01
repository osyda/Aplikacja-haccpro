'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Stethoscope, Plus, ChevronDown, ChevronUp, AlertTriangle, Paperclip, X } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const CERT_TYPES = [
  'Sanitarno-epidemiologiczne',
  'Do celów San.-Epid.',
  'Badanie lekarskie',
  'Orzeczenie PSSE',
]

interface MedRecord {
  id: string
  person_name: string
  certificate_type: string
  valid_until: string
  notes: string | null
  doc_url: string | null
}

function getDaysLeft(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - new Date().setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24))
}

function StatusBadge({ validUntil }: { validUntil: string }) {
  const days = getDaysLeft(validUntil)
  if (days < 0) return <span className="text-xs font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded-full">Wygasło {Math.abs(days)}d temu</span>
  if (days <= 30) return <span className="text-xs font-medium text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">Wygasa za {days}d</span>
  return <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">Ważne {days}d</span>
}

export default function OrzeczenicaPage() {
  const [records, setRecords] = useState<MedRecord[]>([])
  const [expanded, setExpanded] = useState(false)
  const [form, setForm] = useState({ person_name: '', certificate_type: 'Sanitarno-epidemiologiczne', valid_until: '', notes: '' })
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  async function getCtx() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('location_id').eq('id', user!.id).single()
    return { locationId: profile?.location_id ?? '', userId: user!.id }
  }

  async function fetchRecords() {
    const { locationId } = await getCtx()
    const { data } = await supabase.from('medical_records').select('*').eq('location_id', locationId).order('valid_until')
    setRecords(data ?? [])
  }

  useEffect(() => { fetchRecords() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.valid_until) { toast.error('Podaj datę ważności'); return }
    setLoading(true)
    const { locationId, userId } = await getCtx()

    let docUrl: string | null = null
    if (file) {
      const ext = file.name.split('.').pop()
      const path = `medical/${locationId}/${Date.now()}.${ext}`
      const { data: upload, error: uploadError } = await supabase.storage
        .from('documents').upload(path, file, { upsert: false })
      if (uploadError) { toast.error('Błąd uploadu: ' + uploadError.message); setLoading(false); return }
      docUrl = supabase.storage.from('documents').getPublicUrl(upload.path).data.publicUrl
    }

    const { error } = await supabase.from('medical_records').insert({
      location_id: locationId,
      person_name: form.person_name,
      certificate_type: form.certificate_type,
      valid_until: form.valid_until,
      notes: form.notes || null,
      doc_url: docUrl,
      recorded_by: userId,
    })

    setLoading(false)
    if (error) { toast.error('Błąd zapisu: ' + error.message); return }
    toast.success('Orzeczenie dodane!')
    setForm({ person_name: '', certificate_type: 'Sanitarno-epidemiologiczne', valid_until: '', notes: '' })
    setFile(null)
    if (fileRef.current) fileRef.current.value = ''
    setExpanded(false)
    fetchRecords()
  }

  const urgent = records.filter((r) => getDaysLeft(r.valid_until) <= 30)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Orzeczenia lekarskie</h1>
        <p className="text-sm text-gray-500 mt-0.5">Rejestr orzeczeń sanitarno-epidemiologicznych pracowników</p>
      </div>

      {urgent.length > 0 && (
        <div className="card border-red-200 bg-red-50">
          <div className="flex items-center gap-2 text-red-700 mb-2">
            <AlertTriangle size={16} />
            <p className="font-semibold text-sm">Wymagają uwagi ({urgent.length})</p>
          </div>
          {urgent.map((r) => (
            <div key={r.id} className="flex items-center gap-2 text-sm text-red-700 py-0.5 flex-wrap">
              <span>• {r.person_name}</span>
              <StatusBadge validUntil={r.valid_until} />
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <button type="button" onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between text-left">
          <div className="flex items-center gap-2">
            <div className="bg-purple-500 p-1.5 rounded-lg"><Plus size={14} className="text-white" /></div>
            <span className="font-semibold text-gray-900">Dodaj orzeczenie</span>
          </div>
          {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </button>

        {expanded && (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <Input label="Imię i nazwisko pracownika" placeholder="Jan Kowalski"
              value={form.person_name} onChange={(e) => setForm((p) => ({ ...p, person_name: e.target.value }))} required />

            <div>
              <p className="label">Typ orzeczenia</p>
              <div className="flex flex-wrap gap-2">
                {CERT_TYPES.map((t) => (
                  <button key={t} type="button" onClick={() => setForm((p) => ({ ...p, certificate_type: t }))}
                    className={cn('px-3 py-1.5 rounded-lg text-sm border transition-colors',
                      form.certificate_type === t ? 'border-purple-500 bg-purple-50 text-purple-700 font-medium' : 'border-gray-200 hover:border-gray-300')}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Ważne do</label>
              <input type="date" className="input" value={form.valid_until}
                onChange={(e) => setForm((p) => ({ ...p, valid_until: e.target.value }))} required />
            </div>

            <Input label="Uwagi (opcjonalnie)" placeholder="Dodatkowe informacje"
              value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />

            <div>
              <label className="label">Skan orzeczenia (opcjonalnie)</label>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 cursor-pointer hover:border-gray-300 transition-colors">
                  <Paperclip size={14} />
                  {file ? file.name : 'Wybierz plik (JPG, PNG, PDF)'}
                  <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                </label>
                {file && (
                  <button type="button" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = '' }}>
                    <X size={16} className="text-gray-400 hover:text-gray-600" />
                  </button>
                )}
              </div>
            </div>

            <Button type="submit" loading={loading}>Zapisz orzeczenie</Button>
          </form>
        )}
      </div>

      {records.length > 0 ? (
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-3">Rejestr ({records.length})</h2>
          <div className="divide-y divide-gray-50">
            {records.map((r) => (
              <div key={r.id} className="py-3">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <p className="font-medium text-sm text-gray-900">{r.person_name}</p>
                  <StatusBadge validUntil={r.valid_until} />
                </div>
                <p className="text-xs text-gray-500">{r.certificate_type}</p>
                <p className="text-xs text-gray-400">Ważne do: {formatDate(r.valid_until)}</p>
                {r.notes && <p className="text-xs text-gray-400 mt-0.5">{r.notes}</p>}
                {r.doc_url && (
                  <a href={r.doc_url} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-0.5">
                    <Paperclip size={10} /> Skan dokumentu
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="card border-dashed border-2 border-gray-200 text-center py-12">
          <Stethoscope size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">Brak orzeczeń. Dodaj pierwsze orzeczenie powyżej.</p>
        </div>
      )}
    </div>
  )
}
