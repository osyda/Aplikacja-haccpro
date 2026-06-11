'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn, formatDate, formatDateTime } from '@/lib/utils'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { Dialog } from '@/components/ui/dialog'
import {
  WASTE_DAYS, WASTE_FREQUENCY_LABELS, describeWasteSchedule, scheduledItemsForDate,
} from '@/lib/waste-schedule'
import type { WasteFrequency, WasteScheduleItem } from '@/lib/waste-schedule'
import type { WasteContractScanResult } from '@/app/api/scan-waste-contract/route'
import type { WasteScheduleScanItem, WasteScheduleScanResult } from '@/app/api/scan-waste-schedule/route'
import {
  Trash2, FileText, Plus, Sparkles, Camera, Paperclip, X, RotateCcw,
  CheckCircle2, ExternalLink, Search, ChevronRight, CalendarClock, Save,
} from 'lucide-react'

interface WasteContractRow {
  id: string
  company: string
  signed_at: string | null
  notes: string | null
  doc_url: string | null
  doc_urls: string[] | null
  recorded_by: string | null
  created_at: string
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function emptyContractForm() {
  return { company: '', signed_at: todayStr(), notes: '' }
}

function emptyItemForm() {
  return {
    waste_type: '',
    frequency: 'weekly' as WasteFrequency,
    day_of_week: 0,
    day_of_month: 1,
    specific_date: todayStr(),
    anchor_date: todayStr(),
  }
}

function rowDocs(row: WasteContractRow): string[] {
  if (row.doc_urls?.length) return row.doc_urls
  if (row.doc_url) return [row.doc_url]
  return []
}

function ContractCard({ row, onOpen }: { row: WasteContractRow; onOpen: () => void }) {
  const docs = rowDocs(row)
  return (
    <div className="w-full flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 transition-colors hover:border-gray-200 hover:bg-gray-50">
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 flex items-center gap-3 text-left">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900 text-sm truncate">{row.company}</p>
          <p className="text-xs text-gray-500 mt-0.5 truncate">
            {row.signed_at ? `Umowa z dnia ${formatDate(row.signed_at)}` : 'Brak daty zawarcia'}
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

export default function OdpadyPage() {
  const [locId, setLocId] = useState('')
  const [userId, setUserId] = useState('')
  const [usersMap, setUsersMap] = useState<Record<string, string>>({})

  // ── Contract state ──
  const [contracts, setContracts] = useState<WasteContractRow[]>([])
  const [contractForm, setContractForm] = useState(emptyContractForm)
  const [contractFiles, setContractFiles] = useState<File[]>([])
  const contractFileRef = useRef<HTMLInputElement>(null)
  const [savingContract, setSavingContract] = useState(false)
  const [showContractForm, setShowContractForm] = useState(false)
  const [contractDetail, setContractDetail] = useState<WasteContractRow | null>(null)

  const [contractScanFiles, setContractScanFiles] = useState<File[]>([])
  const [contractScanning, setContractScanning] = useState(false)
  const [contractScanResult, setContractScanResult] = useState<WasteContractScanResult | null>(null)
  const contractScanRef = useRef<HTMLInputElement>(null)
  const contractAddScanRef = useRef<HTMLInputElement>(null)

  // ── Schedule state ──
  const [scheduleItems, setScheduleItems] = useState<WasteScheduleItem[]>([])
  const [reviewItems, setReviewItems] = useState<WasteScheduleScanItem[]>([])
  const [savingReview, setSavingReview] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [scheduleScanFiles, setScheduleScanFiles] = useState<File[]>([])
  const [scheduleScanning, setScheduleScanning] = useState(false)
  const [scheduleScanResult, setScheduleScanResult] = useState<WasteScheduleScanResult | null>(null)
  const scheduleScanRef = useRef<HTMLInputElement>(null)
  const scheduleAddScanRef = useRef<HTMLInputElement>(null)

  const [showItemForm, setShowItemForm] = useState(false)
  const [itemForm, setItemForm] = useState(emptyItemForm)
  const [savingItem, setSavingItem] = useState(false)

  const supabase = createClient()

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)
    const { data: profile } = await supabase.from('profiles').select('location_id').eq('id', user.id).single()
    const locationId = profile?.location_id ?? ''
    setLocId(locationId)

    const [contractsRes, scheduleRes] = await Promise.all([
      supabase.from('waste_contracts').select('*').eq('location_id', locationId)
        .order('signed_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).limit(50),
      supabase.from('waste_schedule_items').select('*').eq('location_id', locationId).order('created_at'),
    ])

    const contractRows: WasteContractRow[] = contractsRes.data ?? []
    setContracts(contractRows)
    setScheduleItems((scheduleRes.data ?? []) as WasteScheduleItem[])

    const ids = Array.from(new Set(contractRows.map(r => r.recorded_by).filter(Boolean) as string[]))
    if (ids.length > 0) {
      const { data: pData } = await supabase.from('profiles').select('id, full_name').in('id', ids)
      setUsersMap(Object.fromEntries((pData ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name ?? ''])))
    }
  }

  useEffect(() => { fetchData() }, [])

  // ── Contract: AI scan ──
  async function handleContractScan(toScan: File[]) {
    setContractScanning(true)
    setContractScanResult(null)
    setContractFiles(toScan)
    try {
      const fd = new FormData()
      toScan.forEach(f => fd.append('files', f))
      const res = await fetch('/api/scan-waste-contract', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Błąd skanowania'); return }
      const result = json as WasteContractScanResult
      setContractScanResult(result)
      setContractForm(p => ({
        ...p,
        company: result.company ?? p.company,
        signed_at: result.signed_at ?? p.signed_at,
        notes: result.notes ?? p.notes,
      }))
      setShowContractForm(true)
      toast.success('Umowa zeskanowana! Sprawdź i uzupełnij dane.')
    } catch (e) {
      toast.error('Błąd połączenia: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setContractScanning(false)
    }
  }

  // ── Contract: save ──
  async function handleContractSave() {
    if (!contractForm.company.trim()) { toast.error('Wpisz nazwę firmy odbierającej odpady.'); return }

    setSavingContract(true)
    const docUrls: string[] = []
    for (let i = 0; i < contractFiles.length; i++) {
      const f = contractFiles[i]
      const ext = f.name.split('.').pop()
      const filePath = `${locId}/odpady/${Date.now()}-${i}.${ext}`
      const bucket = f.type === 'application/pdf' ? 'documents' : 'delivery-photos'
      const { data: up, error: upErr } = await supabase.storage.from(bucket).upload(filePath, f)
      if (upErr) { toast.error('Błąd uploadu: ' + upErr.message); setSavingContract(false); return }
      docUrls.push(supabase.storage.from(bucket).getPublicUrl(up.path).data.publicUrl)
    }

    const { error } = await supabase.from('waste_contracts').insert({
      location_id: locId,
      company: contractForm.company.trim(),
      signed_at: contractForm.signed_at || null,
      doc_url: docUrls[0] ?? null,
      doc_urls: docUrls.length ? docUrls : null,
      notes: contractForm.notes.trim() || null,
      recorded_by: userId,
    })
    setSavingContract(false)
    if (error) { toast.error('Błąd zapisu: ' + error.message); return }
    toast.success('Umowa zapisana!')
    setContractForm(emptyContractForm())
    setContractFiles([])
    if (contractFileRef.current) contractFileRef.current.value = ''
    setContractScanFiles([])
    setContractScanResult(null)
    setShowContractForm(false)
    fetchData()
  }

  // ── Schedule: AI scan ──
  async function handleScheduleScan(toScan: File[]) {
    setScheduleScanning(true)
    setScheduleScanResult(null)
    setReviewItems([])
    try {
      const fd = new FormData()
      toScan.forEach(f => fd.append('files', f))
      const res = await fetch('/api/scan-waste-schedule', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Błąd skanowania'); return }
      const result = json as WasteScheduleScanResult
      setScheduleScanResult(result)
      setReviewItems(result.items ?? [])
      if ((result.items ?? []).length === 0) {
        toast.error('Nie udało się rozpoznać harmonogramu na dokumencie.')
      } else {
        toast.success('Harmonogram zeskanowany! Sprawdź wykryte odbiory poniżej.')
      }
    } catch (e) {
      toast.error('Błąd połączenia: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setScheduleScanning(false)
    }
  }

  // ── Schedule: save reviewed items from AI scan ──
  async function handleSaveReviewItems() {
    if (reviewItems.length === 0) return
    setSavingReview(true)
    const { error } = await supabase.from('waste_schedule_items').insert(
      reviewItems.map(it => ({
        location_id: locId,
        waste_type: it.waste_type,
        frequency: it.frequency,
        day_of_week: it.day_of_week,
        day_of_month: it.day_of_month,
        specific_date: it.specific_date,
        anchor_date: it.anchor_date,
        created_by: userId,
      }))
    )
    setSavingReview(false)
    if (error) { toast.error('Błąd zapisu: ' + error.message); return }
    toast.success('Harmonogram zapisany!')
    setReviewItems([])
    setScheduleScanResult(null)
    setScheduleScanFiles([])
    fetchData()
  }

  // ── Schedule: manual add ──
  async function handleAddItem() {
    if (!itemForm.waste_type.trim()) { toast.error('Wpisz rodzaj odpadu.'); return }

    setSavingItem(true)
    const { error } = await supabase.from('waste_schedule_items').insert({
      location_id: locId,
      waste_type: itemForm.waste_type.trim(),
      frequency: itemForm.frequency,
      day_of_week: itemForm.frequency === 'weekly' || itemForm.frequency === 'biweekly' ? itemForm.day_of_week : null,
      day_of_month: itemForm.frequency === 'monthly' ? itemForm.day_of_month : null,
      specific_date: itemForm.frequency === 'once' ? itemForm.specific_date : null,
      anchor_date: itemForm.frequency === 'biweekly' ? itemForm.anchor_date : null,
      created_by: userId,
    })
    setSavingItem(false)
    if (error) { toast.error('Błąd zapisu: ' + error.message); return }
    toast.success('Pozycja harmonogramu dodana!')
    setItemForm(emptyItemForm())
    setShowItemForm(false)
    fetchData()
  }

  // ── Schedule: delete ──
  async function handleDeleteItem(id: string) {
    setDeletingId(id)
    const { error } = await supabase.from('waste_schedule_items').delete().eq('id', id)
    setDeletingId(null)
    if (error) { toast.error('Błąd usuwania: ' + error.message); return }
    setScheduleItems(prev => prev.filter(i => i.id !== id))
  }

  // ── Upcoming pickups (next 7 days) ──
  const upcoming = useMemo(() => {
    const days: { dateStr: string; label: string; items: WasteScheduleItem[] }[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date()
      d.setDate(d.getDate() + i)
      const dateStr = d.toISOString().slice(0, 10)
      const items = scheduledItemsForDate(scheduleItems, dateStr)
      if (items.length === 0) continue
      const label = i === 0 ? 'Dziś' : i === 1 ? 'Jutro' : formatDate(dateStr, { weekday: 'long', day: '2-digit', month: '2-digit' })
      days.push({ dateStr, label: label.charAt(0).toUpperCase() + label.slice(1), items })
    }
    return days
  }, [scheduleItems])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Odpady"
        subtitle="Umowa na odbiór odpadów i harmonogram odbioru"
      />

      {/* ════════════════ Umowa na odbiór odpadów ════════════════ */}
      <div className="space-y-3">
        <h2 className="font-bold text-gray-900 text-lg">Umowa na odbiór odpadów</h2>

        {/* AI scan panel */}
        <div className={cn(
          'rounded-2xl border-2 p-4 transition-all',
          contractScanResult ? 'border-purple-200 bg-purple-50' : 'border-dashed border-gray-200 bg-white'
        )}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-purple-100 rounded-lg">
                <Sparkles size={15} className="text-purple-600" />
              </div>
              <span className="text-sm font-bold text-gray-800">Skanuj umowę AI</span>
              <span className="text-xs text-gray-400 font-normal">opcjonalnie</span>
            </div>
            {contractScanResult && (
              <button type="button" onClick={() => { setContractScanResult(null); setContractScanFiles([]) }}
                className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                <RotateCcw size={12} /> Skanuj ponownie
              </button>
            )}
          </div>

          <input ref={contractScanRef} type="file" accept="image/*,.pdf" multiple className="hidden"
            onChange={e => {
              const picked = Array.from(e.target.files ?? [])
              if (picked.length) setContractScanFiles(prev => [...prev, ...picked])
              if (contractScanRef.current) contractScanRef.current.value = ''
            }} />
          <input ref={contractAddScanRef} type="file" accept="image/*,.pdf" multiple className="hidden"
            onChange={e => {
              const picked = Array.from(e.target.files ?? [])
              if (picked.length) setContractScanFiles(prev => [...prev, ...picked])
              if (contractAddScanRef.current) contractAddScanRef.current.value = ''
            }} />

          {contractScanResult ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-purple-700 font-semibold mb-1">
                <CheckCircle2 size={13} />
                Formularz wypełniony automatycznie
                <span className={cn('ml-auto px-2 py-0.5 rounded-full text-[10px]',
                  contractScanResult.confidence === 'wysoka' ? 'bg-green-100 text-green-700'
                  : contractScanResult.confidence === 'srednia' ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-red-100 text-red-700'
                )}>
                  Pewność: {contractScanResult.confidence}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                {contractScanResult.company && <div className="bg-white rounded-lg px-3 py-2 border border-purple-100"><span className="text-gray-400">Firma: </span><span className="font-medium text-gray-800">{contractScanResult.company}</span></div>}
                {contractScanResult.signed_at && <div className="bg-white rounded-lg px-3 py-2 border border-purple-100"><span className="text-gray-400">Data zawarcia: </span><span className="font-medium text-gray-800">{contractScanResult.signed_at}</span></div>}
              </div>
              <p className="text-xs text-purple-600 mt-1">Sprawdź dane poniżej i popraw jeśli trzeba.</p>
            </div>
          ) : contractScanning ? (
            <div className="flex items-center justify-center gap-3 py-5">
              <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-medium text-purple-700">
                Analizowanie {contractScanFiles.length} {contractScanFiles.length === 1 ? 'pliku' : 'plików'}…
              </span>
            </div>
          ) : contractScanFiles.length === 0 ? (
            <button type="button" onClick={() => contractScanRef.current?.click()}
              className="flex items-center justify-center gap-3 w-full py-4 rounded-xl border-2 border-dashed border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-all min-h-[64px]">
              <Camera size={20} className="text-purple-400" />
              <span className="text-sm font-medium text-gray-600">Zrób zdjęcie lub wybierz plik (JPG, PNG, PDF)</span>
            </button>
          ) : (
            <div className="space-y-2">
              <div className="space-y-1.5">
                {contractScanFiles.map((f, i) => (
                  <div key={`${f.name}-${i}`} className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-purple-100 text-xs text-gray-700">
                    <Paperclip size={12} className="text-purple-400 shrink-0" />
                    <span className="flex-1 truncate font-medium">{f.name}</span>
                    <button type="button" onClick={() => setContractScanFiles(prev => prev.filter((_, j) => j !== i))}>
                      <X size={13} className="text-gray-400 hover:text-gray-600" />
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => contractAddScanRef.current?.click()}
                className="flex items-center gap-2 w-full px-3 py-2 border border-dashed border-gray-200 rounded-lg text-xs text-gray-500 hover:border-purple-300 hover:text-purple-600 transition-colors">
                <Plus size={13} /> Dodaj kolejne zdjęcie / stronę
              </button>
              <button type="button" onClick={() => handleContractScan(contractScanFiles)}
                className="w-full flex items-center justify-center gap-2 py-3 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-xl transition-colors">
                <Sparkles size={15} />
                Analizuj {contractScanFiles.length === 1 ? '1 plik' : `${contractScanFiles.length} pliki/plików`}
              </button>
            </div>
          )}
        </div>

        {/* Manual entry form */}
        {!showContractForm ? (
          <button type="button" onClick={() => setShowContractForm(true)}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl border-2 border-dashed border-gray-200 bg-white text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700 transition-colors">
            <Plus size={15} /> Dodaj umowę ręcznie
          </button>
        ) : (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-900 text-lg">Nowa umowa</h3>
            <button type="button" onClick={() => setShowContractForm(false)}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
              <X size={16} />
            </button>
          </div>

          <div>
            <label className="label">Firma odbierająca odpady <span className="text-red-500">*</span></label>
            <input className="input" placeholder="np. EkoOdpady Sp. z o.o."
              value={contractForm.company} onChange={e => setContractForm(p => ({ ...p, company: e.target.value }))} />
          </div>

          <div>
            <label className="label">Data zawarcia umowy <span className="text-gray-400 font-normal">(opcjonalne)</span></label>
            <input type="date" className="input"
              value={contractForm.signed_at} onChange={e => setContractForm(p => ({ ...p, signed_at: e.target.value }))} />
          </div>

          <div>
            <label className="label">Dokumenty / zdjęcia <span className="text-gray-400 font-normal">(opcjonalne)</span></label>
            <label className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-600 cursor-pointer hover:border-gray-300 transition-colors">
              <Paperclip size={14} />
              {contractFiles.length > 0 ? `Dodaj kolejny plik (wybrano ${contractFiles.length})` : 'Wybierz pliki (JPG, PNG, PDF)'}
              <input ref={contractFileRef} type="file" accept="image/*,.pdf" multiple className="hidden"
                onChange={e => {
                  const picked = Array.from(e.target.files ?? [])
                  if (picked.length) setContractFiles(p => [...p, ...picked])
                  if (contractFileRef.current) contractFileRef.current.value = ''
                }} />
            </label>
            {contractFiles.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {contractFiles.map((f, i) => (
                  <div key={`${f.name}-${i}`} className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-200 text-xs text-gray-600">
                    <Paperclip size={12} className="text-gray-400 shrink-0" />
                    <span className="flex-1 truncate">{f.name}</span>
                    <button type="button" onClick={() => setContractFiles(p => p.filter((_, j) => j !== i))}>
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
              value={contractForm.notes} onChange={e => setContractForm(p => ({ ...p, notes: e.target.value }))} />
          </div>

          <button type="button" onClick={handleContractSave} disabled={savingContract}
            className={cn('w-full py-4 rounded-xl text-sm font-bold transition-colors',
              savingContract ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-brand-green hover:bg-brand-green-dark text-white')}>
            {savingContract ? 'Zapisywanie…' : 'Zapisz umowę'}
          </button>
        </div>
        )}

        {/* History */}
        {contracts.length > 0 ? (
          <div className="space-y-2">
            {contracts.map(row => (
              <ContractCard key={row.id} row={row} onOpen={() => setContractDetail(row)} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Trash2}
            title="Brak umów na odbiór odpadów"
            description="Nie dodano jeszcze żadnej umowy dla tego lokalu."
          />
        )}
      </div>

      {/* ════════════════ Harmonogram odbioru odpadów ════════════════ */}
      <div className="space-y-3">
        <h2 className="font-bold text-gray-900 text-lg">Harmonogram odbioru odpadów</h2>

        {/* AI scan panel */}
        <div className={cn(
          'rounded-2xl border-2 p-4 transition-all',
          reviewItems.length > 0 ? 'border-purple-200 bg-purple-50' : 'border-dashed border-gray-200 bg-white'
        )}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-purple-100 rounded-lg">
                <Sparkles size={15} className="text-purple-600" />
              </div>
              <span className="text-sm font-bold text-gray-800">Skanuj harmonogram AI</span>
              <span className="text-xs text-gray-400 font-normal">opcjonalnie</span>
            </div>
            {scheduleScanResult && (
              <button type="button" onClick={() => { setScheduleScanResult(null); setReviewItems([]); setScheduleScanFiles([]) }}
                className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                <RotateCcw size={12} /> Skanuj ponownie
              </button>
            )}
          </div>

          <input ref={scheduleScanRef} type="file" accept="image/*,.pdf" multiple className="hidden"
            onChange={e => {
              const picked = Array.from(e.target.files ?? [])
              if (picked.length) setScheduleScanFiles(prev => [...prev, ...picked])
              if (scheduleScanRef.current) scheduleScanRef.current.value = ''
            }} />
          <input ref={scheduleAddScanRef} type="file" accept="image/*,.pdf" multiple className="hidden"
            onChange={e => {
              const picked = Array.from(e.target.files ?? [])
              if (picked.length) setScheduleScanFiles(prev => [...prev, ...picked])
              if (scheduleAddScanRef.current) scheduleAddScanRef.current.value = ''
            }} />

          {reviewItems.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-purple-700 font-semibold mb-1">
                <CheckCircle2 size={13} />
                Wykryto {reviewItems.length} {reviewItems.length === 1 ? 'pozycję' : 'pozycji'} harmonogramu
                {scheduleScanResult && (
                  <span className={cn('ml-auto px-2 py-0.5 rounded-full text-[10px]',
                    scheduleScanResult.confidence === 'wysoka' ? 'bg-green-100 text-green-700'
                    : scheduleScanResult.confidence === 'srednia' ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-red-100 text-red-700'
                  )}>
                    Pewność: {scheduleScanResult.confidence}
                  </span>
                )}
              </div>
              <div className="space-y-1.5">
                {reviewItems.map((it, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2.5 bg-white rounded-lg border border-purple-100 text-sm">
                    <CalendarClock size={14} className="text-purple-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-800 truncate">{it.waste_type}</p>
                      <p className="text-xs text-gray-500">{describeWasteSchedule(it)}</p>
                    </div>
                    <button type="button" onClick={() => setReviewItems(prev => prev.filter((_, j) => j !== i))}>
                      <X size={14} className="text-gray-400 hover:text-gray-600" />
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={handleSaveReviewItems} disabled={savingReview}
                className={cn('w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-colors',
                  savingReview ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-brand-green hover:bg-brand-green-dark text-white')}>
                <Save size={15} />
                {savingReview ? 'Zapisywanie…' : 'Zapisz harmonogram'}
              </button>
            </div>
          ) : scheduleScanning ? (
            <div className="flex items-center justify-center gap-3 py-5">
              <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-medium text-purple-700">
                Analizowanie {scheduleScanFiles.length} {scheduleScanFiles.length === 1 ? 'pliku' : 'plików'}…
              </span>
            </div>
          ) : scheduleScanFiles.length === 0 ? (
            <button type="button" onClick={() => scheduleScanRef.current?.click()}
              className="flex items-center justify-center gap-3 w-full py-4 rounded-xl border-2 border-dashed border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-all min-h-[64px]">
              <Camera size={20} className="text-purple-400" />
              <span className="text-sm font-medium text-gray-600">Zrób zdjęcie lub wybierz plik (JPG, PNG, PDF)</span>
            </button>
          ) : (
            <div className="space-y-2">
              <div className="space-y-1.5">
                {scheduleScanFiles.map((f, i) => (
                  <div key={`${f.name}-${i}`} className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-purple-100 text-xs text-gray-700">
                    <Paperclip size={12} className="text-purple-400 shrink-0" />
                    <span className="flex-1 truncate font-medium">{f.name}</span>
                    <button type="button" onClick={() => setScheduleScanFiles(prev => prev.filter((_, j) => j !== i))}>
                      <X size={13} className="text-gray-400 hover:text-gray-600" />
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => scheduleAddScanRef.current?.click()}
                className="flex items-center gap-2 w-full px-3 py-2 border border-dashed border-gray-200 rounded-lg text-xs text-gray-500 hover:border-purple-300 hover:text-purple-600 transition-colors">
                <Plus size={13} /> Dodaj kolejne zdjęcie / stronę
              </button>
              <button type="button" onClick={() => handleScheduleScan(scheduleScanFiles)}
                className="w-full flex items-center justify-center gap-2 py-3 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-xl transition-colors">
                <Sparkles size={15} />
                Analizuj {scheduleScanFiles.length === 1 ? '1 plik' : `${scheduleScanFiles.length} pliki/plików`}
              </button>
            </div>
          )}
        </div>

        {/* Upcoming pickups */}
        {upcoming.length > 0 && (
          <div className="card space-y-2">
            <p className="font-bold text-gray-900 text-sm">Najbliższe odbiory</p>
            <div className="divide-y divide-gray-50">
              {upcoming.map(day => (
                <div key={day.dateStr} className="flex items-start gap-3 py-2 first:pt-0 last:pb-0">
                  <div className="p-1.5 rounded-lg bg-brand-green/10 shrink-0 mt-0.5">
                    <CalendarClock size={14} className="text-brand-green-dark" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{day.label}</p>
                    <p className="text-xs text-gray-500">{day.items.map(i => i.waste_type).join(', ')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Manual add */}
        {!showItemForm ? (
          <button type="button" onClick={() => setShowItemForm(true)}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl border-2 border-dashed border-gray-200 bg-white text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700 transition-colors">
            <Plus size={15} /> Dodaj pozycję ręcznie
          </button>
        ) : (
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-lg">Nowa pozycja harmonogramu</h3>
              <button type="button" onClick={() => setShowItemForm(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
                <X size={16} />
              </button>
            </div>

            <div>
              <label className="label">Rodzaj odpadu <span className="text-red-500">*</span></label>
              <input className="input" placeholder="np. Odpady zmieszane"
                value={itemForm.waste_type} onChange={e => setItemForm(p => ({ ...p, waste_type: e.target.value }))} />
            </div>

            <div>
              <label className="label">Częstotliwość</label>
              <select className="input" value={itemForm.frequency}
                onChange={e => setItemForm(p => ({ ...p, frequency: e.target.value as WasteFrequency }))}>
                {(Object.entries(WASTE_FREQUENCY_LABELS) as [WasteFrequency, string][]).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            {(itemForm.frequency === 'weekly' || itemForm.frequency === 'biweekly') && (
              <div>
                <label className="label">Dzień tygodnia</label>
                <select className="input" value={itemForm.day_of_week}
                  onChange={e => setItemForm(p => ({ ...p, day_of_week: +e.target.value }))}>
                  {WASTE_DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
                </select>
              </div>
            )}

            {itemForm.frequency === 'biweekly' && (
              <div>
                <label className="label">Data odniesienia <span className="text-gray-400 font-normal">(jeden ze znanych odbiorów)</span></label>
                <input type="date" className="input"
                  value={itemForm.anchor_date} onChange={e => setItemForm(p => ({ ...p, anchor_date: e.target.value }))} />
              </div>
            )}

            {itemForm.frequency === 'monthly' && (
              <div>
                <label className="label">Dzień miesiąca</label>
                <input type="number" min={1} max={31} className="input"
                  value={itemForm.day_of_month} onChange={e => setItemForm(p => ({ ...p, day_of_month: +e.target.value }))} />
              </div>
            )}

            {itemForm.frequency === 'once' && (
              <div>
                <label className="label">Data odbioru</label>
                <input type="date" className="input"
                  value={itemForm.specific_date} onChange={e => setItemForm(p => ({ ...p, specific_date: e.target.value }))} />
              </div>
            )}

            <button type="button" onClick={handleAddItem} disabled={savingItem}
              className={cn('w-full py-4 rounded-xl text-sm font-bold transition-colors',
                savingItem ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-brand-green hover:bg-brand-green-dark text-white')}>
              {savingItem ? 'Zapisywanie…' : 'Dodaj do harmonogramu'}
            </button>
          </div>
        )}

        {/* Schedule list */}
        {scheduleItems.length > 0 ? (
          <div className="space-y-2">
            {scheduleItems.map(item => (
              <div key={item.id} className="w-full flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3">
                <div className="p-1.5 rounded-lg bg-brand-green/10 shrink-0">
                  <CalendarClock size={14} className="text-brand-green-dark" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900 text-sm truncate">{item.waste_type}</p>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{describeWasteSchedule(item)}</p>
                </div>
                <button type="button" onClick={() => handleDeleteItem(item.id)} disabled={deletingId === item.id}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors shrink-0 disabled:opacity-50">
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={CalendarClock}
            title="Brak harmonogramu odbioru"
            description="Zeskanuj harmonogram lub dodaj pozycje ręcznie, aby na dashboardzie pojawiały się przypomnienia o odbiorze odpadów."
          />
        )}
      </div>

      {/* ── Contract detail dialog ── */}
      <Dialog open={!!contractDetail} onClose={() => setContractDetail(null)} title={contractDetail?.company} size="md">
        {contractDetail && (
          <div className="space-y-3">
            {contractDetail.signed_at && (
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[11px] text-gray-400 mb-1">Data zawarcia umowy</p>
                <p className="text-sm font-semibold text-gray-900">{formatDate(contractDetail.signed_at)}</p>
              </div>
            )}

            {contractDetail.notes && (
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Uwagi</p>
                <p className="text-sm text-gray-700 bg-gray-50 rounded-xl p-3 whitespace-pre-line leading-relaxed">{contractDetail.notes}</p>
              </div>
            )}

            {rowDocs(contractDetail).length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  {rowDocs(contractDetail).length > 1 ? `Załączniki (${rowDocs(contractDetail).length})` : 'Załącznik'}
                </p>
                <div className="space-y-1.5">
                  {rowDocs(contractDetail).map((url, i) => (
                    <a key={url} href={url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 p-3 rounded-xl border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-colors text-sm text-gray-700 hover:text-purple-700 group">
                      <div className="p-1.5 rounded-lg bg-purple-100 group-hover:bg-purple-200 transition-colors">
                        <FileText size={14} className="text-purple-600" />
                      </div>
                      <span className="flex-1 font-medium">
                        {rowDocs(contractDetail).length > 1 ? `Podgląd — strona ${i + 1}` : 'Podgląd dokumentu / zdjęcia'}
                      </span>
                      <ExternalLink size={14} className="text-gray-400 shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {contractDetail.recorded_by && usersMap[contractDetail.recorded_by] && (
              <p className="text-xs text-gray-400">Zapisał/a: {usersMap[contractDetail.recorded_by]} · {formatDateTime(contractDetail.created_at)}</p>
            )}
          </div>
        )}
      </Dialog>
    </div>
  )
}
