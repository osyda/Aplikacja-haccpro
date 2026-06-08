'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Bug, Plus, ChevronDown, ChevronUp, X, Paperclip, Search,
  Sparkles, Loader2, CheckCircle2,
} from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { DddScanResult } from '@/app/api/scan-ddd-protocol/route'

const AREAS = ['Kuchnia', 'Magazyn', 'Sala', 'Toalety', 'Zaplecze', 'Zewnętrze']
const RESULTS = ['Brak szkodników', 'Ślady aktywności', 'Znaleziono szkodniki', 'Pułapki puste', 'Pułapki z połowem']

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function emptyForm() {
  return { areas: [] as string[], result: '', action_taken: '', inspector: '', inspected_at: todayStr(), notes: '' }
}

interface Log {
  id: string
  area: string | null
  areas: string[] | null
  result: string
  action_taken: string | null
  inspected_at: string
  inspector: string
  notes: string | null
  doc_url: string | null
  invoice_url: string | null
}

function logAreas(log: Log): string[] {
  if (log.areas?.length) return log.areas
  if (log.area) return [log.area]
  return []
}

export default function DddPage() {
  const [logs, setLogs] = useState<Log[]>([])
  const [expanded, setExpanded] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [areaInput, setAreaInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const [protocolFile, setProtocolFile] = useState<File | null>(null)
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null)
  const [scanning, setScanning] = useState(false)
  const [scanDone, setScanDone] = useState(false)
  const scanRef = useRef<HTMLInputElement>(null)
  const protocolRef = useRef<HTMLInputElement>(null)
  const invoiceRef = useRef<HTMLInputElement>(null)

  const supabase = createClient()

  async function fetchLogs() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('location_id').eq('id', user!.id).single()
    const { data } = await supabase.from('ddd_logs').select('*').eq('location_id', profile?.location_id ?? '').order('inspected_at', { ascending: false }).limit(30)
    setLogs(data ?? [])
  }

  useEffect(() => { fetchLogs() }, [])

  const inspectorSuggestions = Array.from(new Set(logs.map((l) => l.inspector))).filter(Boolean).sort((a, b) => a.localeCompare(b, 'pl'))

  function toggleArea(name: string) {
    setForm((p) => ({
      ...p,
      areas: p.areas.includes(name) ? p.areas.filter((a) => a !== name) : [...p.areas, name],
    }))
  }

  function addCustomArea() {
    const name = areaInput.trim()
    if (name && !form.areas.includes(name)) {
      setForm((p) => ({ ...p, areas: [...p.areas, name] }))
    }
    setAreaInput('')
  }

  async function handleScan(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setScanning(true)
    setScanDone(false)
    setProtocolFile(f) // pre-fill protocol attachment so it's not uploaded twice

    try {
      const fd = new FormData()
      fd.append('file', f)
      const res = await fetch('/api/scan-ddd-protocol', { method: 'POST', body: fd })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? 'Błąd skanowania')
        return
      }
      const result: DddScanResult = await res.json()
      setForm((prev) => ({
        ...prev,
        inspector: result.inspector ?? prev.inspector,
        inspected_at: result.inspected_at ?? prev.inspected_at,
        result: result.result ?? prev.result,
        action_taken: result.action_taken ?? prev.action_taken,
        areas: result.areas?.length ? Array.from(new Set([...prev.areas, ...result.areas])) : prev.areas,
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

  async function uploadAttachment(file: File, locationId: string, kind: 'protokol' | 'faktura'): Promise<string> {
    const ext = file.name.split('.').pop()
    const path = `ddd/${locationId}/${kind}-${Date.now()}.${ext}`
    const { data: upload, error } = await supabase.storage.from('documents').upload(path, file, { upsert: false })
    if (error) throw error
    return supabase.storage.from('documents').getPublicUrl(upload.path).data.publicUrl
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.areas.length === 0) { toast.error('Wybierz co najmniej jeden obszar kontroli'); return }
    if (!form.result) { toast.error('Wybierz wynik kontroli'); return }
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('location_id').eq('id', user!.id).single()
    const locationId = profile?.location_id ?? ''

    let doc_url: string | null = null
    let invoice_url: string | null = null
    try {
      if (protocolFile) doc_url = await uploadAttachment(protocolFile, locationId, 'protokol')
      if (invoiceFile) invoice_url = await uploadAttachment(invoiceFile, locationId, 'faktura')
    } catch (err) {
      toast.error('Błąd uploadu: ' + (err instanceof Error ? err.message : String(err)))
      setLoading(false)
      return
    }

    const { error } = await supabase.from('ddd_logs').insert({
      location_id: locationId,
      areas: form.areas,
      result: form.result,
      action_taken: form.action_taken || null,
      inspected_at: new Date(form.inspected_at).toISOString(),
      inspector: form.inspector,
      notes: form.notes || null,
      doc_url,
      invoice_url,
    })

    setLoading(false)
    if (error) { toast.error('Błąd zapisu: ' + error.message); return }
    setSuccess(true)
    setForm(emptyForm())
    setAreaInput('')
    setProtocolFile(null)
    setInvoiceFile(null)
    setScanDone(false)
    if (protocolRef.current) protocolRef.current.value = ''
    if (invoiceRef.current) invoiceRef.current.value = ''
    fetchLogs()
    setTimeout(() => { setSuccess(false); setExpanded(false) }, 2000)
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Kontrola DDD" subtitle="Rejestr deratyzacji, dezynsekcji i dezynfekcji" />

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
            <p className="font-semibold text-sm text-gray-900">Skanuj protokół kontroli z AI</p>
            <p className="text-xs text-gray-500">Wgraj zdjęcie lub skan protokołu — AI wyciągnie dane automatycznie</p>
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
            {scanning ? 'Analizuję protokół…' : 'Zrób zdjęcie lub wybierz plik (JPG, PNG, PDF)'}
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
      </div>

      <div className="card">
        <button type="button" onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between text-left">
          <div className="flex items-center gap-2">
            <div className="bg-brand-navy p-1.5 rounded-lg"><Plus size={14} className="text-white" /></div>
            <span className="font-semibold text-gray-900">
              {scanDone ? 'Sprawdź dane i zapisz' : 'Dodaj kontrolę DDD'}
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

            <div>
              <p className="label">Obszary kontroli</p>
              <div className="flex flex-wrap gap-2 mb-2">
                {AREAS.map((a) => (
                  <button key={a} type="button" onClick={() => toggleArea(a)}
                    className={cn('px-3 py-1.5 rounded-lg text-sm border transition-colors',
                      form.areas.includes(a) ? 'border-green-700 bg-green-50 text-green-800 font-medium' : 'border-gray-200 hover:border-gray-300')}>
                    {a}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input className="input flex-1 text-sm" placeholder="Dodaj inny obszar"
                  value={areaInput}
                  onChange={(e) => setAreaInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomArea() } }} />
                <button type="button" onClick={addCustomArea}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:border-gray-300 transition-colors shrink-0">
                  Dodaj
                </button>
              </div>
              {form.areas.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {form.areas.map((name) => (
                    <span key={name} className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 pl-2.5 pr-1.5 py-1 rounded-full">
                      {name}
                      <button type="button" onClick={() => setForm((p) => ({ ...p, areas: p.areas.filter((a) => a !== name) }))}
                        className="text-gray-400 hover:text-gray-600">
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
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
              {form.result && !RESULTS.includes(form.result) && (
                <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700">
                  <CheckCircle2 size={13} className="text-blue-500" />
                  Wynik z AI: <strong>{form.result}</strong>
                </div>
              )}
            </div>

            <div>
              <label className="label">Inspektor / firma DDD</label>
              <datalist id="inspector-suggestions">
                {inspectorSuggestions.map((name) => <option key={name} value={name} />)}
              </datalist>
              <input className="input" list="inspector-suggestions" placeholder="np. Jan Nowak / Firma DDD Sp. z o.o."
                value={form.inspector} onChange={(e) => setForm((p) => ({ ...p, inspector: e.target.value }))} required />
            </div>

            <div>
              <label className="label">Data kontroli</label>
              <input type="date" className="input" value={form.inspected_at}
                onChange={(e) => setForm((p) => ({ ...p, inspected_at: e.target.value }))} required />
            </div>

            <Input label="Podjęte działania" placeholder="np. Wymiana pułapek, oprysk insektycydem" value={form.action_taken} onChange={(e) => setForm((p) => ({ ...p, action_taken: e.target.value }))} />
            <Input label="Uwagi" placeholder="Dodatkowe informacje" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />

            <div>
              <label className="label">
                Skan protokołu kontroli <span className="text-gray-400 font-normal">(opcjonalnie)</span>
                {protocolFile && <span className="text-green-600 font-normal ml-1">— plik gotowy</span>}
              </label>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 cursor-pointer hover:border-gray-300 transition-colors flex-1">
                  <Paperclip size={14} />
                  {protocolFile ? protocolFile.name : 'Wybierz plik (JPG, PNG, PDF)'}
                  <input ref={protocolRef} type="file" accept="image/*,.pdf" className="hidden"
                    onChange={(e) => setProtocolFile(e.target.files?.[0] ?? null)} />
                </label>
                {protocolFile && (
                  <button type="button" onClick={() => { setProtocolFile(null); if (protocolRef.current) protocolRef.current.value = '' }}>
                    <X size={16} className="text-gray-400 hover:text-gray-600" />
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="label">Faktura za usługę DDD <span className="text-gray-400 font-normal">(opcjonalnie)</span></label>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 cursor-pointer hover:border-gray-300 transition-colors flex-1">
                  <Paperclip size={14} />
                  {invoiceFile ? invoiceFile.name : 'Wybierz plik (JPG, PNG, PDF)'}
                  <input ref={invoiceRef} type="file" accept="image/*,.pdf" className="hidden"
                    onChange={(e) => setInvoiceFile(e.target.files?.[0] ?? null)} />
                </label>
                {invoiceFile && (
                  <button type="button" onClick={() => { setInvoiceFile(null); if (invoiceRef.current) invoiceRef.current.value = '' }}>
                    <X size={16} className="text-gray-400 hover:text-gray-600" />
                  </button>
                )}
              </div>
            </div>

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
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900">{logAreas(log).join(', ') || '—'}</p>
                    <p className="text-xs text-gray-600">{log.result}</p>
                    {log.action_taken && <p className="text-xs text-gray-500 mt-0.5">Działanie: {log.action_taken}</p>}
                    <p className="text-xs text-gray-400 mt-0.5">Inspektor: {log.inspector}</p>
                    {(log.doc_url || log.invoice_url) && (
                      <div className="flex items-center gap-3 mt-1.5">
                        {log.doc_url && (
                          <a href={log.doc_url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 hover:underline">
                            <Search size={11} /> Protokół
                          </a>
                        )}
                        {log.invoice_url && (
                          <a href={log.invoice_url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 hover:underline">
                            <Search size={11} /> Faktura
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 whitespace-nowrap ml-4">{formatDateTime(log.inspected_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <EmptyState icon={Bug} title="Brak wpisów kontroli DDD. Dodaj pierwszą kontrolę powyżej." />
      )}
    </div>
  )
}
