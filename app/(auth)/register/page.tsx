'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { AuthCard } from '@/components/auth/auth-card'
import { FormSection } from '@/components/ui/form-section'
import { buildAddressLine } from '@/lib/utils'
import { Mail, UserPlus } from 'lucide-react'

const initialForm = {
  name: '', email: '', password: '', confirmPassword: '', orgName: '',
  nip: '',
  addressStreet: '', addressBuildingNo: '', addressUnitNo: '', addressPostalCode: '', addressCity: '',
  locationName: '',
  locationDifferentAddress: false,
  locationStreet: '', locationBuildingNo: '', locationUnitNo: '', locationPostalCode: '', locationCity: '',
}

export default function RegisterPage() {
  const [form, setForm] = useState(initialForm)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value, type, checked } = e.target
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (form.password !== form.confirmPassword) {
      setError('Hasła nie są identyczne')
      return
    }
    if (form.password.length < 8) {
      setError('Hasło musi mieć minimum 8 znaków')
      return
    }
    const nip = form.nip.replace(/\D/g, '')
    if (nip.length !== 10) {
      setError('NIP musi składać się z 10 cyfr')
      return
    }

    const locationAddress = form.locationDifferentAddress
      ? buildAddressLine(form.locationStreet, form.locationBuildingNo, form.locationUnitNo)
      : buildAddressLine(form.addressStreet, form.addressBuildingNo, form.addressUnitNo)
    const locationCity = form.locationDifferentAddress ? form.locationCity : form.addressCity
    const locationPostalCode = form.locationDifferentAddress ? form.locationPostalCode : form.addressPostalCode

    setLoading(true)
    const supabase = createClient()
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://app.haccpro.pl'
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: `${siteUrl}/auth/confirm?type=signup`,
        data: {
          full_name: form.name,
          org_name: form.orgName,
          nip,
          address_street: form.addressStreet.trim(),
          address_building_no: form.addressBuildingNo.trim(),
          address_unit_no: form.addressUnitNo.trim(),
          address_postal_code: form.addressPostalCode.trim(),
          address_city: form.addressCity.trim(),
          location_name: form.locationName.trim(),
          location_address: locationAddress,
          location_city: locationCity.trim(),
          location_postal_code: locationPostalCode.trim(),
        },
      },
    })

    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    setSent(true)
  }

  if (sent) {
    return (
      <AuthCard
        icon={<Mail size={16} className="text-brand-green" />}
        title="Sprawdź skrzynkę email"
        subtitle={`Link aktywacyjny wysłaliśmy na ${form.email}`}
      >
        <div className="space-y-5 text-center">
          <p className="text-sm text-gray-500">
            Kliknij link w emailu, aby aktywować konto i zacząć korzystać z HACCPro.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700 text-left">
            Nie widzisz emaila? Sprawdź folder <strong>SPAM</strong> lub poczekaj kilka minut.
          </div>
          <p className="text-sm text-gray-500">
            <Link href="/login" className="text-brand-green font-medium hover:underline">
              Wróć do logowania
            </Link>
          </p>
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      icon={<UserPlus size={16} className="text-brand-green" />}
      title="Utwórz konto"
      subtitle="14 dni za darmo, bez karty"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <Input
          id="name" name="name" type="text"
          label="Imię i nazwisko" placeholder="Jan Kowalski"
          value={form.name} onChange={handleChange} required
        />

        <FormSection title="Dane firmy">
          <Input
            id="orgName" name="orgName" type="text"
            label="Nazwa firmy" placeholder="Restauracja Mario Sp. z o.o."
            value={form.orgName} onChange={handleChange} required
          />
          <Input
            id="nip" name="nip" type="text" inputMode="numeric"
            label="NIP" placeholder="np. 1234567890"
            value={form.nip} onChange={handleChange} required
          />
        </FormSection>

        <FormSection title="Adres siedziby">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Input
                id="addressStreet" name="addressStreet" type="text"
                label="Ulica" placeholder="Marszałkowska"
                value={form.addressStreet} onChange={handleChange} required
              />
            </div>
            <Input
              id="addressBuildingNo" name="addressBuildingNo" type="text"
              label="Nr domu" placeholder="10"
              value={form.addressBuildingNo} onChange={handleChange} required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              id="addressUnitNo" name="addressUnitNo" type="text"
              label="Nr lokalu" placeholder="opcjonalnie"
              value={form.addressUnitNo} onChange={handleChange}
            />
            <Input
              id="addressPostalCode" name="addressPostalCode" type="text"
              label="Kod pocztowy" placeholder="00-000"
              value={form.addressPostalCode} onChange={handleChange} required
            />
          </div>
          <Input
            id="addressCity" name="addressCity" type="text"
            label="Miejscowość" placeholder="Warszawa"
            value={form.addressCity} onChange={handleChange} required
          />
        </FormSection>

        <FormSection title="Lokalizacja">
          <Input
            id="locationName" name="locationName" type="text"
            label="Nazwa lokalizacji" placeholder="np. Restauracja Mario — Centrum"
            value={form.locationName} onChange={handleChange} required
          />
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox" name="locationDifferentAddress"
              checked={form.locationDifferentAddress} onChange={handleChange}
              className="rounded border-gray-300 text-brand-green focus:ring-brand-green"
            />
            Adres lokalizacji jest inny niż adres siedziby firmy
          </label>

          {form.locationDifferentAddress && (
            <div className="space-y-4 pt-1">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Input
                    id="locationStreet" name="locationStreet" type="text"
                    label="Ulica" placeholder="Marszałkowska"
                    value={form.locationStreet} onChange={handleChange} required
                  />
                </div>
                <Input
                  id="locationBuildingNo" name="locationBuildingNo" type="text"
                  label="Nr domu" placeholder="10"
                  value={form.locationBuildingNo} onChange={handleChange} required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  id="locationUnitNo" name="locationUnitNo" type="text"
                  label="Nr lokalu" placeholder="opcjonalnie"
                  value={form.locationUnitNo} onChange={handleChange}
                />
                <Input
                  id="locationPostalCode" name="locationPostalCode" type="text"
                  label="Kod pocztowy" placeholder="00-000"
                  value={form.locationPostalCode} onChange={handleChange} required
                />
              </div>
              <Input
                id="locationCity" name="locationCity" type="text"
                label="Miejscowość" placeholder="Warszawa"
                value={form.locationCity} onChange={handleChange} required
              />
            </div>
          )}
        </FormSection>

        <Input
          id="email" name="email" type="email"
          label="Email" placeholder="jan@restauracja.pl"
          value={form.email} onChange={handleChange} required autoComplete="email"
        />
        <Input
          id="password" name="password" type="password"
          label="Hasło" placeholder="Minimum 8 znaków"
          value={form.password} onChange={handleChange} required minLength={8} autoComplete="new-password"
        />
        <Input
          id="confirmPassword" name="confirmPassword" type="password"
          label="Powtórz hasło" placeholder="Wpisz hasło ponownie"
          value={form.confirmPassword} onChange={handleChange} required autoComplete="new-password"
        />

        <Button type="submit" loading={loading} className="w-full" size="lg">
          Rozpocznij 14-dniowy trial
        </Button>

        <p className="text-center text-xs text-gray-400">
          Rejestrując się, akceptujesz{' '}
          <Link href="/regulamin" target="_blank" className="underline hover:text-gray-600">regulamin</Link>
          {' '}i{' '}
          <Link href="/polityka-prywatnosci" target="_blank" className="underline hover:text-gray-600">politykę prywatności</Link>
        </p>

        <p className="text-center text-sm text-gray-500">
          Masz już konto?{' '}
          <Link href="/login" className="text-brand-green font-medium hover:underline">
            Zaloguj się
          </Link>
        </p>
      </form>
    </AuthCard>
  )
}
