'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { User, Phone } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export function ProfileForm({
  userId,
  initialFullName,
  initialPhone,
}: {
  userId: string
  initialFullName: string
  initialPhone: string
}) {
  const [fullName, setFullName] = useState(initialFullName)
  const [phone, setPhone] = useState(initialPhone)
  const [baseline, setBaseline] = useState({ fullName: initialFullName, phone: initialPhone })
  const [saving, setSaving] = useState(false)

  const dirty = fullName.trim() !== baseline.fullName || phone.trim() !== baseline.phone

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!fullName.trim()) {
      toast.error('Podaj imię i nazwisko')
      return
    }
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim(), phone: phone.trim() })
      .eq('id', userId)
    setSaving(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Dane zapisane')
    setBaseline({ fullName: fullName.trim(), phone: phone.trim() })
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <div>
        <p className="text-sm font-medium text-gray-900">Twoje dane</p>
        <p className="text-xs text-gray-500 mt-0.5">Imię, nazwisko i numer telefonu kontaktowego</p>
      </div>

      <div>
        <label htmlFor="full_name" className="label text-xs">Imię i nazwisko</label>
        <div className="relative">
          <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            id="full_name"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Jan Kowalski"
            className="input pl-9"
            required
          />
        </div>
      </div>

      <div>
        <label htmlFor="phone" className="label text-xs">Numer telefonu</label>
        <div className="relative">
          <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="np. 600 100 200"
            className="input pl-9"
            autoComplete="tel"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={saving || !dirty}
        className="btn-primary w-full disabled:opacity-50"
      >
        {saving ? 'Zapisuję…' : 'Zapisz zmiany'}
      </button>
    </form>
  )
}
