'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn, formatDate, formatDateTime, getTodayDateStr, addDaysToDateStr } from '@/lib/utils'
import { buildSignedUrlMap } from '@/lib/storage'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { SectionHeader } from '@/components/ui/section-header'
import { AiScanRow } from '@/components/ui/ai-scan-row'
import { Dialog } from '@/components/ui/dialog'
import {
  WASTE_DAYS, WASTE_FREQUENCY_LABELS, describeWasteSchedule, scheduledItemsForDate,
  groupByWasteType, summarizeScheduleGroup,
} from '@/lib/waste-schedule'
import type { WasteFrequency, WasteScheduleItem } from '@/lib/waste-schedule'
import type { WasteContractScanResult } from '@/app/api/scan-waste-contract/route'
import type { WasteScheduleScanItem, WasteScheduleScanResult } from '@/app/api/scan-waste-schedule/route'
import {
  Trash2, FileText, Paperclip, X,
  ExternalLink, Search, ChevronRight, CalendarClock, Save,
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

function emptyContractForm() {
  return { company: '', signed_at: getTodayDateStr(), notes: '' }
}

function emptyItemForm() {
  return {
    waste_type: '',
    frequency: 'weekly' as WasteFrequency,
    days_of_week: [0] as number[],
    day_of_month: 1,
    specific_date: getTodayDateStr(),
    anchor_date: getTodayDateStr(),
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
  const [showContractModal, setShowContractModal] = useState(false)
  const [contractDetail, setContractDetail] = useState<WasteContractRow | null>(null)

  const [contractScanFiles, setContractScanFiles] = useState<File[]>([])
  const [contractScanning, setContractScanning] = useState(false)
  const [contractScanResult, setContractScanResult] = useState<WasteContractScanResult | null>(null)

  // ── Schedule state ──
  const [scheduleItems, setScheduleItems] = useState<WasteScheduleItem[]>([])
  const [reviewItems, setReviewItems] = useState<WasteScheduleScanItem[]>([])
  const [savingReview, setSavingReview] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [scheduleScanFiles, setScheduleScanFiles] = useState<File[]>([])
  const [scheduleScanning, setScheduleScanning] = useState(false)
  const [scheduleScanResult, setScheduleScanResult] = useState<WasteScheduleScanResult | null>(null)

  const [showItemModal, setShowItemModal] = useState(false)
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
    const docRefs = contractRows.flatMap(r => [r.doc_url, ...(r.doc_urls ?? [])])
    const signedMap = await buildSignedUrlMap(supabase, 'delivery-photos', docRefs)
    setContracts(contractRows.map(r => ({
      ...r,
      doc_url: r.doc_url ? signedMap.get(r.doc_url) ?? r.doc_url : null,
      doc_urls: r.doc_urls ? r.doc_urls.map(u => signedMap.get(u) ?? u) : null,
    })))
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
      setShowContractModal(true)
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
    setShowContractModal(false)
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
    setShowItemModal(false)
    fetchData()
  }

  // ── Schedule: manual add ──
  async function handleAddItem() {
    if (!itemForm.waste_type.trim()) { toast.error('Wpisz rodzaj odpadu.'); return }
    const isWeekly = itemForm.frequency === 'weekly' || itemForm.frequency === 'biweekly'
    if (isWeekly && itemForm.days_of_week.length === 0) { toast.error('Wybierz przynajmniej jeden dzień tygodnia.'); return }
    if (itemForm.frequency === 'monthly' && (itemForm.day_of_month < 1 || itemForm.day_of_month > 31)) {
      toast.error('Dzień miesiąca musi być w zakresie 1-31.'); return
    }

    const wasteType = itemForm.waste_type.trim()
    const rows: {
      location_id: string
      waste_type: string
      frequency: WasteFrequency
      day_of_week: number | null
      day_of_month: number | null
      specific_date: string | null
      anchor_date: string | null
      created_by: string
    }[] = isWeekly
      ? itemForm.days_of_week.map(day => ({
          location_id: locId,
          waste_type: wasteType,
          frequency: itemForm.frequency,
          day_of_week: day,
          day_of_month: null,
          specific_date: null,
          anchor_date: itemForm.frequency === 'biweekly' ? itemForm.anchor_date : null,
          created_by: userId,
        }))
      : [{
          location_id: locId,
          waste_type: wasteType,
          frequency: itemForm.frequency,
          day_of_week: null,
          day_of_month: itemForm.frequency === 'monthly' ? itemForm.day_of_month : null,
          specific_date: itemForm.frequency === 'once' ? itemForm.specific_date : null,
          anchor_date: null,
          created_by: userId,
        }]

    setSavingItem(true)
    const { error } = await supabase.from('waste_schedule_items').insert(rows)
    setSavingItem(false)
    if (error) { toast.error('Błąd zapisu: ' + error.message); return }
    toast.success(rows.length > 1 ? 'Pozycje harmonogramu dodane!' : 'Pozycja harmonogramu dodana!')
    setItemForm(emptyItemForm())
    setShowItemModal(false)
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

  // ── Schedule: delete a whole waste-type group at once ──
  async function handleDeleteGroup(ids: string[]) {
    if (ids.length === 1) return handleDeleteItem(ids[0])
    setDeletingId(ids[0])
    const { error } = await supabase.from('waste_schedule_items').delete().in('id', ids)
    setDeletingId(null)
    if (error) { toast.error('Błąd usuwania: ' + error.message); return }
    setScheduleItems(prev => prev.filter(i => !ids.includes(i.id)))
    toast.success('Usunięto pozycje harmonogramu.')
  }

  // ── Upcoming pickups (next 7 days) ──
  const upcoming = useMemo(() => {
    const days: { dateStr: string; label: string; items: WasteScheduleItem[] }[] = []
    const todayStr = getTodayDateStr()
    for (let i = 0; i < 7; i++) {
      const dateStr = addDaysToDateStr(todayStr, i)
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
        <SectionHeader title="Umowa na odbiór odpadów" actionLabel="Nowa umowa" onAction={() => setShowContractModal(true)} />

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

      {/* ── New contract modal ── */}
      <Dialog open={showContractModal} onClose={() => setShowContractModal(false)} title="Nowa umowa" size="md">
        <div className="space-y-4">
          <AiScanRow
            label="Skanuj umowę AI"
            files={contractScanFiles}
            onFilesChange={setContractScanFiles}
            onScan={() => handleContractScan(contractScanFiles)}
            scanning={contractScanning}
            hasResult={!!contractScanResult}
            onReset={() => { setContractScanResult(null); setContractScanFiles([]) }}
          >
            {contractScanResult && (
              <div className="space-y-1.5">
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  {contractScanResult.company && <div className="bg-white rounded-lg px-3 py-2 border border-purple-100"><span className="text-gray-400">Firma: </span><span className="font-medium text-gray-800">{contractScanResult.company}</span></div>}
                  {contractScanResult.signed_at && <div className="bg-white rounded-lg px-3 py-2 border border-purple-100"><span className="text-gray-400">Data zawarcia: </span><span className="font-medium text-gray-800">{contractScanResult.signed_at}</span></div>}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold',
                    contractScanResult.confidence === 'wysoka' ? 'bg-green-100 text-green-700'
                    : contractScanResult.confidence === 'srednia' ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-red-100 text-red-700'
                  )}>
                    Pewność: {contractScanResult.confidence}
                  </span>
                  <span className="text-[11px] text-purple-600">Sprawdź dane poniżej i popraw jeśli trzeba.</span>
                </div>
              </div>
            )}
          </AiScanRow>

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
      </Dialog>

      {/* ════════════════ Harmonogram odbioru odpadów ════════════════ */}
      <div className="space-y-3">
        <SectionHeader title="Harmonogram odbioru odpadów" actionLabel="Nowa pozycja" onAction={() => setShowItemModal(true)} />

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

        {/* Schedule list */}
        {scheduleItems.length > 0 ? (
          <div className="space-y-2">
            {groupByWasteType(scheduleItems).map(group => {
              const onceItems = group.items.filter(i => i.frequency === 'once')
              const recurringItems = group.items.filter(i => i.frequency !== 'once')
              const ids = group.items.map(i => i.id)
              return (
                <div key={group.waste_type} className="w-full rounded-xl border border-gray-100 bg-white px-4 py-3 space-y-1.5">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-lg bg-brand-green/10 shrink-0">
                      <CalendarClock size={14} className="text-brand-green-dark" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900 text-sm truncate">{group.waste_type}</p>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{summarizeScheduleGroup(group.items)}</p>
                    </div>
                    <button type="button" onClick={() => handleDeleteGroup(ids)} disabled={deletingId !== null}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors shrink-0 disabled:opacity-50">
                      <X size={15} />
                    </button>
                  </div>
                  {recurringItems.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pl-9">
                      {recurringItems.map(item => (
                        <span key={item.id} className="px-2 py-0.5 rounded-full bg-gray-100 text-[11px] text-gray-600 flex items-center gap-1">
                          {describeWasteSchedule(item)}
                          <button type="button" onClick={() => handleDeleteItem(item.id)} disabled={deletingId !== null}>
                            <X size={10} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  {onceItems.length > 1 && (
                    <details className="pl-9">
                      <summary className="text-xs text-brand-navy cursor-pointer">Pokaż wszystkie terminy ({onceItems.length})</summary>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {onceItems.map(item => (
                          <span key={item.id} className="px-2 py-0.5 rounded-full bg-gray-100 text-[11px] text-gray-600 flex items-center gap-1">
                            {item.specific_date ? formatDate(item.specific_date) : ''}
                            <button type="button" onClick={() => handleDeleteItem(item.id)} disabled={deletingId !== null}>
                              <X size={10} />
                            </button>
                          </span>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <EmptyState
            icon={CalendarClock}
            title="Brak harmonogramu odbioru"
            description="Zeskanuj harmonogram lub dodaj pozycje ręcznie, aby na dashboardzie pojawiały się przypomnienia o odbiorze odpadów."
          />
        )}
      </div>

      {/* ── New schedule item modal ── */}
      <Dialog open={showItemModal} onClose={() => setShowItemModal(false)} title="Nowa pozycja harmonogramu" size="md">
        <div className="space-y-4">
          <AiScanRow
            label="Skanuj harmonogram AI"
            files={scheduleScanFiles}
            onFilesChange={setScheduleScanFiles}
            onScan={() => handleScheduleScan(scheduleScanFiles)}
            scanning={scheduleScanning}
            hasResult={reviewItems.length > 0}
            onReset={() => { setScheduleScanResult(null); setReviewItems([]); setScheduleScanFiles([]) }}
          >
            {reviewItems.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-purple-700 font-semibold">
                    Wykryto {reviewItems.length} {reviewItems.length === 1 ? 'pozycję' : 'pozycji'} harmonogramu
                  </span>
                  {scheduleScanResult && (
                    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold',
                      scheduleScanResult.confidence === 'wysoka' ? 'bg-green-100 text-green-700'
                      : scheduleScanResult.confidence === 'srednia' ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-red-100 text-red-700'
                    )}>
                      Pewność: {scheduleScanResult.confidence}
                    </span>
                  )}
                </div>
                <div className="space-y-1.5">
                  {groupByWasteType(reviewItems).map(group => {
                    const onceItems = group.items.filter(it => it.frequency === 'once' && it.specific_date)
                    const otherItems = group.items.filter(it => !(it.frequency === 'once' && it.specific_date))
                    return (
                      <div key={group.waste_type} className="px-3 py-2.5 bg-white rounded-lg border border-purple-100 text-sm space-y-1.5">
                        <div className="flex items-center gap-2">
                          <CalendarClock size={14} className="text-purple-400 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-gray-800 truncate">{group.waste_type}</p>
                            <p className="text-xs text-gray-500">{summarizeScheduleGroup(group.items)}</p>
                          </div>
                          <button type="button" onClick={() => setReviewItems(prev => prev.filter(it => it.waste_type !== group.waste_type))}>
                            <X size={14} className="text-gray-400 hover:text-gray-600" />
                          </button>
                        </div>
                        {otherItems.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pl-6">
                            {otherItems.map((it, idx) => (
                              <span key={idx} className="px-2 py-0.5 rounded-full bg-gray-100 text-[11px] text-gray-600 flex items-center gap-1">
                                {describeWasteSchedule(it)}
                                <button type="button" onClick={() => setReviewItems(prev => prev.filter(x => x !== it))}>
                                  <X size={10} />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                        {onceItems.length > 1 && (
                          <details className="pl-6">
                            <summary className="text-xs text-purple-600 cursor-pointer">Pokaż wszystkie daty ({onceItems.length})</summary>
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {onceItems.map((it, idx) => (
                                <span key={idx} className="px-2 py-0.5 rounded-full bg-gray-100 text-[11px] text-gray-600 flex items-center gap-1">
                                  {formatDate(it.specific_date as string)}
                                  <button type="button" onClick={() => setReviewItems(prev => prev.filter(x => x !== it))}>
                                    <X size={10} />
                                  </button>
                                </span>
                              ))}
                            </div>
                          </details>
                        )}
                      </div>
                    )
                  })}
                </div>
                <button type="button" onClick={handleSaveReviewItems} disabled={savingReview}
                  className={cn('w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-colors',
                    savingReview ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-brand-green hover:bg-brand-green-dark text-white')}>
                  <Save size={15} />
                  {savingReview ? 'Zapisywanie…' : 'Zapisz harmonogram'}
                </button>
              </div>
            )}
          </AiScanRow>

          {reviewItems.length === 0 && (
            <>
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
                  <label className="label">Dni tygodnia <span className="text-gray-400 font-normal">(można wybrać kilka)</span></label>
                  <div className="flex flex-wrap gap-2">
                    {WASTE_DAYS.map((d, i) => {
                      const active = itemForm.days_of_week.includes(i)
                      return (
                        <button key={d} type="button" title={d}
                          onClick={() => setItemForm(p => ({
                            ...p,
                            days_of_week: active ? p.days_of_week.filter(x => x !== i) : [...p.days_of_week, i].sort(),
                          }))}
                          className={cn(
                            'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                            active
                              ? 'bg-brand-navy text-white border-brand-navy'
                              : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                          )}>
                          {d.slice(0, 3)}
                        </button>
                      )
                    })}
                  </div>
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
            </>
          )}
        </div>
      </Dialog>

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
