'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ChevronLeft, Paperclip, X, Thermometer, Building2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const DELIVERY_CATEGORIES = [
  { id: 'mieso',    label: 'Mięso świeże',          requiresTemp: true,  tempHint: '0 – 7°C',  activeClass: 'border-red-400 bg-red-50 text-red-700' },
  { id: 'drob',     label: 'Drób i królik',          requiresTemp: true,  tempHint: '0 – 4°C',  activeClass: 'border-orange-400 bg-orange-50 text-orange-700' },
  { id: 'ryby',     label: 'Ryby i owoce morza',     requiresTemp: true,  tempHint: '0 – 4°C',  activeClass: 'border-blue-400 bg-blue-50 text-blue-700' },
  { id: 'wedliny',  label: 'Wędliny i przetwory',    requiresTemp: true,  tempHint: '0 – 7°C',  activeClass: 'border-rose-400 bg-rose-50 text-rose-700' },
  { id: 'nabiał',   label: 'Nabiał',                 requiresTemp: true,  tempHint: '0 – 8°C',  activeClass: 'border-yellow-400 bg-yellow-50 text-yellow-700' },
  { id: 'mrozonki', label: 'Mrożonki',               requiresTemp: true,  tempHint: '≤ −18°C',  activeClass: 'border-cyan-400 bg-cyan-50 text-cyan-700' },
  { id: 'gotowe',   label: 'Dania gotowe / GMP',     requiresTemp: true,  tempHint: '0 – 4°C',  activeClass: 'border-purple-400 bg-purple-50 text-purple-700' },
  { id: 'warzywa',  label: 'Warzywa i owoce',        requiresTemp: false, tempHint: '',          activeClass: 'border-green-400 bg-green-50 text-green-700' },
  { id: 'suche',    label: 'Produkty suche',         requiresTemp: false, tempHint: '',          activeClass: 'border-amber-400 bg-amber-50 text-amber-700' },
  { id: 'pieczywo', label: 'Pieczywo',               requiresTemp: false, tempHint: '',          activeClass: 'border-amber-400 bg-amber-50 text-amber-700' },
  { id: 'napoje',   label: 'Napoje',                 requiresTemp: false, tempHint: '',          activeClass: 'border-sky-400 bg-sky-50 text-sky-700' },
  { id: 'inne',     label: 'Inne',                   requiresTemp: false, tempHint: '',          activeClass: 'border-gray-400 bg-gray-50 text-gray-600' },
]

interface Supplier {
  id: string
  alias: string
  full_name: string
  nip: string
  notes: string | null
}

const EMPTY_NEW_SUPP = { alias: '', full_name: '', nip: '', notes: '' }

