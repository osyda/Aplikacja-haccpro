'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ChevronLeft, Paperclip, X, Thermometer } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const DELIVERY_CATEGORIES = [
  { id: 'mieso',    label: 'Mięso świeże/chłodzone',  requiresTemp: true,  tempHint: '0 – 7°C',   activeClass: 'border-red-400 bg-red-50 text-red-700' },
  { id: 'drob',     label: 'Drób i królik',            requiresTemp: true,  tempHint: '0 – 4°C',   activeClass: 'border-orange-400 bg-orange-50 text-orange-700' },
  { id: 'ryby',     label: 'Ryby i owoce morza',       requiresTemp: true,  tempHint: '0 – 4°C',   activeClass: 'border-blue-400 bg-blue-50 text-blue-700' },
  { id: 'wedliny',  label: 'Wędliny i przetwory',      requiresTemp: true,  tempHint: '0 – 7°C',   activeClass: 'border-rose-400 bg-rose-50 text-rose-700' },
  { id: 'nabiał',   label: 'Nabiał (mleko, sery)',     requiresTemp: true,  tempHint: '0 – 8°C',   activeClass: 'border-yellow-400 bg-yellow-50 text-yellow-700' },
  { id: 'mrozonki', label: 'Mrożonki',                 requiresTemp: true,  tempHint: '≤ −18°C',   activeClass: 'border-cyan-400 bg-cyan-50 text-cyan-700' },
  { id: 'gotowe',   label: 'Dania gotowe / GMP',       requiresTemp: true,  tempHint: '0 – 4°C',   activeClass: 'border-purple-400 bg-purple-50 text-purple-700' },
  { id: 'warzywa',  label: 'Warzywa i owoce',          requiresTemp: false, tempHint: '',           activeClass: 'border-green-400 bg-green-50 text-green-700' },
  { id: 'suche',    label: 'Produkty suche',           requiresTemp: false, tempHint: '',           activeClass: 'border-amber-400 bg-amber-50 text-amber-700' },
  { id: 'pieczywo', label: 'Pieczywo i wyroby cukier.',requiresTemp: false, tempHint: '',           activeClass: 'border-amber-400 bg-amber-50 text-amber-700' },
  { id: 'napoje',   label: 'Napoje',                   requiresTemp: false, tempHint: '',           activeClass: 'border-sky-400 bg-sky-50 text-sky-700' },
  { id: 'inne',     label: 'Inne',                     requiresTemp: false, tempHint: '',           activeClass: 'border-gray-400 bg-gray-50 text-gray-600' },
]

