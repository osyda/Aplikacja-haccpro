'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft, Paperclip, X, Thermometer, Building2, Plus, CheckCircle2, AlertCircle, ChevronRight, Camera, Sparkles, RotateCcw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { isOwnerRole } from '@/lib/permissions'
import type { ScanResult } from '@/app/api/scan-invoice/route'

const DELIVERY_CATEGORIES = [
  { id: 'mieso',    label: 'Mięso świeże',       requiresTemp: true,  tempHint: '0 – 7°C',  activeClass: 'border-red-400 bg-red-50 text-red-700' },
  { id: 'drob',     label: 'Drób i królik',       requiresTemp: true,  tempHint: '0 – 4°C',  activeClass: 'border-orange-400 bg-orange-50 text-orange-700' },
  { id: 'ryby',     label: 'Ryby i owoce morza',  requiresTemp: true,  tempHint: '0 – 4°C',  activeClass: 'border-blue-400 bg-blue-50 text-blue-700' },
  { id: 'wedliny',  label: 'Wędliny i przetwory', requiresTemp: true,  tempHint: '0 – 7°C',  activeClass: 'border-rose-400 bg-rose-50 text-rose-700' },
  { id: 'nabiał',   label: 'Nabiał',              requiresTemp: true,  tempHint: '0 – 8°C',  activeClass: 'border-yellow-400 bg-yellow-50 text-yellow-700' },
  { id: 'mrozonki', label: 'Mrożonki',            requiresTemp: true,  tempHint: '≤ −18°C',  activeClass: 'border-cyan-400 bg-cyan-50 text-cyan-700', frozenNote: true },
  { id: 'gotowe',   label: 'Dania gotowe / GMP',  requiresTemp: true,  tempHint: '0 – 4°C',  activeClass: 'border-purple-400 bg-purple-50 text-purple-700' },
  { id: 'warzywa',  label: 'Warzywa i owoce',     requiresTemp: false, tempHint: '',          activeClass: 'border-green-400 bg-green-50 text-green-700' },
  { id: 'suche',    label: 'Produkty suche',      requiresTemp: false, tempHint: '',          activeClass: 'border-amber-400 bg-amber-50 text-amber-700' },
  { id: 'pieczywo', label: 'Pieczywo',            requiresTemp: false, tempHint: '',          activeClass: 'border-amber-400 bg-amber-50 text-amber-700' },
  { id: 'napoje',   label: 'Napoje',              requiresTemp: false, tempHint: '',          activeClass: 'border-sky-400 bg-sky-50 text-sky-700' },
  { id: 'alkohol',  label: 'Piwo / Alkohol',      requiresTemp: false, tempHint: '',          activeClass: 'border-lime-400 bg-lime-50 text-lime-700' },
  { id: 'inne',     label: 'Inne',                requiresTemp: false, tempHint: '',          activeClass: 'border-gray-400 bg-gray-50 text-gray-600' },
]

const NONCONFORMITY_HINTS = [
  'Uszkodzone opakowanie',
  'Nieprawidłowa temperatura',
  'Brak etykiety',
  'Przekroczony termin',
  'Zanieczyszczenie',
  'Niezgodna ilość',
]

interface Supplier { id: string; alias: string; full_name: string; nip: string; notes: string | null }
const EMPTY_NEW_SUPP = { alias: '', full_name: '', nip: '', notes: '' }

