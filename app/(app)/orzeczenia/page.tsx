'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Stethoscope, Plus, ChevronDown, ChevronUp, AlertTriangle,
  Paperclip, X, Search, Sparkles, Loader2, CheckCircle2,
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import type { CertScanResult } from '@/app/api/scan-certificate/route'

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

// PESEL stored as first line of notes: "PESEL: XXXXXXXXXXX\nrest of notes"
function encodePesel(pesel: string, notes: string): string | null {
  const p = pesel.trim()
  const n = notes.trim()
  if (p && n) return `PESEL: ${p}\n${n}`
  if (p) return `PESEL: ${p}`
  return n || null
}

function parsePesel(raw: string | null): { pesel: string; notes: string } {
  if (!raw) return { pesel: '', notes: '' }
  if (raw.startsWith('PESEL: ')) {
    const lines = raw.split('\n')
    return { pesel: lines[0].replace('PESEL: ', '').trim(), notes: lines.slice(1).join('\n').trim() }
  }
  return { pesel: '', notes: raw }
}

export default function OrzeczenicaPage() {
  const [records, setRecords] = useState<MedRecord[]>([])
  const [expanded, setExpanded] = useState(false)
  const [form, setForm] = useState({ person_name: '', pesel: '', valid_until: '', notes: '' })
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)

  const [scanning, setScanning] = useState(false)
  const [scanDone, setScanDone] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)
  const scanRef = useRef<HTMLInputElement>(null)
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

  async function handleScan(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setScanning(true)
    setScanDone(false)

    // Pre-fill file attachment so it's not uploaded twice
    setFile(f)

    try {
      const fd = new FormData()
      fd.append('file', f)
      const res = await fetch('/api/scan-certificate', { method: 'POST', body: fd })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? 'Błąd skanowania')
        return
      }
      const result: CertScanResult = await res.json()
      setForm(prev => ({
        ...prev,
        person_name: result.person_name ?? prev.person_name,
        pesel: result.pesel ?? prev.pesel,
        valid_until: result.valid_until ?? prev.valid_until,
      }))
      setScanDone(true)
      setExpanded(true)
      const badge = result.confidence === 'wysoka' ? 'Wysoka pewność' : result.confidence === 'srednia' ? 'Średnia pewność' : 'Niska pewność — sprawdź dane'
      toast.success(`AI: dane wyciągnięte (${badge})`)
    } catch {
      toast.error('Błąd połączenia z AI')
    } finally {
      setScanning(false)
      if (scanRef.current) scanRef.current.value = ''
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.person_name) { toast.error('Podaj imię i nazwisko'); return }
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
      certificate_type: 'Do celów sanitarno-epidemiologicznych',
      valid_until: form.valid_until,
      notes: encodePesel(form.pesel, form.notes),
      doc_url: docUrl,
      recorded_by: userId,
    })

    setLoading(false)
    if (error) { toast.error('Błąd zapisu: ' + error.message); return }
    toast.success('Orzeczenie dodane!')
    setForm({ person_name: '', pesel: '', valid_until: '', notes: '' })
    setFile(null)
    setScanDone(false)
    if (fileRef.current) fileRef.current.value = ''
    setExpanded(false)
    fetchRecords()
  }

  const urgent = records.filter((r) => getDaysLeft(r.valid_until) <= 30)

  return (
    <div className="space-y-6">
      <PageHeader title="Orzeczenia lekarskie" subtitle="Rejestr orzeczeń do celów sanitarno-epidemiologicznych" />

      {/* Urgent alert */}
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

      {/* AI scan panel */}
      <div className={cn(
        'card border-2 transition-colors',
        scanDone ? 'border-green-300 bg-green-50' : 'border-purple-100 bg-purple-50/40'
      )}>
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-xl bg-purple-100">
            <Sparkles size={18} className="text-purple-600" />
          </div>
          <div>
            <p className="font-semibold text-sm text-gray-900">Skanuj orzeczenie z AI</p>
            <p className="text-xs text-gray-500">Wgraj zdjęcie lub skan — AI wyciągnie dane automatycznie</p>
          </div>
          {scanDone && (
            <span className="ml-auto flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 px-2 py-1 rounded-full">
              <CheckCircle2 size={12} />
              Dane wyciągnięte
            </span>
          )}
        </div>

        <label className={cn(
          'flex items-center justify-center gap-3 w-full py-4 rounded-xl border-2 border-dashed cursor-pointer transition-all',
          scanning
            ? 'border-purple-300 bg-purple-50 cursor-wait'
            : 'border-purple-200 hover:border-purple-400 hover:bg-purple-50 active:scale-[0.99]'
        )}>
          {scanning
            ? <Loader2 size={20} className="text-purple-500 animate-spin" />
            : <Sparkles size={20} className="text-purple-400" />
          }
          <span className={cn('text-sm font-medium', scanning ? 'text-purple-600' : 'text-purple-700')}>
            {scanning ? 'Analizuję orzeczenie…' : 'Zrób zdjęcie lub wybierz plik (JPG, PNG, PDF)'}
          </span>
          <input
            ref={scanRef}
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            disabled={scanning}
            onChange={handleScan}
          />
        </label>

        {file && !scanning && (
          <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-200 text-xs text-gray-600">
            <Paperclip size={12} className="text-purple-500" />
            <span className="flex-1 truncate">{file.name}</span>
            <button type="button" onClick={() => { setFile(null); setScanDone(false) }}>
              <X size={13} className="text-gray-400 hover:text-gray-600" />
            </button>
          </div>
        )}
      </div>

      {/* Form */}
      <div className="card">
        <button type="button" onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between text-left">
          <div className="flex items-center gap-2">
            <div className="bg-purple-500 p-1.5 rounded-lg"><Plus size={14} className="text-white" /></div>
            <span className="font-semibold text-gray-900">
              {scanDone ? 'Sprawdź dane i zapisz' : 'Dodaj orzeczenie ręcznie'}
            </span>
          </div>
          {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </button>

        {expanded && (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {scanDone && (
              <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-xl text-xs text-green-700">
                <Sparkles size={13} />
                Dane wypełnione przez AI — sprawdź i popraw jeśli trzeba
              </div>
            )}

            <Input
              label="Imię i nazwisko pracownika"
              placeholder="Jan Kowalski"
              value={form.person_name}
              onChange={(e) => setForm((p) => ({ ...p, person_name: e.target.value }))}
              required
            />

            <Input
              label="PESEL"
              placeholder="00000000000"
              value={form.pesel}
              onChange={(e) => setForm((p) => ({ ...p, pesel: e.target.value.replace(/\D/g, '').slice(0, 11) }))}
            />

            <div>
              <label className="label">Ważne do</label>
              <input
                type="date"
                className="input"
                value={form.valid_until}
                onChange={(e) => setForm((p) => ({ ...p, valid_until: e.target.value }))}
                required
              />
            </div>

            <Input
              label="Uwagi (opcjonalnie)"
              placeholder="Dodatkowe informacje"
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            />

            <div>
              <label className="label">
                Skan orzeczenia (opcjonalnie)
                {file && <span className="text-green-600 font-normal ml-1">— plik z AI gotowy</span>}
              </label>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 cursor-pointer hover:border-gray-300 transition-colors flex-1">
                  <Paperclip size={14} />
                  {file ? file.name : 'Wybierz plik (JPG, PNG, PDF)'}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
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

      {/* Records list */}
      {records.length > 0 ? (
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-3">Rejestr ({records.length})</h2>
          <div className="divide-y divide-gray-50">
            {records.map((r) => {
              const { pesel, notes: displayNotes } = parsePesel(r.notes)
              return (
                <div key={r.id} className="py-3 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="font-medium text-sm text-gray-900">{r.person_name}</p>
                      <StatusBadge validUntil={r.valid_until} />
                    </div>
                    {pesel && (
                      <p className="text-xs text-gray-500 font-mono mt-0.5">PESEL: {pesel}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">Ważne do: {formatDate(r.valid_until)}</p>
                    {displayNotes && <p className="text-xs text-gray-400 mt-0.5">{displayNotes}</p>}
                  </div>
                  {r.doc_url ? (
                    <a
                      href={r.doc_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Podgląd orzeczenia"
                      className="shrink-0 p-2 rounded-lg border border-gray-200 hover:border-purple-400 hover:bg-purple-50 transition-colors text-gray-400 hover:text-purple-600"
                    >
                      <Search size={16} />
                    </a>
                  ) : (
                    <div className="shrink-0 p-2 rounded-lg border border-dashed border-gray-200 text-gray-300" title="Brak skanu">
                      <Search size={16} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <EmptyState icon={Stethoscope} title="Brak orzeczeń. Dodaj pierwsze orzeczenie powyżej." />
      )}
    </div>
  )
}
