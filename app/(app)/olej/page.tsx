'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn, formatDate, formatDateTime } from '@/lib/utils'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { CompactRecordCard } from '@/components/ui/compact-record-card'
import { Dialog } from '@/components/ui/dialog'
import { isOwnerRole } from '@/lib/permissions'
import type { OilScanResult } from '@/app/api/scan-oil-receipt/route'
import {
  Recycle, Phone, Plus, Sparkles, Camera, Paperclip, X, RotateCcw,
  CheckCircle2, Pencil, FileText, ExternalLink,
} from 'lucide-react'

interface OilLog {
  id: string
  company: string
  quantity: string
  handed_over_by: string | null
  collected_at: string
  doc_url: string | null
  doc_urls: string[] | null
  notes: string | null
  recorded_by: string | null
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function emptyForm() {
  return { company: '', quantity: '', collected_at: todayStr(), notes: '' }
}

function logDocs(log: OilLog): string[] {
  if (log.doc_urls?.length) return log.doc_urls
  if (log.doc_url) return [log.doc_url]
  return []
}

export default function OlejPage() {
  const [logs, setLogs] = useState<OilLog[]>([])
  const [usersMap, setUsersMap] = useState<Record<string, string>>({})
  const [locId, setLocId] = useState('')
  const [userId, setUserId] = useState('')
  const [isOwner, setIsOwner] = useState(false)

  // Pickup company contact ("Zamów odbiór oleju")
  const [companyName, setCompanyName] = useState('')
  const [companyPhone, setCompanyPhone] = useState('')
  const [editingContact, setEditingContact] = useState(false)
  const [contactForm, setContactForm] = useState({ name: '', phone: '' })
  const [savingContact, setSavingContact] = useState(false)

  // Manual entry form
  const [form, setForm] = useState(emptyForm)
  const [companies, setCompanies] = useState<string[]>([])
  const [workers, setWorkers] = useState<string[]>([])
  const [worker, setWorker] = useState('')
  const [workerManual, setWorkerManual] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const [saving, setSaving] = useState(false)

  // AI scan
  const [scanFiles, setScanFiles] = useState<File[]>([])
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<OilScanResult | null>(null)
  const scanRef = useRef<HTMLInputElement>(null)
  const addScanRef = useRef<HTMLInputElement>(null)

  // Detail modal
  const [detail, setDetail] = useState<OilLog | null>(null)

  const supabase = createClient()

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)
    const { data: profile } = await supabase.from('profiles').select('location_id, role').eq('id', user.id).single()
    const locationId = profile?.location_id ?? ''
    setLocId(locationId)
    setIsOwner(isOwnerRole(profile?.role))

    const [logsRes, locRes, medRes] = await Promise.all([
      supabase.from('oil_collections').select('*').eq('location_id', locationId).order('collected_at', { ascending: false }).limit(100),
      supabase.from('locations').select('oil_company_name, oil_company_phone').eq('id', locationId).single(),
      supabase.from('medical_records').select('person_name').eq('location_id', locationId).order('person_name'),
    ])

    const rows: OilLog[] = logsRes.data ?? []
    setLogs(rows)
    setCompanyName(locRes.data?.oil_company_name ?? '')
    setCompanyPhone(locRes.data?.oil_company_phone ?? '')
    setContactForm({ name: locRes.data?.oil_company_name ?? '', phone: locRes.data?.oil_company_phone ?? '' })

    const names = Array.from(new Set((medRes.data ?? []).map((r: { person_name: string }) => r.person_name).filter(Boolean))) as string[]
    setWorkers(names)

    const comps = Array.from(new Set(rows.map(r => r.company).filter(Boolean)))
    setCompanies(comps)

