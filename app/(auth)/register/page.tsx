'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '', orgName: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.name,
          org_name: form.orgName,
        },
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Utwórz konto</h2>
        <p className="text-sm text-gray-500 mt-0.5">14 dni za darmo, bez karty</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <Input
        id="name"
        name="name"
        type="text"
        label="Imię i nazwisko"
        placeholder="Jan Kowalski"
        value={form.name}
        onChange={handleChange}
        required
      />

      <Input
        id="orgName"
        name="orgName"
        type="text"
        label="Nazwa firmy / lokalu"
        placeholder="Restauracja Mario"
        value={form.orgName}
        onChange={handleChange}
        required
      />

      <Input
        id="email"
        name="email"
        type="email"
        label="Email"
        placeholder="jan@restauracja.pl"
        value={form.email}
        onChange={handleChange}
        required
        autoComplete="email"
      />

      <Input
        id="password"
        name="password"
        type="password"
        label="Hasło"
        placeholder="Minimum 8 znaków"
        value={form.password}
        onChange={handleChange}
        required
        minLength={8}
        autoComplete="new-password"
      />

      <Button type="submit" loading={loading} className="w-full" size="lg">
        Rozpocznij 14-dniowy trial
      </Button>

      <p className="text-center text-xs text-gray-400">
        Rejestrując się, akceptujesz regulamin i politykę prywatności
      </p>

      <p className="text-center text-sm text-gray-500">
        Masz już konto?{' '}
        <Link href="/login" className="text-brand-green font-medium hover:underline">
          Zaloguj się
        </Link>
      </p>
    </form>
  )
}
