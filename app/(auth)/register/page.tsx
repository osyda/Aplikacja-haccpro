'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { AuthCard } from '@/components/auth/auth-card'
import { Mail, UserPlus } from 'lucide-react'

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', orgName: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
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
        <Input
          id="orgName" name="orgName" type="text"
          label="Nazwa firmy / lokalu" placeholder="Restauracja Mario"
          value={form.orgName} onChange={handleChange} required
        />
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
