'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Bug, X, Paperclip, Search, CheckCircle2,
} from 'lucide-react'
import { formatDateTime, cn, getTodayDateStr } from '@/lib/utils'
import { buildSignedUrlMap } from '@/lib/storage'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { SectionHeader } from '@/components/ui/section-header'
import { AiScanRow } from '@/components/ui/ai-scan-row'
import { Dialog } from '@/components/ui/dialog'
import { toast } from 'sonner'
import type { DddScanResult } from '@/app/api/scan-ddd-protocol/route'

const AREAS = ['Kuchnia', 'Magazyn', 'Sala', 'Toalety', 'Zaplecze', 'Zewnętrze']
const RESULTS = ['Brak szkodników', 'Ślady aktywności', 'Znaleziono szkodniki', 'Pułapki puste', 'Pułapki z połowem']

function emptyForm() {
  return { areas: [] as string[], result: '', action_taken: '', inspector: '', inspected_at: getTodayDateStr(), notes: '' }
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
  const [form, setForm] = useState(emptyForm)
  const [areaInput, setAreaInput] = useState('')
  const [loading, setLoading] = useState(false)

  const [protocolFile, setProtocolFile] = useState<File | null>(null)
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null)
  const protocolRef = useRef<HTMLInputElement>(null)
  const invoiceRef = useRef<HTMLInputElement>(null)

  // AI scan
  const [scanFiles, setScanFiles] = useState<File[]>([])
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<DddScanResult | null>(null)

  // "+ Nowy wpis" modal (AI scan + manual form)
  const [showModal, setShowModal] = useState(false)

  const supabase = createClient()

  async function fetchLogs() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('location_id').eq('id', user!.id).single()
    const { data } = await supabase.from('ddd_logs').select('*').eq('location_id', profile?.location_id ?? '').order('inspected_at', { ascending: false }).limit(30)
    const rows: Log[] = data ?? []
    const docRefs = rows.flatMap(r => [r.doc_url, r.invoice_url])
    const signedMap = await buildSignedUrlMap(supabase, 'documents', docRefs)
    setLogs(rows.map(r => ({
      ...r,
      doc_url: r.doc_url ? signedMap.get(r.doc_url) ?? r.doc_url : null,
      invoice_url: r.invoice_url ? signedMap.get(r.invoice_url) ?? r.invoice_url : null,
    })))
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

  async function handleScan(toScan: File[]) {
    setScanning(true)
    setScanResult(null)
    setProtocolFile(toScan[0] ?? null) // pre-fill protocol attachment so it's not uploaded twice
    try {
      const fd = new FormData()
      toScan.forEach((f) => fd.append('files', f))
      const res = await fetch('/api/scan-ddd-protocol', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Błąd skanowania'); return }
      const result = json as DddScanResult
      setScanResult(result)
      setForm((prev) => ({
        ...prev,
        inspector: result.inspector ?? prev.inspector,
        inspected_at: result.inspected_at ?? prev.inspected_at,
        result: result.result ?? prev.result,
        action_taken: result.action_taken ?? prev.action_taken,
        areas: result.areas?.length ? Array.from(new Set([...prev.areas, ...result.areas])) : prev.areas,
      }))
      setShowModal(true)
      toast.success('Dokument zeskanowany! Sprawdź i uzupełnij dane.')
    } catch (e) {
      toast.error('Błąd połączenia: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setScanning(false)
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
    if (!form.inspector.trim()) { toast.error('Wpisz nazwę firmy/inspektora'); return }
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
    toast.success('Kontrola DDD zapisana!')
    setForm(emptyForm())
    setAreaInput('')
    setProtocolFile(null)
    setInvoiceFile(null)
    if (protocolRef.current) protocolRef.current.value = ''
    if (invoiceRef.current) invoiceRef.current.value = ''
    setScanFiles([])
    setScanResult(null)
    setShowModal(false)
    fetchLogs()
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Kontrola DDD" subtitle="Rejestr deratyzacji, dezynsekcji i dezynfekcji" />

      <div className="space-y-3">
        <SectionHeader title="Historia kontroli" actionLabel="Nowy wpis" onAction={() => setShowModal(true)} />
        {logs.length > 0 ? (
          <div className="card">
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
          <EmptyState icon={Bug} title="Brak wpisów kontroli DDD" description="Dodaj pierwszą kontrolę, aby zacząć budować historię." />
        )}
      </div>

      {/* New entry modal */}
      <Dialog open={showModal} onClose={() => setShowModal(false)} title="Nowa kontrola DDD" size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <AiScanRow
            label="Skanuj protokół kontroli AI"
            files={scanFiles}
            onFilesChange={setScanFiles}
            onScan={() => handleScan(scanFiles)}
            scanning={scanning}
            hasResult={!!scanResult}
            onReset={() => { setScanResult(null); setScanFiles([]) }}
          >
            {scanResult && (
              <div className="space-y-1.5">
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  {scanResult.inspector && <div className="bg-white rounded-lg px-3 py-2 border border-purple-100"><span className="text-gray-400">Inspektor: </span><span className="font-medium text-gray-800">{scanResult.inspector}</span></div>}
                  {scanResult.inspected_at && <div className="bg-white rounded-lg px-3 py-2 border border-purple-100"><span className="text-gray-400">Data: </span><span className="font-medium text-gray-800">{scanResult.inspected_at}</span></div>}
                  {scanResult.result && <div className="bg-white rounded-lg px-3 py-2 border border-purple-100 col-span-2"><span className="text-gray-400">Wynik: </span><span className="font-medium text-gray-800">{scanResult.result}</span></div>}
                  {scanResult.areas?.length ? <div className="bg-white rounded-lg px-3 py-2 border border-purple-100 col-span-2"><span className="text-gray-400">Obszary: </span><span className="font-medium text-gray-800">{scanResult.areas.join(', ')}</span></div> : null}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold',
                    scanResult.confidence === 'wysoka' ? 'bg-green-100 text-green-700'
                    : scanResult.confidence === 'srednia' ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-red-100 text-red-700'
                  )}>
                    Pewność: {scanResult.confidence}
                  </span>
                  <span className="text-[11px] text-purple-600">Sprawdź dane poniżej i popraw jeśli trzeba.</span>
                </div>
              </div>
            )}
          </AiScanRow>

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

          <Button type="submit" loading={loading}>Zapisz kontrolę</Button>
        </form>
      </Dialog>
    </div>
  )
}