export default function NowaDostawaPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [newSupp, setNewSupp] = useState(EMPTY_NEW_SUPP)
  const [showAddSupplier, setShowAddSupplier] = useState(false)
  const [form, setForm] = useState({
    supplier: '',
    categories: [] as string[],
    product: '',
    quantity: '',
    temp_at_delivery: '',
    expiry_date: '',
    quality_ok: true,
    notes: '',
  })
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  const tempRequiredCats = DELIVERY_CATEGORIES.filter(c => form.categories.includes(c.id) && c.requiresTemp)
  const requiresTemp = tempRequiredCats.length > 0

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase.from('profiles').select('location_id').eq('id', user!.id).single()
      const { data } = await supabase
        .from('location_suppliers')
        .select('*')
        .eq('location_id', profile?.location_id ?? '')
        .order('alias')
      setSuppliers(data ?? [])
    }
    load()
  }, [])

  async function getCtx() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('location_id').eq('id', user!.id).single()
    return { locationId: profile?.location_id ?? '', userId: user!.id }
  }

  async function saveNewSupplier() {
    if (!newSupp.alias.trim()) { toast.error('Wpisz alias / skróconą nazwę'); return }
    const { locationId } = await getCtx()
    const { data, error } = await supabase
      .from('location_suppliers')
      .insert({
        location_id: locationId,
        alias: newSupp.alias.trim(),
        full_name: newSupp.full_name.trim(),
        nip: newSupp.nip.trim(),
        notes: newSupp.notes.trim() || null,
      })
      .select()
      .single()
    if (error) { toast.error('Błąd zapisu dostawcy: ' + error.message); return }
    setSuppliers(p => [...p, data].sort((a, b) => a.alias.localeCompare(b.alias)))
    setForm(p => ({ ...p, supplier: data.alias }))
    setNewSupp(EMPTY_NEW_SUPP)
    setShowAddSupplier(false)
    toast.success('Dostawca dodany!')
  }

  function toggleCategory(id: string) {
    setForm(p => ({
      ...p,
      categories: p.categories.includes(id)
        ? p.categories.filter(c => c !== id)
        : [...p.categories, id],
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.supplier) { toast.error('Wybierz lub wpisz dostawcę'); return }
    if (form.categories.length === 0) { toast.error('Wybierz przynajmniej jedną kategorię dostawy'); return }
    if (!form.product) { toast.error('Podaj nazwę produktu / towaru'); return }
    if (requiresTemp && !form.temp_at_delivery) {
      const names = tempRequiredCats.map(c => `${c.label} (${c.tempHint})`).join(', ')
      toast.error(`Temperatura wymagana dla: ${names}`)
      return
    }
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

    const { error } = await supabase.from('delivery_logs').insert({
      location_id: locationId,
      supplier: form.supplier,
      categories: form.categories,
      product: form.product,
      quantity: form.quantity,
      temp_at_delivery: form.temp_at_delivery ? parseFloat(form.temp_at_delivery) : null,
      expiry_date: form.expiry_date || null,
      quality_ok: form.quality_ok,
      notes: form.notes || null,
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
    <div className="max-w-xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dostawy" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ChevronLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nowa dostawa</h1>
          <p className="text-sm text-gray-500 mt-0.5">Zarejestruj przyjęcie dostawy</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-5">

        {/* ── Supplier ── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="label mb-0">Dostawca</p>
            <button type="button" onClick={() => setShowAddSupplier(!showAddSupplier)}
              className="text-xs text-brand-green hover:underline flex items-center gap-1">
              <Plus size={12} /> Dodaj nowego dostawcę
            </button>
          </div>

          {showAddSupplier && (
            <div className="mb-3 p-3 border border-gray-200 rounded-lg bg-gray-50 space-y-3">
              <p className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                <Building2 size={14} /> Nowy dostawca
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label text-xs">Alias / skrócona nazwa <span className="text-red-500">*</span></label>
                  <input className="input text-sm" placeholder='np. "Triada"'
                    value={newSupp.alias} onChange={(e) => setNewSupp(p => ({ ...p, alias: e.target.value }))} />
                </div>
                <div>
                  <label className="label text-xs">NIP</label>
                  <input className="input text-sm font-mono" placeholder="1234567890"
                    value={newSupp.nip} onChange={(e) => setNewSupp(p => ({ ...p, nip: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="label text-xs">Pełna nazwa firmy</label>
                <input className="input text-sm" placeholder='np. "Triada Sp. z o.o."'
                  value={newSupp.full_name} onChange={(e) => setNewSupp(p => ({ ...p, full_name: e.target.value }))} />
              </div>
              <div>
                <label className="label text-xs">Uwagi (opcjonalnie)</label>
                <input className="input text-sm" placeholder="np. Dostarcza w poniedziałki i czwartki"
                  value={newSupp.notes} onChange={(e) => setNewSupp(p => ({ ...p, notes: e.target.value }))} />
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={saveNewSupplier}>Zapisz dostawcę</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => { setShowAddSupplier(false); setNewSupp(EMPTY_NEW_SUPP) }}>Anuluj</Button>
              </div>
            </div>
          )}

          {suppliers.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 mb-2">
              {suppliers.map((s) => {
                const isSelected = form.supplier === s.alias
                return (
                  <button key={s.id} type="button"
                    onClick={() => setForm(p => ({ ...p, supplier: p.supplier === s.alias ? '' : s.alias }))}
                    className={cn(
                      'p-2.5 rounded-lg border text-left transition-colors',
                      isSelected
                        ? 'border-brand-green bg-green-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    )}>
                    <p className={cn('text-sm font-semibold leading-tight', isSelected ? 'text-green-700' : 'text-gray-800')}>
                      {s.alias}
                    </p>
                    {s.full_name && (
                      <p className="text-xs text-gray-500 leading-tight mt-0.5 truncate">{s.full_name}</p>
                    )}
                    {s.nip && (
                      <p className="text-xs text-gray-400 font-mono mt-0.5">NIP: {s.nip}</p>
                    )}
                  </button>
                )
              })}
            </div>
          ) : (
            !showAddSupplier && (
              <p className="text-xs text-gray-400 mb-2">
                Brak dostawców. Dodaj pierwszego klikając przycisk powyżej.
              </p>
            )
          )}

          <input className="input text-sm" placeholder="Lub wpisz ręcznie..."
            value={form.supplier} onChange={(e) => setForm(p => ({ ...p, supplier: e.target.value }))} />
        </div>

        {/* ── Categories (multi-select) ── */}
        <div>
          <p className="label">
            Kategoria dostawy
            <span className="ml-1 text-xs font-normal text-gray-400">(można zaznaczyć kilka)</span>
          </p>
          <div className="grid grid-cols-2 gap-2">
            {DELIVERY_CATEGORIES.map((cat) => {
              const isSelected = form.categories.includes(cat.id)
              return (
                <button key={cat.id} type="button" onClick={() => toggleCategory(cat.id)}
                  className={cn(
                    'px-3 py-2 rounded-lg text-sm border transition-colors text-left flex items-center justify-between gap-1',
                    isSelected
                      ? cn(cat.activeClass, 'font-medium')
                      : 'border-gray-200 hover:border-gray-300 text-gray-700 bg-white'
                  )}>
                  <span>{cat.label}</span>
                  {cat.requiresTemp && <Thermometer size={12} className="shrink-0 opacity-50" />}
                </button>
              )
            })}
          </div>
          {requiresTemp && (
            <div className="mt-2 text-xs text-orange-600 flex items-start gap-1.5">
              <Thermometer size={12} className="mt-0.5 shrink-0" />
              <span>
                Wymagany pomiar temperatury (HACCP):
                {' '}{tempRequiredCats.map(c => `${c.label} ${c.tempHint}`).join(' · ')}
              </span>
            </div>
          )}
        </div>

        {/* ── Product + Quantity ── */}
        <Input label="Produkt / towar" placeholder="np. Pierś z kurczaka, Mleko 3,2%"
          value={form.product} onChange={(e) => setForm(p => ({ ...p, product: e.target.value }))} required />

        <Input label="Ilość" placeholder="np. 10 kg, 50 szt., 5 kartonów"
          value={form.quantity} onChange={(e) => setForm(p => ({ ...p, quantity: e.target.value }))} required />

        {/* ── Temperature (only when required) ── */}
        {requiresTemp && (
          <div>
            <label className="label">
              Temperatura przy odbiorze (°C)
              <span className="ml-1 text-xs font-normal text-orange-500">wymagane</span>
            </label>
            <input type="number" step="0.1" className="input font-mono"
              placeholder={form.categories.includes('mrozonki') ? 'np. −18.5' : 'np. 4.2'}
              value={form.temp_at_delivery}
              onChange={(e) => setForm(p => ({ ...p, temp_at_delivery: e.target.value }))} />
          </div>
        )}

        {/* ── Expiry date ── */}
        <div>
          <label className="label">Data ważności (opcjonalnie)</label>
          <input type="date" className="input" value={form.expiry_date}
            onChange={(e) => setForm(p => ({ ...p, expiry_date: e.target.value }))} />
        </div>

        {/* ── Quality ── */}
        <div>
          <label className="label">Jakość dostawy</label>
          <div className="flex gap-3">
            <label className={cn(
              'flex-1 flex items-center justify-center p-3 rounded-lg border cursor-pointer transition-colors text-sm',
              form.quality_ok ? 'border-brand-green bg-green-50 text-green-700 font-medium' : 'border-gray-200 text-gray-600'
            )}>
              <input type="radio" className="sr-only" checked={form.quality_ok}
                onChange={() => setForm(p => ({ ...p, quality_ok: true }))} />
              Jakość OK
            </label>
            <label className={cn(
              'flex-1 flex items-center justify-center p-3 rounded-lg border cursor-pointer transition-colors text-sm',
              !form.quality_ok ? 'border-red-400 bg-red-50 text-red-700 font-medium' : 'border-gray-200 text-gray-600'
            )}>
              <input type="radio" className="sr-only" checked={!form.quality_ok}
                onChange={() => setForm(p => ({ ...p, quality_ok: false }))} />
              Niezgodna
            </label>
          </div>
        </div>

        {/* ── Document upload ── */}
        <div>
          <label className="label">Dokument / zdjęcie dostawy (opcjonalnie)</label>
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

        {/* ── Notes ── */}
        <div>
          <label className="label">Uwagi (opcjonalnie)</label>
          <textarea rows={2} placeholder="Dodatkowe informacje, zastrzeżenia..."
            className="input resize-none" value={form.notes}
            onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))} />
        </div>

        <div className="flex gap-3 pt-1">
          <Button type="submit" loading={loading} className="flex-1">Zapisz dostawę</Button>
          <Button type="button" variant="secondary" onClick={() => router.back()}>Anuluj</Button>
        </div>
      </form>
    </div>
  )
}
