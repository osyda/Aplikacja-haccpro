'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ChevronLeft, Camera, Upload } from 'lucide-react'

export default function NowaDostawaPage() {
  const [form, setForm] = useState({
    supplier: '', product: '', quantity: '',
    temp_at_delivery: '', expiry_date: '', quality_ok: true, notes: '',
  })
  const [photo, setPhoto] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value, type } = e.target
    const checked = (e.target as HTMLInputElement).checked
    setForm((p) => ({ ...p, [name]: type === 'checkbox' ? checked : value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('location_id').eq('id', user!.id).single()

    let photo_url: string | null = null

    if (photo && profile?.location_id) {
      const ext = photo.name.split('.').pop()
      const path = `${profile.location_id}/dostawy/${Date.now()}.${ext}`
      const { data: uploadData } = await supabase.storage.from('delivery-photos').upload(path, photo)
      if (uploadData) {
        const { data: urlData } = supabase.storage.from('delivery-photos').getPublicUrl(path)
        photo_url = urlData.publicUrl
      }
    }

    const { error: insertError } = await supabase.from('delivery_logs').insert({
      location_id: profile?.location_id ?? '',
      supplier: form.supplier,
      product: form.product,
      quantity: form.quantity,
      temp_at_delivery: form.temp_at_delivery ? parseFloat(form.temp_at_delivery) : null,
      expiry_date: form.expiry_date || null,
      quality_ok: form.quality_ok,
      notes: form.notes || null,
      photo_url,
      received_at: new Date().toISOString(),
      recorded_by: user!.id,
    })

    setLoading(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
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

      <form onSubmit={handleSubmit} className="card space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>
        )}

        <Input name="supplier" label="Dostawca" placeholder="np. Makro, PHU Kowalski" value={form.supplier} onChange={handleChange} required />
        <Input name="product" label="Produkt / towar" placeholder="np. Pierś z kurczaka" value={form.product} onChange={handleChange} required />
        <Input name="quantity" label="Ilość" placeholder="np. 10 kg, 50 szt." value={form.quantity} onChange={handleChange} required />

        <div className="grid grid-cols-2 gap-3">
          <Input name="temp_at_delivery" type="number" step="0.1" label="Temperatura dostawy (°C)" placeholder="np. 4.2" value={form.temp_at_delivery} onChange={handleChange} />
          <Input name="expiry_date" type="date" label="Data ważności" value={form.expiry_date} onChange={handleChange} />
        </div>

        <div className="space-y-2">
          <label className="label">Jakość dostawy</label>
          <div className="flex gap-3">
            <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${form.quality_ok ? 'border-brand-green bg-green-50 text-green-700' : 'border-gray-200'}`}>
              <input type="radio" name="quality_ok" className="sr-only" checked={form.quality_ok} onChange={() => setForm((p) => ({ ...p, quality_ok: true }))} />
              Jakość OK
            </label>
            <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${!form.quality_ok ? 'border-red-400 bg-red-50 text-red-700' : 'border-gray-200'}`}>
              <input type="radio" name="quality_ok" className="sr-only" checked={!form.quality_ok} onChange={() => setForm((p) => ({ ...p, quality_ok: false }))} />
              Niezgodna
            </label>
          </div>
        </div>

        <div>
          <label className="label">Zdjęcie etykiety / faktury</label>
          <label className="flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-200 rounded-lg cursor-pointer hover:border-brand-green transition-colors">
            <Camera size={20} className="text-gray-400" />
            <span className="text-sm text-gray-500">
              {photo ? photo.name : 'Dodaj zdjęcie (opcjonalnie)'}
            </span>
            <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
          </label>
        </div>

        <div>
          <label className="label">Uwagi</label>
          <textarea
            name="notes"
            rows={2}
            placeholder="Dodatkowe informacje..."
            value={form.notes}
            onChange={handleChange}
            className="input resize-none"
          />
        </div>

        <div className="flex gap-3">
          <Button type="submit" loading={loading} className="flex-1">
            Zapisz dostawę
          </Button>
          <Button type="button" variant="secondary" onClick={() => router.back()}>
            Anuluj
          </Button>
        </div>
      </form>
    </div>
  )
}
