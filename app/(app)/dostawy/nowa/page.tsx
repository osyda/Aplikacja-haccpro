'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft, Paperclip, X, Thermometer, Building2, Plus, CheckCircle2, AlertCircle, ChevronRight, Camera, Sparkles, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
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
                done ? 'bg-green-500 border-green-500 text-white'
                  : active ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-white border-gray-200 text-gray-400'
              )}>
                {done ? <CheckCircle2 size={14} /> : num}
              </div>
              <span className={cn('text-[10px] mt-1 font-medium', active ? 'text-blue-600' : done ? 'text-green-600' : 'text-gray-400')}>
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
  const [showAddSupplier, setShowAddSupplier] = useState(false)
  const [newSupp, setNewSupp] = useState(EMPTY_NEW_SUPP)
  const [form, setForm] = useState({
    supplier: '',
    categories: [] as string[],
    product: '',
    quantity: '',
    temp_at_delivery: '',
    expiry_date: '',
    quality_ok: true as boolean | null,
    nonconformity_desc: '',
    notes: '',
  })
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const scanRef = useRef<HTMLInputElement>(null)
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const tempRequiredCats = DELIVERY_CATEGORIES.filter(c => form.categories.includes(c.id) && c.requiresTemp)
  const requiresTemp = tempRequiredCats.length > 0
  const hasFrozen = form.categories.includes('mrozonki')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase.from('profiles').select('location_id').eq('id', user!.id).single()
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

  async function handleScan(file: File) {
    setScanning(true)
    setScanResult(null)
    setFile(file) // pre-fill step 4 attachment with the scanned file
    try {
      const fd = new FormData()
      fd.append('file', file)
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
      return true
    }
    return true
  }

  async function handleSubmit() {
    if (form.quality_ok === null) { toast.error('Oceń jakość dostawy'); return }
    if (!form.quality_ok && !form.nonconformity_desc.trim()) { toast.error('Opisz niezgodność'); return }

    setLoading(true)
    const { locationId, userId } = await getCtx()

    let photo_url: string | null = null
    if (file) {
      const ext = file.name.split('.').pop()
      const filePath = `${locationId}/dostawy/${Date.now()}.${ext}`
      const bucket = file.type === 'application/pdf' ? 'documents' : 'delivery-photos'
      const { data: up, error: upErr } = await supabase.storage.from(bucket).upload(filePath, file)
      if (upErr) { toast.error('Błąd uploadu: ' + upErr.message); setLoading(false); return }
      photo_url = supabase.storage.from(bucket).getPublicUrl(up.path).data.publicUrl
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
      expiry_date: form.expiry_date || null,
      quality_ok: form.quality_ok,
      notes,
      photo_url,
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
            <button type="button" onClick={() => { setScanResult(null); if (scanRef.current) scanRef.current.value = '' }}
              className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
              <RotateCcw size={12} /> Skanuj ponownie
            </button>
          )}
        </div>

        {!scanResult ? (
          <label className={cn(
            'flex items-center justify-center gap-3 w-full py-4 rounded-xl border-2 border-dashed cursor-pointer transition-all min-h-[64px]',
            scanning
              ? 'border-purple-300 bg-purple-50 cursor-wait'
              : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50'
          )}>
            {scanning ? (
              <>
                <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm font-medium text-purple-700">Analizowanie faktury…</span>
              </>
            ) : (
              <>
                <Camera size={20} className="text-purple-400" />
                <span className="text-sm font-medium text-gray-600">Zdjęcie, skan lub PDF faktury</span>
              </>
            )}
            <input
              ref={scanRef}
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              disabled={scanning}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleScan(f) }}
            />
          </label>
        ) : (
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
                  <button key={s.id} type="button"
                    onClick={() => setForm(p => ({ ...p, supplier: sel ? '' : s.alias }))}
                    className={cn(
                      'p-3 rounded-xl border-2 text-left transition-all min-h-[72px]',
                      sel ? 'border-blue-500 bg-blue-50' : 'border-gray-100 bg-white hover:border-gray-200'
                    )}>
                    <p className={cn('font-bold text-sm leading-tight', sel ? 'text-blue-700' : 'text-gray-900')}>{s.alias}</p>
                    {s.full_name && <p className="text-xs text-gray-500 mt-0.5 leading-tight truncate">{s.full_name}</p>}
                    {s.nip && <p className="text-xs text-gray-400 font-mono mt-0.5">NIP: {s.nip}</p>}
                  </button>
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
                  className="px-4 py-2 bg-brand-green text-white text-sm font-medium rounded-lg hover:bg-green-700">
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
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
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
                canGoNext() ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
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

          {requiresTemp && (
            <div>
              <label className="label">
                Temperatura przy odbiorze (°C) <span className="text-red-500">*</span>
              </label>
              <input type="number" step="0.1" inputMode="decimal" className="input font-mono text-xl text-center py-3 h-14"
                placeholder={hasFrozen ? 'np. −18.5' : 'np. 4.2'}
                value={form.temp_at_delivery} onChange={e => setForm(p => ({ ...p, temp_at_delivery: e.target.value }))} />
              {hasFrozen ? (
                <p className="text-xs text-cyan-700 bg-cyan-50 border border-cyan-200 rounded-lg px-3 py-1.5 mt-2">
                  ❄ Mrożonki: wymagana temperatura ≤ −18°C
                </p>
              ) : (
                <p className="text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-3 py-1.5 mt-2">
                  🌡 Produkty chłodzone: wymagana temperatura 0–8°C
                </p>
              )}
              {/* frozen out-of-range warning */}
              {hasFrozen && form.temp_at_delivery && parseFloat(form.temp_at_delivery) > -18 && (
                <div className="flex items-center gap-2 mt-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <AlertCircle size={13} />
                  Temperatura mrożonek wyższa niż −18°C — dostawa wymaga uwagi
                </div>
              )}
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
                canGoNext() ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
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
            <label className="label">Dokument / zdjęcie <span className="text-gray-400 font-normal">(opcjonalne)</span></label>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-600 cursor-pointer hover:border-gray-300 transition-colors flex-1">
                <Paperclip size={14} />
                {file ? file.name : 'Wybierz plik (JPG, PNG, PDF)'}
                <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden"
                  onChange={e => setFile(e.target.files?.[0] ?? null)} />
              </label>
              {file && (
                <button type="button" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = '' }}>
                  <X size={16} className="text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>
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
                  : 'bg-brand-green hover:bg-green-700 text-white'
              )}>
              {loading ? 'Zapisywanie…' : <><CheckCircle2 size={16} /> Zapisz dostawę</>}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