export default function NowaDostawaPage() {
  const [suppliers, setSuppliers] = useState<string[]>([])
  const [newSupplier, setNewSupplier] = useState('')
  const [showAddSupplier, setShowAddSupplier] = useState(false)
  const [form, setForm] = useState({
    supplier: '', category: '', product: '',
    quantity: '', temp_at_delivery: '', expiry_date: '',
    quality_ok: true, notes: '',
  })
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  const selectedCat = DELIVERY_CATEGORIES.find(c => c.id === form.category)
  const requiresTemp = selectedCat?.requiresTemp ?? false

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase.from('profiles').select('location_id').eq('id', user!.id).single()
      const { data: loc } = await supabase.from('locations').select('suppliers').eq('id', profile?.location_id ?? '').single()
      setSuppliers(loc?.suppliers ?? [])
    }
    load()
  }, [])

  async function getCtx() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('location_id').eq('id', user!.id).single()
    return { locationId: profile?.location_id ?? '', userId: user!.id }
  }

  async function saveNewSupplier() {
    const name = newSupplier.trim()
    if (!name) return
    const { locationId } = await getCtx()
    const updated = [...suppliers, name]
    await supabase.from('locations').update({ suppliers: updated }).eq('id', locationId)
    setSuppliers(updated)
    setForm(p => ({ ...p, supplier: name }))
    setNewSupplier('')
    setShowAddSupplier(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.supplier) { toast.error('Wybierz lub wpisz dostawcę'); return }
    if (!form.category) { toast.error('Wybierz kategorię dostawy'); return }
    if (!form.product) { toast.error('Podaj nazwę produktu'); return }
    if (requiresTemp && !form.temp_at_delivery) {
      toast.error(`Temperatura wymagana dla kategorii "${selectedCat?.label}" — norma: ${selectedCat?.tempHint}`)
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
      category: form.category || null,
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

        {/* Supplier */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="label mb-0">Dostawca</p>
            <button type="button" onClick={() => setShowAddSupplier(!showAddSupplier)}
              className="text-xs text-brand-green hover:underline">
              + Dodaj nowego dostawcę
            </button>
          </div>
          {showAddSupplier && (
            <div className="flex gap-2 mb-2">
              <input className="input flex-1 text-sm" placeholder="Nazwa dostawcy" value={newSupplier}
                onChange={(e) => setNewSupplier(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), saveNewSupplier())} />
              <Button type="button" size="sm" onClick={saveNewSupplier}>Dodaj</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setShowAddSupplier(false)}>Anuluj</Button>
            </div>
          )}
          {suppliers.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {suppliers.map((s) => (
                <button key={s} type="button" onClick={() => setForm(p => ({ ...p, supplier: s }))}
                  className={cn('px-3 py-1.5 rounded-lg text-sm border transition-colors',
                    form.supplier === s
                      ? 'border-brand-green bg-green-50 text-green-700 font-medium'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700')}>
                  {s}
                </button>
              ))}
            </div>
          )}
          <input className="input text-sm" placeholder="Lub wpisz dostawcę ręcznie..."
            value={form.supplier} onChange={(e) => setForm(p => ({ ...p, supplier: e.target.value }))} />
        </div>

        {/* Category */}
        <div>
          <p className="label">Kategoria dostawy</p>
          <div className="grid grid-cols-2 gap-2">
            {DELIVERY_CATEGORIES.map((cat) => (
              <button key={cat.id} type="button"
                onClick={() => setForm(p => ({ ...p, category: cat.id, temp_at_delivery: '' }))}
                className={cn(
                  'px-3 py-2 rounded-lg text-sm border transition-colors text-left flex items-center justify-between gap-1',
                  form.category === cat.id
                    ? cn(cat.activeClass, 'font-medium')
                    : 'border-gray-200 hover:border-gray-300 text-gray-700 bg-white'
                )}>
                <span>{cat.label}</span>
                {cat.requiresTemp && <Thermometer size={12} className="shrink-0 opacity-50" />}
              </button>
            ))}
          </div>
          {selectedCat?.requiresTemp && (
            <p className="text-xs text-orange-600 mt-1.5 flex items-center gap-1">
              <Thermometer size={12} />
              Wymagany pomiar temperatury zgodnie z HACCP — norma: <strong>{selectedCat.tempHint}</strong>
            </p>
          )}
        </div>

        {/* Product + Quantity */}
        <Input label="Produkt / towar" placeholder="np. Pierś z kurczaka, Mleko 3,2%"
          value={form.product} onChange={(e) => setForm(p => ({ ...p, product: e.target.value }))} required />

        <Input label="Ilość" placeholder="np. 10 kg, 50 szt., 5 kartonów"
          value={form.quantity} onChange={(e) => setForm(p => ({ ...p, quantity: e.target.value }))} required />

        {/* Temperature — only for categories that require it */}
        {requiresTemp && (
          <div>
            <label className="label">
              Temperatura przy odbiorze (°C)
              <span className="ml-1 text-xs font-normal text-orange-500">wymagane · norma: {selectedCat?.tempHint}</span>
            </label>
            <input type="number" step="0.1" className="input font-mono"
              placeholder={form.category === 'mrozonki' ? 'np. −18.5' : 'np. 4.2'}
              value={form.temp_at_delivery}
              onChange={(e) => setForm(p => ({ ...p, temp_at_delivery: e.target.value }))} />
          </div>
        )}

        {/* Expiry date */}
        <div>
          <label className="label">Data ważności (opcjonalnie)</label>
          <input type="date" className="input" value={form.expiry_date}
            onChange={(e) => setForm(p => ({ ...p, expiry_date: e.target.value }))} />
        </div>

        {/* Quality */}
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

        {/* Document / photo upload */}
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

        {/* Notes */}
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
