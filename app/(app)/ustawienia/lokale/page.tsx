'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ChevronLeft, MapPin, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { isOwnerRole } from '@/lib/permissions'
import type { Location } from '@/types/database'

const LOCATION_TYPES = ['Restauracja', 'Bar', 'Kawiarnia', 'Pizzeria', 'Fast-food', 'Stołówka', 'Catering', 'Sklep spożywczy', 'Inny']

export default function LocalePage() {
  const [locations, setLocations] = useState<Location[]>([])
  const [form, setForm] = useState({ name: '', address: '', city: '', type: '' })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [isOwner, setIsOwner] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function fetchLocations() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('org_id, role').eq('id', user!.id).single()
    if (!isOwnerRole(profile?.role)) {
      router.replace('/ustawienia')
      return
    }
    setIsOwner(true)
    const { data } = await supabase.from('locations').select('*').eq('org_id', profile?.org_id ?? '')
    setLocations(data ?? [])
  }

  useEffect(() => { fetchLocations() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.type) { toast.error('Wybierz typ lokalu'); return }
    setLoading(true)

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) { toast.error('Błąd autoryzacji'); setLoading(false); return }

    const { data: profile, error: profileError } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()
    if (profileError || !profile?.org_id) { toast.error('Błąd profilu: ' + (profileError?.message ?? 'brak org_id')); setLoading(false); return }

    const { error } = await supabase.from('locations').insert({
      org_id: profile.org_id,
      name: form.name,
      address: form.address,
      city: form.city,
      type: form.type,
    }).select().single()

    if (error) {
      toast.error('Błąd zapisu lokalu: ' + error.message)
      setLoading(false)
      return
    }

    setLoading(false)
    setSuccess(true)
    toast.success('Lokal zapisany! Możesz go wybrać w nagłówku aplikacji.')
    setForm({ name: '', address: '', city: '', type: '' })
    fetchLocations()
    setTimeout(() => { setSuccess(false); setShowForm(false) }, 2000)
  }

  if (!isOwner) return null

  return (
    <div className="max-w-lg space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/ustawienia" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ChevronLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lokale</h1>
          <p className="text-sm text-gray-500 mt-0.5">Zarządzaj swoimi punktami gastronomicznymi</p>
        </div>
      </div>

      {locations.length > 0 && (
        <div className="card divide-y divide-gray-50">
          {locations.map((loc) => (
            <div key={loc.id} className="py-3 flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <MapPin size={16} className="text-brand-green" />
              </div>
              <div>
                <p className="font-medium text-sm text-gray-900">{loc.name}</p>
                <p className="text-xs text-gray-500">{loc.address}, {loc.city} • {loc.type}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {!showForm ? (
        <Button onClick={() => setShowForm(true)} variant="secondary" className="w-full">
          <Plus size={16} />
          Dodaj lokal
        </Button>
      ) : (
        <form onSubmit={handleSubmit} className="card space-y-4">
          <h2 className="font-semibold text-gray-900">Nowy lokal</h2>

          <Input label="Nazwa lokalu" placeholder="np. Pizzeria Mario" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />

          <div>
            <p className="label">Typ lokalu</p>
            <div className="flex flex-wrap gap-2">
              {LOCATION_TYPES.map((t) => (
                <button key={t} type="button" onClick={() => setForm((p) => ({ ...p, type: t }))}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${form.type === t ? 'border-brand-green bg-green-50 text-brand-green font-medium' : 'border-gray-200 hover:border-gray-300'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <Input label="Adres" placeholder="ul. Główna 1" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} required />
          <Input label="Miasto" placeholder="Warszawa" value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} required />

          <div className="flex gap-3">
            <Button type="submit" loading={loading} className={`flex-1 ${success ? 'bg-green-600' : ''}`}>
              {success ? 'Zapisano!' : 'Zapisz lokal'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
              Anuluj
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