function StepIndicator({ step, total }: { step: number; total: number }) {
  const labels = ['Dostawca', 'Kategorie', 'Produkt', 'Jakość']
  return (
    <div className="flex items-center gap-0">
      {labels.map((label, i) => {
        const num = i + 1
        const done = num < step
        const active = num === step
        return (
          <div key={num} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all',
                done ? 'bg-brand-green border-brand-green text-white'
                  : active ? 'bg-brand-navy border-brand-navy text-white'
                  : 'bg-white border-gray-200 text-gray-400'
              )}>
                {done ? <CheckCircle2 size={14} /> : num}
              </div>
              <span className={cn('text-[10px] mt-1 font-medium', active ? 'text-brand-navy' : done ? 'text-brand-green-dark' : 'text-gray-400')}>
                {label}
              </span>
            </div>
            {i < total - 1 && (
              <div className={cn('h-0.5 flex-1 mb-4 mx-1 transition-all', done ? 'bg-green-400' : 'bg-gray-200')} />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function NowaDostawaPage() {
  const [step, setStep] = useState(1)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [canManageSuppliers, setCanManageSuppliers] = useState(false)
  const [deletingSupplierId, setDeletingSupplierId] = useState<string | null>(null)
  const [showAddSupplier, setShowAddSupplier] = useState(false)
  const [newSupp, setNewSupp] = useState(EMPTY_NEW_SUPP)
  const [form, setForm] = useState({
    supplier: '',
    categories: [] as string[],
    product: '',
    quantity: '',
    temp_at_delivery: '',
    temp_frozen: '',
    expiry_date: '',
    quality_ok: true as boolean | null,
    nonconformity_desc: '',
    notes: '',
  })
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const scanRef = useRef<HTMLInputElement>(null)
  const addScanRef = useRef<HTMLInputElement>(null)
  const [scanFiles, setScanFiles] = useState<File[]>([])
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const tempRequiredCats = DELIVERY_CATEGORIES.filter(c => form.categories.includes(c.id) && c.requiresTemp)
  const frozenCats = tempRequiredCats.filter(c => c.id === 'mrozonki')
  const chilledCats = tempRequiredCats.filter(c => c.id !== 'mrozonki')
  const hasFrozen = frozenCats.length > 0
  const hasChilled = chilledCats.length > 0
  const requiresTemp = tempRequiredCats.length > 0
  // Frozen and chilled goods have very different temperature norms — when a
  // delivery mixes both, one shared reading would always look "out of range"
  // for one of them, so each gets its own field.
  const needsTwoTempFields = hasFrozen && hasChilled

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase.from('profiles').select('location_id, role').eq('id', user!.id).single()
      setCanManageSuppliers(isOwnerRole(profile?.role))
      const { data } = await supabase.from('location_suppliers').select('*').eq('location_id', profile?.location_id ?? '').order('alias')
      setSuppliers(data ?? [])
    }
    load()
  }, [])

  async function getCtx() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('location_id').eq('id', user!.id).single()
    return { locationId: profile?.location_id ?? '', userId: user!.id }
  }

  async function handleScan(files: File[]) {
    setScanning(true)
    setScanResult(null)
    setFiles(files) // pre-fill step 4 attachments with the scanned pages
    try {
      const fd = new FormData()
      files.forEach(f => fd.append('files', f))
      const res = await fetch('/api/scan-invoice', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Błąd skanowania'); return }
      const result = json as ScanResult
      setScanResult(result)
      // Pre-fill form
      setForm(p => ({
        ...p,
        supplier: result.supplier ?? p.supplier,
        product: result.product ?? p.product,
        quantity: result.quantity ?? p.quantity,
        expiry_date: result.expiry_date ?? p.expiry_date,
        temp_at_delivery: result.temp_at_delivery != null ? String(result.temp_at_delivery) : p.temp_at_delivery,
        categories: result.categories?.length ? result.categories : p.categories,
        notes: result.notes ?? p.notes,
      }))
      toast.success('Faktura zeskanowana! Sprawdź i uzupełnij dane.')
    } catch (e) {
      toast.error('Błąd połączenia: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setScanning(false)
    }
  }

  async function saveNewSupplier() {
    if (!newSupp.alias.trim()) { toast.error('Wpisz alias / skróconą nazwę'); return }
    const { locationId } = await getCtx()
    const { data, error } = await supabase.from('location_suppliers')
      .insert({ location_id: locationId, alias: newSupp.alias.trim(), full_name: newSupp.full_name.trim(), nip: newSupp.nip.trim(), notes: newSupp.notes.trim() || null })
      .select().single()
    if (error) { toast.error('Błąd zapisu: ' + error.message); return }
    setSuppliers(p => [...p, data].sort((a, b) => a.alias.localeCompare(b.alias)))
    setForm(p => ({ ...p, supplier: data.alias }))
    setNewSupp(EMPTY_NEW_SUPP)
    setShowAddSupplier(false)
    toast.success('Dostawca dodany!')
  }

  async function deleteSupplier(id: string, alias: string) {
    if (!window.confirm(`Na pewno usunąć dostawcę "${alias}"?\n\nHistoria wcześniejszych dostaw pozostanie niezmieniona.`)) return
    setDeletingSupplierId(id)
    const { error } = await supabase.from('location_suppliers').delete().eq('id', id)
    setDeletingSupplierId(null)
    if (error) { toast.error('Błąd usuwania: ' + error.message); return }
    setSuppliers(p => p.filter(s => s.id !== id))
    if (form.supplier === alias) setForm(p => ({ ...p, supplier: '' }))
    toast.success(`Dostawca "${alias}" usunięty.`)
  }

  function toggleCategory(id: string) {
    setForm(p => ({ ...p, categories: p.categories.includes(id) ? p.categories.filter(c => c !== id) : [...p.categories, id] }))
  }

  function canGoNext(): boolean {
    if (step === 1) return !!form.supplier.trim()
    if (step === 2) return form.categories.length > 0
    if (step === 3) {
      if (!form.product.trim()) return false
      if (!form.quantity.trim()) return false
      if (requiresTemp && !form.temp_at_delivery) return false
      if (needsTwoTempFields && !form.temp_frozen) return false
      return true
    }
    return true
  }

  async function handleSubmit() {
    if (form.quality_ok === null) { toast.error('Oceń jakość dostawy'); return }
    if (!form.quality_ok && !form.nonconformity_desc.trim()) { toast.error('Opisz niezgodność'); return }

    setLoading(true)
    const { locationId, userId } = await getCtx()

    const photo_urls: string[] = []
    for (let i = 0; i < files.length; i++) {
      const f = files[i]
      const ext = f.name.split('.').pop()
      const filePath = `${locationId}/dostawy/${Date.now()}-${i}.${ext}`
      const bucket = f.type === 'application/pdf' ? 'documents' : 'delivery-photos'
      const { data: up, error: upErr } = await supabase.storage.from(bucket).upload(filePath, f)
      if (upErr) { toast.error('Błąd uploadu: ' + upErr.message); setLoading(false); return }
      photo_urls.push(supabase.storage.from(bucket).getPublicUrl(up.path).data.publicUrl)
    }

    const notes = [form.notes, !form.quality_ok && form.nonconformity_desc ? `Niezgodność: ${form.nonconformity_desc}` : '']
      .filter(Boolean).join(' | ') || null

    const { error } = await supabase.from('delivery_logs').insert({
      location_id: locationId,
      supplier: form.supplier,
      categories: form.categories,
      product: form.product,
      quantity: form.quantity,
      temp_at_delivery: form.temp_at_delivery ? parseFloat(form.temp_at_delivery) : null,
      temp_frozen: needsTwoTempFields && form.temp_frozen ? parseFloat(form.temp_frozen) : null,
      expiry_date: form.expiry_date || null,
      quality_ok: form.quality_ok,
      notes,
      photo_url: photo_urls[0] ?? null,
      photo_urls: photo_urls.length ? photo_urls : null,
      received_at: new Date().toISOString(),
      recorded_by: userId,
    })
    setLoading(false)
    if (error) { toast.error('Błąd zapisu: ' + error.message); return }
    toast.success('Dostawa zapisana!')
    router.push('/dostawy')
  }

  return (
    <div className="max-w-xl space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dostawy" className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-500">
          <ChevronLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Nowa dostawa</h1>
          <p className="text-xs text-gray-400 mt-0.5">Krok {step} z 4</p>
        </div>
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
            <span className="text-sm font-bold text-gray-800">Skanuj fakturę AI</span>
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
              {scanResult.supplier && <div className="bg-white rounded-lg px-3 py-2 border border-purple-100"><span className="text-gray-400">Dostawca: </span><span className="font-medium text-gray-800">{scanResult.supplier}</span></div>}
              {scanResult.product && <div className="bg-white rounded-lg px-3 py-2 border border-purple-100"><span className="text-gray-400">Produkt: </span><span className="font-medium text-gray-800">{scanResult.product}</span></div>}
              {scanResult.quantity && <div className="bg-white rounded-lg px-3 py-2 border border-purple-100"><span className="text-gray-400">Ilość: </span><span className="font-medium text-gray-800">{scanResult.quantity}</span></div>}
              {scanResult.expiry_date && <div className="bg-white rounded-lg px-3 py-2 border border-purple-100"><span className="text-gray-400">Termin: </span><span className="font-medium text-gray-800">{scanResult.expiry_date}</span></div>}
            </div>
            <p className="text-xs text-purple-600 mt-1">Sprawdź dane w kolejnych krokach i popraw jeśli trzeba.</p>
          </div>
        ) : scanning ? (
          <div className="flex items-center justify-center gap-3 py-5">
            <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium text-purple-700">
              Analizowanie {scanFiles.length} {scanFiles.length === 1 ? 'pliku' : 'plików'}…
            </span>
          </div>
        ) : scanFiles.length === 0 ? (
          /* Empty state — click to add first files */
          <button type="button" onClick={() => scanRef.current?.click()}
            className="flex items-center justify-center gap-3 w-full py-4 rounded-xl border-2 border-dashed border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-all min-h-[64px]">
            <Camera size={20} className="text-purple-400" />
            <span className="text-sm font-medium text-gray-600">Zrób zdjęcie lub wybierz plik (JPG, PNG, PDF)</span>
          </button>
        ) : (
          /* Files staged — show list + add more + analyse button */
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

      {/* Step indicator */}
      <StepIndicator step={step} total={4} />

      {/* ── STEP 1: Dostawca ── */}
      {step === 1 && (
        <div className="card space-y-4">
          <h2 className="font-bold text-gray-900 text-lg">Wybierz dostawcę</h2>

          {suppliers.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {suppliers.map(s => {
                const sel = form.supplier === s.alias
                return (
                  <div key={s.id}
                    onClick={() => setForm(p => ({ ...p, supplier: sel ? '' : s.alias }))}
                    className={cn(
                      'relative p-3 rounded-xl border-2 text-left transition-all min-h-[72px] cursor-pointer',
                      sel ? 'border-brand-navy bg-brand-navy/5' : 'border-gray-100 bg-white hover:border-gray-200'
                    )}>
                    <p className={cn('font-bold text-sm leading-tight pr-6', sel ? 'text-brand-navy' : 'text-gray-900')}>{s.alias}</p>
                    {s.full_name && <p className="text-xs text-gray-500 mt-0.5 leading-tight truncate pr-6">{s.full_name}</p>}
                    {s.nip && <p className="text-xs text-gray-400 font-mono mt-0.5">NIP: {s.nip}</p>}
                    {canManageSuppliers && (
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); deleteSupplier(s.id, s.alias) }}
                        disabled={deletingSupplierId === s.id}
                        title="Usuń dostawcę"
                        className="absolute top-2 right-2 p-1.5 rounded-lg text-gray-300 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-30"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <div>
            <label className="label">Lub wpisz ręcznie</label>
            <input
              className="input"
              placeholder="Nazwa dostawcy..."
              value={form.supplier}
              onChange={e => setForm(p => ({ ...p, supplier: e.target.value }))}
            />
          </div>

          {/* Add supplier form */}
          <button
            type="button"
            onClick={() => setShowAddSupplier(!showAddSupplier)}
            className="flex items-center gap-1.5 text-sm text-brand-green font-medium hover:underline"
          >
            <Plus size={14} />
            {showAddSupplier ? 'Anuluj' : 'Dodaj nowego dostawcę'}
          </button>

          {showAddSupplier && (
            <div className="p-4 border-2 border-gray-100 rounded-xl bg-gray-50 space-y-3">
              <p className="text-sm font-semibold text-gray-700 flex items-center gap-2"><Building2 size={14} />Nowy dostawca</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label text-xs">Alias / skrócona nazwa <span className="text-red-500">*</span></label>
                  <input className="input text-sm" placeholder='"Triada"'
                    value={newSupp.alias} onChange={e => setNewSupp(p => ({ ...p, alias: e.target.value }))} />
                </div>
                <div>
                  <label className="label text-xs">NIP</label>
                  <input className="input text-sm font-mono" placeholder="1234567890"
                    value={newSupp.nip} onChange={e => setNewSupp(p => ({ ...p, nip: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="label text-xs">Pełna nazwa firmy</label>
                <input className="input text-sm" placeholder='"Triada Sp. z o.o."'
                  value={newSupp.full_name} onChange={e => setNewSupp(p => ({ ...p, full_name: e.target.value }))} />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={saveNewSupplier}
                  className="px-4 py-2 bg-brand-green text-white text-sm font-medium rounded-lg hover:bg-brand-green-dark">
                  Zapisz dostawcę
                </button>
                <button type="button" onClick={() => { setShowAddSupplier(false); setNewSupp(EMPTY_NEW_SUPP) }}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                  Anuluj
                </button>
              </div>
            </div>
          )}

          <button
            onClick={() => setStep(2)}
            disabled={!canGoNext()}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-4 rounded-xl text-sm font-bold transition-colors min-h-[56px]',
              canGoNext()
                ? 'bg-brand-green hover:bg-brand-green-dark text-white'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            )}
          >
            Dalej <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* ── STEP 2: Kategorie ── */}
      {step === 2 && (
        <div className="card space-y-4">
          <h2 className="font-bold text-gray-900 text-lg">Co przyjechało?</h2>
          <p className="text-xs text-gray-500 -mt-2">Możesz zaznaczyć kilka kategorii</p>

          <div className="grid grid-cols-2 gap-2.5">
            {DELIVERY_CATEGORIES.map(cat => {
              const sel = form.categories.includes(cat.id)
              return (
                <button key={cat.id} type="button" onClick={() => toggleCategory(cat.id)}
                  className={cn(
                    'px-3 py-3.5 rounded-xl border-2 text-sm transition-all text-left flex items-center justify-between gap-1 min-h-[52px]',
                    sel ? cn(cat.activeClass, 'font-semibold') : 'border-gray-100 bg-white text-gray-700 hover:border-gray-200'
                  )}>
                  <span>{cat.label}</span>
                  {cat.requiresTemp && <Thermometer size={13} className={sel ? 'opacity-80' : 'opacity-30'} />}
                </button>
              )
            })}
          </div>

          {requiresTemp && (
            <div className="flex items-start gap-2 text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2.5">
              <Thermometer size={13} className="mt-0.5 shrink-0" />
              <span>Wymagany pomiar temperatury przy odbiorze: {tempRequiredCats.map(c => `${c.label} (${c.tempHint})`).join(' · ')}</span>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep(1)}
              className="flex-1 py-4 rounded-xl text-sm font-medium text-gray-600 border-2 border-gray-200 hover:bg-gray-50 min-h-[56px]">
              ← Wróć
            </button>
            <button onClick={() => setStep(3)} disabled={!canGoNext()}
              className={cn(
                'flex-[3] flex items-center justify-center gap-2 py-4 rounded-xl text-sm font-bold transition-colors min-h-[56px]',
                canGoNext() ? 'bg-brand-green hover:bg-brand-green-dark text-white' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              )}>
              Dalej <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Dane produktu ── */}
      {step === 3 && (
        <div className="card space-y-4">
          <h2 className="font-bold text-gray-900 text-lg">Dane produktu</h2>

          <div>
            <label className="label">Produkt / towar <span className="text-red-500">*</span></label>
            <input className="input" placeholder="np. Pierś z kurczaka, Mleko 3,2%"
              value={form.product} onChange={e => setForm(p => ({ ...p, product: e.target.value }))} />
          </div>

          <div>
            <label className="label">Ilość <span className="text-red-500">*</span></label>
            <input className="input" placeholder="np. 10 kg, 50 szt., 5 kartonów"
              value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))} />
          </div>

          <div>
            <label className="label">Data ważności <span className="text-gray-400 font-normal">(opcjonalna)</span></label>
            <input type="date" className="input"
              value={form.expiry_date} onChange={e => setForm(p => ({ ...p, expiry_date: e.target.value }))} />
          </div>

          {hasChilled && (
            <div>
              <label className="label">
                {needsTwoTempFields
                  ? `Temperatura — produkty chłodzone (${chilledCats.map(c => c.label).join(', ')})`
                  : 'Temperatura przy odbiorze (°C)'}
                {' '}<span className="text-red-500">*</span>
              </label>
              <input type="number" step="0.1" inputMode="decimal" className="input font-mono text-xl text-center py-3 h-14"
                placeholder="np. 4.2"
                value={form.temp_at_delivery} onChange={e => setForm(p => ({ ...p, temp_at_delivery: e.target.value }))} />
              <p className="text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-3 py-1.5 mt-2">
                🌡 Produkty chłodzone: wymagana temperatura 0–8°C
              </p>
            </div>
          )}

          {hasFrozen && (
            <div>
              <label className="label">
                {needsTwoTempFields ? 'Temperatura — mrożonki' : 'Temperatura przy odbiorze (°C)'}
                {' '}<span className="text-red-500">*</span>
              </label>
              <input type="number" step="0.1" inputMode="decimal" className="input font-mono text-xl text-center py-3 h-14"
                placeholder="np. −18.5"
                value={needsTwoTempFields ? form.temp_frozen : form.temp_at_delivery}
                onChange={e => setForm(p => needsTwoTempFields
                  ? { ...p, temp_frozen: e.target.value }
                  : { ...p, temp_at_delivery: e.target.value })} />
              <p className="text-xs text-cyan-700 bg-cyan-50 border border-cyan-200 rounded-lg px-3 py-1.5 mt-2">
                ❄ Mrożonki: wymagana temperatura ≤ −18°C
              </p>
              {/* frozen out-of-range warning */}
              {(() => {
                const val = needsTwoTempFields ? form.temp_frozen : form.temp_at_delivery
                return val && parseFloat(val) > -18 ? (
                  <div className="flex items-center gap-2 mt-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    <AlertCircle size={13} />
                    Temperatura mrożonek wyższa niż −18°C — dostawa wymaga uwagi
                  </div>
                ) : null
              })()}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep(2)}
              className="flex-1 py-4 rounded-xl text-sm font-medium text-gray-600 border-2 border-gray-200 hover:bg-gray-50 min-h-[56px]">
              ← Wróć
            </button>
            <button onClick={() => setStep(4)} disabled={!canGoNext()}
              className={cn(
                'flex-[3] flex items-center justify-center gap-2 py-4 rounded-xl text-sm font-bold transition-colors min-h-[56px]',
                canGoNext() ? 'bg-brand-green hover:bg-brand-green-dark text-white' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              )}>
              Dalej <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 4: Jakość i zapis ── */}
      {step === 4 && (
        <div className="card space-y-5">
          <h2 className="font-bold text-gray-900 text-lg">Jakość i zapis</h2>

          {/* Quality selection */}
          <div>
            <label className="label">Jakość dostawy <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-2 gap-3">
              <button type="button"
                onClick={() => setForm(p => ({ ...p, quality_ok: true, nonconformity_desc: '' }))}
                className={cn(
                  'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all min-h-[80px]',
                  form.quality_ok === true
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                )}>
                <CheckCircle2 size={28} className={form.quality_ok === true ? 'text-green-600' : 'text-gray-300'} />
                <span className={cn('text-sm font-bold', form.quality_ok === true ? 'text-green-700' : 'text-gray-600')}>Jakość OK</span>
              </button>
              <button type="button"
                onClick={() => setForm(p => ({ ...p, quality_ok: false }))}
                className={cn(
                  'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all min-h-[80px]',
                  form.quality_ok === false
                    ? 'border-red-500 bg-red-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                )}>
                <AlertCircle size={28} className={form.quality_ok === false ? 'text-red-600' : 'text-gray-300'} />
                <span className={cn('text-sm font-bold', form.quality_ok === false ? 'text-red-700' : 'text-gray-600')}>Niezgodna</span>
              </button>
            </div>
          </div>

          {/* Nonconformity description */}
          {form.quality_ok === false && (
            <div className="space-y-3">
              <div>
                <label className="label">Opisz niezgodność <span className="text-red-500">*</span></label>
                <input className="input" placeholder="Opisz problem z dostawą..."
                  value={form.nonconformity_desc}
                  onChange={e => setForm(p => ({ ...p, nonconformity_desc: e.target.value }))} />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-2">Szybki wybór:</p>
                <div className="flex flex-wrap gap-2">
                  {NONCONFORMITY_HINTS.map(hint => (
                    <button key={hint} type="button"
                      onClick={() => setForm(p => ({ ...p, nonconformity_desc: hint }))}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs border transition-colors',
                        form.nonconformity_desc === hint
                          ? 'border-red-400 bg-red-50 text-red-700 font-medium'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      )}>
                      {hint}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* File upload */}
          <div>
            <label className="label">
              Dokumenty / zdjęcia <span className="text-gray-400 font-normal">(opcjonalne — np. wszystkie strony faktury)</span>
            </label>
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

          {/* Notes */}
          <div>
            <label className="label">Uwagi <span className="text-gray-400 font-normal">(opcjonalne)</span></label>
            <textarea rows={2} className="input resize-none" placeholder="Dodatkowe informacje..."
              value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(3)}
              className="flex-1 py-4 rounded-xl text-sm font-medium text-gray-600 border-2 border-gray-200 hover:bg-gray-50 min-h-[56px]">
              ← Wróć
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || form.quality_ok === null || (!form.quality_ok && !form.nonconformity_desc.trim())}
              className={cn(
                'flex-[3] flex items-center justify-center gap-2 py-4 rounded-xl text-sm font-bold transition-colors min-h-[56px]',
                loading || form.quality_ok === null || (!form.quality_ok && !form.nonconformity_desc.trim())
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-brand-green hover:bg-brand-green-dark text-white'
              )}>
              {loading ? 'Zapisywanie…' : <><CheckCircle2 size={16} /> Zapisz dostawę</>}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
