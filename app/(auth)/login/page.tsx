'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { AuthCard } from '@/components/auth/auth-card'
import { toast } from 'sonner'
import { CheckCircle2, LogIn, KeyRound } from 'lucide-react'

function LoginContent() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetMode, setResetMode] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    if (searchParams.get('error') === 'link_expired') {
      setError('Link wygasł lub jest nieprawidłowy. Skorzystaj z opcji "Nie pamiętasz hasła?" aby wysłać nowy.')
    }
    if (searchParams.get('confirmed') === '1') {
      setConfirmed(true)
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      if (error.message.toLowerCase().includes('email not confirmed') || error.code === 'email_not_confirmed') {
        setError('Twoje konto nie zostało jeszcze aktywowane. Sprawdź skrzynkę email i kliknij link aktywacyjny.')
      } else {
        setError('Nieprawidłowy email lub hasło')
      }
      setLoading(false)
      return
    }
    const next = searchParams.get('next')
    router.push(next && next.startsWith('/') ? next : '/')
    router.refresh()
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://app.haccpro.pl'
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}/auth/confirm`,
    })
    setLoading(false)
    if (error) { toast.error('Błąd: ' + error.message); return }
    setResetSent(true)
  }

  if (resetMode) {
    return (
      <AuthCard
        icon={<KeyRound size={16} className="text-brand-green" />}
        title="Resetuj hasło"
        subtitle="Wyślemy link do ustawienia nowego hasła"
      >
        <button onClick={() => { setResetMode(false); setResetSent(false) }}
          className="text-xs text-gray-400 hover:text-gray-600 mb-4 flex items-center gap-1">
          ← Wróć do logowania
        </button>
        {resetSent ? (
          <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">
            Gotowe! Sprawdź skrzynkę <strong>{email}</strong> i kliknij link w emailu.
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <Input id="reset-email" type="email" label="Email" placeholder="jan@restauracja.pl"
              value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            <Button type="submit" loading={loading} className="w-full" size="lg">
              Wyślij link resetujący
            </Button>
          </form>
        )}
      </AuthCard>
    )
  }

  return (
    <AuthCard
      icon={<LogIn size={16} className="text-brand-green" />}
      title="Witaj ponownie"
      subtitle="Zaloguj się, aby zarządzać rejestrami HACCP"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {confirmed && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-3 py-3">
            <CheckCircle2 size={16} className="shrink-0" />
            <span>Konto zostało aktywowane! Możesz się teraz zalogować.</span>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <Input id="email" type="email" label="Email" placeholder="jan@restauracja.pl"
          value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        <Input id="password" type="password" label="Hasło" placeholder="••••••••"
          value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />

        <div className="flex justify-end -mt-2">
          <button type="button" onClick={() => setResetMode(true)}
            className="text-xs text-gray-400 hover:text-brand-green transition-colors">
            Nie pamiętasz hasła?
          </button>
        </div>

        <Button type="submit" loading={loading} className="w-full" size="lg">Zaloguj się</Button>

        <p className="text-center text-sm text-gray-500">
          Nie masz konta?{' '}
          <Link href="/register" className="text-brand-green font-medium hover:underline">Zarejestruj się</Link>
        </p>
      </form>
    </AuthCard>
  )
}

export default function LoginPage() {
  return <Suspense><LoginContent /></Suspense>
}