    const ids = Array.from(new Set(rows.map(r => r.recorded_by).filter(Boolean) as string[]))
    if (ids.length > 0) {
      const { data: pData } = await supabase.from('profiles').select('id, full_name').in('id', ids)
      setUsersMap(Object.fromEntries((pData ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name ?? ''])))
    }
  }

  useEffect(() => { fetchData() }, [])

  // Pre-fill manual form's company with the configured pickup company, once known
  useEffect(() => {
    if (companyName) setForm(p => p.company ? p : { ...p, company: companyName })
  }, [companyName])

  // Remember last "handed over by" worker across sessions
  useEffect(() => {
    const saved = localStorage.getItem('oil_last_worker')
    if (saved) setWorker(saved)
  }, [])

  async function saveContact() {
    setSavingContact(true)
    const { error } = await supabase.from('locations').update({
      oil_company_name: contactForm.name.trim() || null,
      oil_company_phone: contactForm.phone.trim() || null,
    }).eq('id', locId)
    setSavingContact(false)
    if (error) { toast.error('Błąd zapisu: ' + error.message); return }
    setCompanyName(contactForm.name.trim())
    setCompanyPhone(contactForm.phone.trim())
    setEditingContact(false)
    toast.success('Dane firmy zapisane.')
  }

  async function handleScan(toScan: File[]) {
    setScanning(true)
    setScanResult(null)
    setFiles(toScan)
    try {
      const fd = new FormData()
      toScan.forEach(f => fd.append('files', f))
      const res = await fetch('/api/scan-oil-receipt', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Błąd skanowania'); return }
      const result = json as OilScanResult
      setScanResult(result)
      setForm(p => ({
        ...p,
        company: result.company ?? p.company,
        quantity: result.quantity ?? p.quantity,
        collected_at: result.collected_at ?? p.collected_at,
        notes: result.notes ?? p.notes,
      }))
      if (result.handed_over_by) {
        setWorker(result.handed_over_by)
        setWorkerManual(!workers.includes(result.handed_over_by))
      }
      toast.success('Dokument zeskanowany! Sprawdź i uzupełnij dane.')
    } catch (e) {
      toast.error('Błąd połączenia: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setScanning(false)
    }
  }

  async function handleSave() {
    if (!form.company.trim()) { toast.error('Wpisz nazwę firmy odbierającej olej.'); return }
    if (!form.quantity.trim()) { toast.error('Wpisz ilość odebranego oleju.'); return }
    if (!form.collected_at) { toast.error('Wybierz datę odbioru.'); return }

    setSaving(true)
    const docUrls: string[] = []
    for (let i = 0; i < files.length; i++) {
      const f = files[i]
      const ext = f.name.split('.').pop()
      const filePath = `${locId}/olej/${Date.now()}-${i}.${ext}`
      const bucket = f.type === 'application/pdf' ? 'documents' : 'delivery-photos'
      const { data: up, error: upErr } = await supabase.storage.from(bucket).upload(filePath, f)
      if (upErr) { toast.error('Błąd uploadu: ' + upErr.message); setSaving(false); return }
      docUrls.push(supabase.storage.from(bucket).getPublicUrl(up.path).data.publicUrl)
    }

    const handedOverBy = worker.trim()
    if (handedOverBy) localStorage.setItem('oil_last_worker', handedOverBy)

    const { error } = await supabase.from('oil_collections').insert({
      location_id: locId,
      company: form.company.trim(),
      quantity: form.quantity.trim(),
      handed_over_by: handedOverBy || null,
      collected_at: new Date(form.collected_at).toISOString(),
      doc_url: docUrls[0] ?? null,
      doc_urls: docUrls.length ? docUrls : null,
      notes: form.notes.trim() || null,
      recorded_by: userId,
    })
    setSaving(false)
    if (error) { toast.error('Błąd zapisu: ' + error.message); return }
    toast.success('Odbiór oleju zapisany!')
    setForm({ ...emptyForm(), company: companyName })
    setFiles([])
    if (fileRef.current) fileRef.current.value = ''
    setScanFiles([])
    setScanResult(null)
    fetchData()
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Odbiór oleju"
        subtitle="Rejestr odbioru zużytego oleju spożywczego"
      />

      {/* ── Zamów odbiór oleju ── */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-brand-green/10 rounded-lg shrink-0">
              <Recycle size={18} className="text-brand-green-dark" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-gray-900 text-sm">Zamów odbiór oleju</p>
              {companyName && <p className="text-xs text-gray-500 truncate">{companyName}</p>}
            </div>
          </div>
          {isOwner && !editingContact && (
            <button type="button" onClick={() => setEditingContact(true)}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors shrink-0">
              <Pencil size={15} />
            </button>
          )}
        </div>

        {editingContact ? (
          <div className="space-y-2">
            <div>
              <label className="label text-xs">Nazwa firmy</label>
              <input className="input" placeholder="np. EkoOlej Sp. z o.o."
                value={contactForm.name} onChange={e => setContactForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label className="label text-xs">Numer telefonu</label>
              <input className="input" type="tel" placeholder="np. 600 100 200"
                value={contactForm.phone} onChange={e => setContactForm(p => ({ ...p, phone: e.target.value }))} />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={saveContact} disabled={savingContact} className="btn-primary flex-1 disabled:opacity-50">
                {savingContact ? 'Zapisywanie…' : 'Zapisz'}
              </button>
              <button type="button" onClick={() => { setEditingContact(false); setContactForm({ name: companyName, phone: companyPhone }) }}
                className="btn-secondary flex-1">
                Anuluj
              </button>
            </div>
          </div>
        ) : companyPhone ? (
          <a href={`tel:${companyPhone.replace(/\s+/g, '')}`}
            className="btn-primary w-full flex items-center justify-center gap-2 py-3">
            <Phone size={16} /> Zadzwoń: {companyPhone}
          </a>
        ) : (
          <p className="text-xs text-gray-400">
            {isOwner
              ? 'Dodaj numer telefonu firmy odbierającej olej, aby szybko zamówić odbiór.'
              : 'Brak ustawionego numeru firmy odbierającej olej. Poproś właściciela o jego dodanie.'}
          </p>
        )}
      </div>

      {/* ── AI Scan panel ── */}
      <div className={cn(
        'rounded-2xl border-2 p-4 transition-all',
        scanResult ? 'border-purple-200 bg-purple-50' : 'border-dashed border-gray-200 bg-white'
      )}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-purple-100 rounded-lg">
              <Sparkles size={15} className="text-purple-600" />
            </div>
            <span className="text-sm font-bold text-gray-800">Skanuj potwierdzenie AI</span>
            <span className="text-xs text-gray-400 font-normal">opcjonalnie</span>
          </div>
          {scanResult && (
            <button type="button" onClick={() => { setScanResult(null); setScanFiles([]) }}
              className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
              <RotateCcw size={12} /> Skanuj ponownie
            </button>
          )}
        </div>

        {/* Hidden inputs */}
        <input ref={scanRef} type="file" accept="image/*,.pdf" multiple className="hidden"
          onChange={e => {
            const picked = Array.from(e.target.files ?? [])
            if (picked.length) setScanFiles(prev => [...prev, ...picked])
            if (scanRef.current) scanRef.current.value = ''
          }} />
        <input ref={addScanRef} type="file" accept="image/*,.pdf" multiple className="hidden"
          onChange={e => {
            const picked = Array.from(e.target.files ?? [])
            if (picked.length) setScanFiles(prev => [...prev, ...picked])
            if (addScanRef.current) addScanRef.current.value = ''
          }} />

        {scanResult ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-purple-700 font-semibold mb-1">
              <CheckCircle2 size={13} />
              Formularz wypełniony automatycznie
              <span className={cn('ml-auto px-2 py-0.5 rounded-full text-[10px]',
                scanResult.confidence === 'wysoka' ? 'bg-green-100 text-green-700'
                : scanResult.confidence === 'srednia' ? 'bg-yellow-100 text-yellow-700'
                : 'bg-red-100 text-red-700'
              )}>
                Pewność: {scanResult.confidence}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              {scanResult.company && <div className="bg-white rounded-lg px-3 py-2 border border-purple-100"><span className="text-gray-400">Firma: </span><span className="font-medium text-gray-800">{scanResult.company}</span></div>}
              {scanResult.quantity && <div className="bg-white rounded-lg px-3 py-2 border border-purple-100"><span className="text-gray-400">Ilość: </span><span className="font-medium text-gray-800">{scanResult.quantity}</span></div>}
              {scanResult.collected_at && <div className="bg-white rounded-lg px-3 py-2 border border-purple-100"><span className="text-gray-400">Data: </span><span className="font-medium text-gray-800">{scanResult.collected_at}</span></div>}
              {scanResult.handed_over_by && <div className="bg-white rounded-lg px-3 py-2 border border-purple-100"><span className="text-gray-400">Wydał: </span><span className="font-medium text-gray-800">{scanResult.handed_over_by}</span></div>}
            </div>
            <p className="text-xs text-purple-600 mt-1">Sprawdź dane poniżej i popraw jeśli trzeba.</p>
          </div>
        ) : scanning ? (
          <div className="flex items-center justify-center gap-3 py-5">
            <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium text-purple-700">
              Analizowanie {scanFiles.length} {scanFiles.length === 1 ? 'pliku' : 'plików'}…
            </span>
          </div>
        ) : scanFiles.length === 0 ? (
          <button type="button" onClick={() => scanRef.current?.click()}
            className="flex items-center justify-center gap-3 w-full py-4 rounded-xl border-2 border-dashed border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-all min-h-[64px]">
            <Camera size={20} className="text-purple-400" />
            <span className="text-sm font-medium text-gray-600">Zrób zdjęcie lub wybierz plik (JPG, PNG, PDF)</span>
          </button>
        ) : (
          <div className="space-y-2">
            <div className="space-y-1.5">
              {scanFiles.map((f, i) => (
                <div key={`${f.name}-${i}`} className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-purple-100 text-xs text-gray-700">
                  <Paperclip size={12} className="text-purple-400 shrink-0" />
                  <span className="flex-1 truncate font-medium">{f.name}</span>
                  <button type="button" onClick={() => setScanFiles(prev => prev.filter((_, j) => j !== i))}>
                    <X size={13} className="text-gray-400 hover:text-gray-600" />
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => addScanRef.current?.click()}
              className="flex items-center gap-2 w-full px-3 py-2 border border-dashed border-gray-200 rounded-lg text-xs text-gray-500 hover:border-purple-300 hover:text-purple-600 transition-colors">
              <Plus size={13} /> Dodaj kolejne zdjęcie / stronę
            </button>
            <button type="button" onClick={() => handleScan(scanFiles)}
              className="w-full flex items-center justify-center gap-2 py-3 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-xl transition-colors">
              <Sparkles size={15} />
              Analizuj {scanFiles.length === 1 ? '1 plik' : `${scanFiles.length} pliki/plików`}
            </button>
          </div>
        )}
      </div>

      {/* ── Manual entry form ── */}
      <div className="card space-y-4">
        <h2 className="font-bold text-gray-900 text-lg">Nowy wpis</h2>

        <div>
          <label className="label">Firma odbierająca <span className="text-red-500">*</span></label>
          {companies.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {companies.map(c => (
                <button key={c} type="button" onClick={() => setForm(p => ({ ...p, company: c }))}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                    form.company === c
                      ? 'bg-brand-navy text-white border-brand-navy'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                  )}>
                  {c}
                </button>
              ))}
            </div>
          )}
          <input className="input" placeholder="np. EkoOlej Sp. z o.o."
            value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Ilość <span className="text-red-500">*</span></label>
            <input className="input" placeholder="np. 20 l"
              value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))} />
          </div>
          <div>
            <label className="label">Data odbioru <span className="text-red-500">*</span></label>
            <input type="date" className="input"
              value={form.collected_at} onChange={e => setForm(p => ({ ...p, collected_at: e.target.value }))} />
          </div>
        </div>

        <div>
          <label className="label">Kto oddał olej? <span className="text-gray-400 font-normal">(opcjonalne)</span></label>
          {workers.length > 0 && !workerManual ? (
            <>
              <div className="flex flex-wrap gap-2">
                {workers.map(w => (
                  <button key={w} type="button" onClick={() => setWorker(w)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                      worker === w
                        ? 'bg-brand-green text-white border-brand-green'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                    )}>
                    {w}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => { setWorkerManual(true); setWorker('') }}
                className="mt-2 text-xs text-gray-400 hover:text-brand-navy transition-colors">
                + Wpisz inną osobę
              </button>
            </>
          ) : (
            <div className="flex gap-2">
              <input className="input flex-1 text-sm" placeholder="Imię i nazwisko pracownika"
                value={worker} onChange={e => setWorker(e.target.value)} autoFocus={workerManual} />
              {workers.length > 0 && (
                <button type="button"
                  onClick={() => {
                    setWorkerManual(false)
                    const saved = localStorage.getItem('oil_last_worker') ?? ''
                    setWorker(workers.includes(saved) ? saved : '')
                  }}
                  className="px-3 py-2 border border-gray-200 rounded-xl text-xs text-gray-600 hover:bg-gray-50 whitespace-nowrap">
                  Wybierz z listy
                </button>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="label">Dokumenty / zdjęcia <span className="text-gray-400 font-normal">(opcjonalne)</span></label>
          <label className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-600 cursor-pointer hover:border-gray-300 transition-colors">
            <Paperclip size={14} />
            {files.length > 0 ? `Dodaj kolejny plik (wybrano ${files.length})` : 'Wybierz pliki (JPG, PNG, PDF)'}
            <input ref={fileRef} type="file" accept="image/*,.pdf" multiple className="hidden"
              onChange={e => {
                const picked = Array.from(e.target.files ?? [])
                if (picked.length) setFiles(p => [...p, ...picked])
                if (fileRef.current) fileRef.current.value = ''
              }} />
          </label>
          {files.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {files.map((f, i) => (
                <div key={`${f.name}-${i}`} className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-200 text-xs text-gray-600">
                  <Paperclip size={12} className="text-gray-400 shrink-0" />
                  <span className="flex-1 truncate">{f.name}</span>
                  <button type="button" onClick={() => setFiles(p => p.filter((_, j) => j !== i))}>
                    <X size={13} className="text-gray-400 hover:text-gray-600" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="label">Uwagi <span className="text-gray-400 font-normal">(opcjonalne)</span></label>
          <textarea rows={2} className="input resize-none" placeholder="Dodatkowe informacje..."
            value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
        </div>

        <button type="button" onClick={handleSave} disabled={saving}
          className={cn('w-full py-4 rounded-xl text-sm font-bold transition-colors',
            saving ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-brand-green hover:bg-brand-green-dark text-white')}>
          {saving ? 'Zapisywanie…' : 'Zapisz wpis'}
        </button>
      </div>

      {/* ── History ── */}
      <div className="space-y-3">
        <h2 className="font-bold text-gray-900 text-lg">Historia odbiorów</h2>
        {logs.length > 0 ? (
          <div className="space-y-2">
            {logs.map(log => (
              <CompactRecordCard
                key={log.id}
                title={log.company}
                meta={[log.quantity, formatDate(log.collected_at), log.handed_over_by].filter(Boolean).join(' · ')}
                badge={logDocs(log).length > 0 ? (
                  <FileText size={14} className="text-gray-300" />
                ) : undefined}
                onClick={() => setDetail(log)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Recycle}
            title="Brak odbiorów oleju"
            description="Nie dodano jeszcze żadnego wpisu odbioru oleju dla tego lokalu."
          />
        )}
      </div>

      {/* ── Detail dialog ── */}
      <Dialog open={!!detail} onClose={() => setDetail(null)} title={detail?.company} size="md">
        {detail && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[11px] text-gray-400 mb-1">Ilość</p>
                <p className="text-sm font-semibold text-gray-900">{detail.quantity}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[11px] text-gray-400 mb-1">Data odbioru</p>
                <p className="text-sm font-semibold text-gray-900">{formatDate(detail.collected_at)}</p>
              </div>
              {detail.handed_over_by && (
                <div className="bg-gray-50 rounded-xl p-3 col-span-2">
                  <p className="text-[11px] text-gray-400 mb-1">Kto oddał olej</p>
                  <p className="text-sm font-semibold text-gray-900">{detail.handed_over_by}</p>
                </div>
              )}
            </div>

            {detail.notes && (
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Uwagi</p>
                <p className="text-sm text-gray-700 bg-gray-50 rounded-xl p-3 whitespace-pre-line leading-relaxed">{detail.notes}</p>
              </div>
            )}

            {logDocs(detail).length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  {logDocs(detail).length > 1 ? `Załączniki (${logDocs(detail).length})` : 'Załącznik'}
                </p>
                <div className="space-y-1.5">
                  {logDocs(detail).map((url, i) => (
                    <a key={url} href={url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 p-3 rounded-xl border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-colors text-sm text-gray-700 hover:text-purple-700 group">
                      <div className="p-1.5 rounded-lg bg-purple-100 group-hover:bg-purple-200 transition-colors">
                        <FileText size={14} className="text-purple-600" />
                      </div>
                      <span className="flex-1 font-medium">
                        {logDocs(detail).length > 1 ? `Podgląd — strona ${i + 1}` : 'Podgląd dokumentu / zdjęcia'}
                      </span>
                      <ExternalLink size={14} className="text-gray-400 shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {detail.recorded_by && usersMap[detail.recorded_by] && (
              <p className="text-xs text-gray-400">Zapisał/a: {usersMap[detail.recorded_by]} · {formatDateTime(detail.collected_at)}</p>
            )}
          </div>
        )}
      </Dialog>
    </div>
  )
}
