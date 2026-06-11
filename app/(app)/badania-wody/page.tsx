'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn, formatDate, formatDateTime } from '@/lib/utils'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { Dialog } from '@/components/ui/dialog'
import type { WaterTestScanResult } from '@/app/api/scan-water-test/route'
import {
  FlaskConical, Plus, Sparkles, Camera, Paperclip, X, RotateCcw,
  CheckCircle2, FileText, ExternalLink, Search, ChevronRight,
} from 'lucide-react'

interface WaterTestRow {
  id: string
  company: string
  tested_at: string
  result: string | null
  notes: string | null
  doc_url: string | null
  doc_urls: string[] | null
  recorded_by: string | null
  created_at: string
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function emptyForm() {
  return { company: '', tested_at: todayStr(), result: '', notes: '' }
}

function rowDocs(row: WaterTestRow): string[] {
  if (row.doc_urls?.length) return row.doc_urls
  if (row.doc_url) return [row.doc_url]
  return []
}

function WaterTestCard({ row, onOpen }: { row: WaterTestRow; onOpen: () => void }) {
  const docs = rowDocs(row)
  return (
    <div className="w-full flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 transition-colors hover:border-gray-200 hover:bg-gray-50">
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 flex items-center gap-3 text-left">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900 text-sm truncate">{row.company}</p>
          <p className="text-xs text-gray-500 mt-0.5 truncate">
            {[formatDate(row.tested_at), row.result].filter(Boolean).join(' · ')}
          </p>
        </div>
        <ChevronRight size={16} className="text-gray-300 shrink-0" />
      </button>
      {docs.length > 0 && (
        <a
          href={docs[0]}
          target="_blank"
          rel="noopener noreferrer"
          title={docs.length > 1 ? `Podgląd dokumentu (${docs.length} stron)` : 'Podgląd dokumentu'}
          className="relative p-1.5 rounded-lg border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-colors text-gray-400 hover:text-purple-600 shrink-0"
        >
          <Search size={14} />
          {docs.length > 1 && (
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-purple-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
              {docs.length}
            </span>
          )}
        </a>
      )}
    </div>
  )
}

export default function BadaniaWodyPage() {
  const [rows, setRows] = useState<WaterTestRow[]>([])
  const [usersMap, setUsersMap] = useState<Record<string, string>>({})
  const [locId, setLocId] = useState('')
  const [userId, setUserId] = useState('')

  // Manual entry form
  const [form, setForm] = useState(emptyForm)
  const [companies, setCompanies] = useState<string[]>([])
  const [files, setFiles] = useState<File[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const [saving, setSaving] = useState(false)

  // AI scan
  const [scanFiles, setScanFiles] = useState<File[]>([])
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<WaterTestScanResult | null>(null)
  const scanRef = useRef<HTMLInputElement>(null)
  const addScanRef = useRef<HTMLInputElement>(null)

  // Detail modal
  const [detail, setDetail] = useState<WaterTestRow | null>(null)

  // Manual entry form is collapsed by default — AI scan is the primary flow
  const [showManualForm, setShowManualForm] = useState(false)

  const supabase = createClient()

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)
    const { data: profile } = await supabase.from('profiles').select('location_id').eq('id', user.id).single()
    const locationId = profile?.location_id ?? ''
    setLocId(locationId)

    const { data } = await supabase
      .from('water_tests').select('*').eq('location_id', locationId)
      .order('tested_at', { ascending: false }).limit(100)

    const list: WaterTestRow[] = data ?? []
    setRows(list)

    const comps = Array.from(new Set(list.map(r => r.company).filter(Boolean)))
    setCompanies(comps)

    const ids = Array.from(new Set(list.map(r => r.recorded_by).filter(Boolean) as string[]))
    if (ids.length > 0) {
      const { data: pData } = await supabase.from('profiles').select('id, full_name').in('id', ids)
      setUsersMap(Object.fromEntries((pData ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name ?? ''])))
    }
  }

  useEffect(() => { fetchData() }, [])

  async function handleScan(toScan: File[]) {
    setScanning(true)
    setScanResult(null)
    setFiles(toScan)
    try {
      const fd = new FormData()
      toScan.forEach(f => fd.append('files', f))
      const res = await fetch('/api/scan-water-test', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Błąd skanowania'); return }
      const result = json as WaterTestScanResult
      setScanResult(result)
      setForm(p => ({
        ...p,
        company: result.company ?? p.company,
        tested_at: result.tested_at ?? p.tested_at,
        result: result.result ?? p.result,
        notes: result.notes ?? p.notes,
      }))
      setShowManualForm(true)
      toast.success('Dokument zeskanowany! Sprawdź i uzupełnij dane.')
    } catch (e) {
      toast.error('Błąd połączenia: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setScanning(false)
    }
  }

  async function handleSave() {
    if (!form.company.trim()) { toast.error('Wpisz nazwę firmy wykonującej badanie.'); return }
    if (!form.tested_at) { toast.error('Wybierz datę badania.'); return }

    setSaving(true)
    const docUrls: string[] = []
    for (let i = 0; i < files.length; i++) {
      const f = files[i]
      const ext = f.name.split('.').pop()
      const filePath = `${locId}/badania-wody/${Date.now()}-${i}.${ext}`
      const bucket = f.type === 'application/pdf' ? 'documents' : 'delivery-photos'
      const { data: up, error: upErr } = await supabase.storage.from(bucket).upload(filePath, f)
      if (upErr) { toast.error('Błąd uploadu: ' + upErr.message); setSaving(false); return }
      docUrls.push(supabase.storage.from(bucket).getPublicUrl(up.path).data.publicUrl)
    }

    const { error } = await supabase.from('water_tests').insert({
      location_id: locId,
      company: form.company.trim(),
      tested_at: form.tested_at,
      result: form.result.trim() || null,
      doc_url: docUrls[0] ?? null,
      doc_urls: docUrls.length ? docUrls : null,
      notes: form.notes.trim() || null,
      recorded_by: userId,
    })
    setSaving(false)
    if (error) { toast.error('Błąd zapisu: ' + error.message); return }
    toast.success('Badanie wody zapisane!')
    setForm(emptyForm())
    setFiles([])
    if (fileRef.current) fileRef.current.value = ''
    setScanFiles([])
    setScanResult(null)
    setShowManualForm(false)
    fetchData()
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Badania Wody"
        subtitle="Rejestr badań jakości wody pitnej"
      />

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
            <span className="text-sm font-bold text-gray-800">Skanuj badanie wody AI</span>
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
              {scanResult.tested_at && <div className="bg-white rounded-lg px-3 py-2 border border-purple-100"><span className="text-gray-400">Data: </span><span className="font-medium text-gray-800">{scanResult.tested_at}</span></div>}
              {scanResult.result && <div className="bg-white rounded-lg px-3 py-2 border border-purple-100 col-span-2"><span className="text-gray-400">Wynik: </span><span className="font-medium text-gray-800">{scanResult.result}</span></div>}
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
      {!showManualForm ? (
        <button type="button" onClick={() => setShowManualForm(true)}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl border-2 border-dashed border-gray-200 bg-white text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700 transition-colors">
          <Plus size={15} /> Dodaj wpis ręcznie
        </button>
      ) : (
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-gray-900 text-lg">Nowe badanie</h2>
          <button type="button" onClick={() => setShowManualForm(false)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div>
          <label className="label">Firma wykonująca badanie <span className="text-red-500">*</span></label>
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
          <input className="input" placeholder="np. Sanepid Laboratorium Sp. z o.o."
            value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Data badania <span className="text-red-500">*</span></label>
            <input type="date" className="input"
              value={form.tested_at} onChange={e => setForm(p => ({ ...p, tested_at: e.target.value }))} />
          </div>
          <div>
            <label className="label">Wynik <span className="text-gray-400 font-normal">(opcjonalne)</span></label>
            <input className="input" placeholder="np. Woda przydatna do spożycia"
              value={form.result} onChange={e => setForm(p => ({ ...p, result: e.target.value }))} />
          </div>
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
          {saving ? 'Zapisywanie…' : 'Zapisz badanie'}
        </button>
      </div>
      )}

      {/* ── History ── */}
      <div className="space-y-3">
        <h2 className="font-bold text-gray-900 text-lg">Historia badań</h2>
        {rows.length > 0 ? (
          <div className="space-y-2">
            {rows.map(row => (
              <WaterTestCard key={row.id} row={row} onOpen={() => setDetail(row)} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={FlaskConical}
            title="Brak badań wody"
            description="Nie dodano jeszcze żadnego badania jakości wody dla tego lokalu."
          />
        )}
      </div>

      {/* ── Detail dialog ── */}
      <Dialog open={!!detail} onClose={() => setDetail(null)} title={detail?.company} size="md">
        {detail && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[11px] text-gray-400 mb-1">Data badania</p>
                <p className="text-sm font-semibold text-gray-900">{formatDate(detail.tested_at)}</p>
              </div>
              {detail.result && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-[11px] text-gray-400 mb-1">Wynik</p>
                  <p className="text-sm font-semibold text-gray-900">{detail.result}</p>
                </div>
              )}
            </div>

            {detail.notes && (
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Uwagi</p>
                <p className="text-sm text-gray-700 bg-gray-50 rounded-xl p-3 whitespace-pre-line leading-relaxed">{detail.notes}</p>
              </div>
            )}

            {rowDocs(detail).length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  {rowDocs(detail).length > 1 ? `Załączniki (${rowDocs(detail).length})` : 'Załącznik'}
                </p>
                <div className="space-y-1.5">
                  {rowDocs(detail).map((url, i) => (
                    <a key={url} href={url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 p-3 rounded-xl border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-colors text-sm text-gray-700 hover:text-purple-700 group">
                      <div className="p-1.5 rounded-lg bg-purple-100 group-hover:bg-purple-200 transition-colors">
                        <FileText size={14} className="text-purple-600" />
                      </div>
                      <span className="flex-1 font-medium">
                        {rowDocs(detail).length > 1 ? `Podgląd — strona ${i + 1}` : 'Podgląd dokumentu / zdjęcia'}
                      </span>
                      <ExternalLink size={14} className="text-gray-400 shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {detail.recorded_by && usersMap[detail.recorded_by] && (
              <p className="text-xs text-gray-400">Zapisał/a: {usersMap[detail.recorded_by]} · {formatDateTime(detail.created_at)}</p>
            )}
          </div>
        )}
      </Dialog>
    </div>
  )
}
