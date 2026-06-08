'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, KeyRound, AlertCircle } from 'lucide-react'
import { AuthCard } from '@/components/auth/auth-card'

function SetPasswordContent() {
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [hashError, setHashError] = useState<string | null>(null)
  const [isRecovery, setIsRecovery] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    async function init() {
      const hash = window.location.hash

      if (hash.includes('error=')) {
        const params = new URLSearchParams(hash.replace('#', ''))
        const code = params.get('error_code')
        setHashError(
          code === 'otp_expired'
            ? 'Link wygasł. Poproś właściciela o nowe zaproszenie lub skorzystaj z "Nie pamiętasz hasła?" na stronie logowania.'
            : 'Link jest nieprawidłowy lub wygasł.'
        )
        setChecking(false)
        return
      }

      if (hash.includes('access_token=')) {
        const params = new URLSearchParams(hash.replace('#', ''))
        const access_token = params.get('access_token') ?? ''
        const refresh_token = params.get('refresh_token') ?? ''
        const type = params.get('type')

        if (type === 'recovery') setIsRecovery(true)

        const { data, error } = await supabase.auth.setSession({ access_token, refresh_token })
        if (error || !data.session) {
          setHashError('Link wygasł lub jest nieprawidłowy. Spróbuj ponownie.')
        }
        setChecking(false)
        return
      }

      const token_hash = searchParams.get('token_hash')
      const type = searchParams.get('type') as 'recovery' | 'invite' | 'signup' | null

      if (token_hash && type) {
        if (type === 'recovery') setIsRecovery(true)
        const { error } = await supabase.auth.verifyOtp({ token_hash, type })
        if (error) {
          setHashError('Link wygasł lub jest nieprawidłowy. Spróbuj ponownie.')
        }
        setChecking(false)
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setChecking(false)
      } else {
        router.replace('/login')
      }
    }

    init()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isRecovery && !name.trim()) { toast.error('Podaj imię i nazwisko'); return }
    if (password.length < 8) { toast.error('Hasło musi mieć minimum 8 znaków'); return }
    if (password !== confirm) { toast.error('Hasła nie są identyczne'); return }

    setLoading(true)
    const { data: { user }, error: authErr } = await supabase.auth.updateUser({ password })
    if (authErr) { toast.error('Błąd: ' + authErr.message); setLoading(false); return }

    if (user && name.trim()) {
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ full_name: name.trim() })
        .eq('id', user.id)
      if (profileErr) {
        toast.error('Błąd zapisu imienia: ' + profileErr.message)
        setLoading(false)
        return
      }
    }

    toast.success(isRecovery ? 'Hasło zostało zmienione!' : 'Witaj w HACCPro!')
    router.push('/dashboard')
  }

  if (checking) {
    return (
      <AuthCard
        icon={<Loader2 size={16} className="text-brand-green animate-spin" />}
        title="Weryfikowanie linku…"
        subtitle="To zajmie tylko chwilę"
      >
        <div className="flex flex-col items-center py-6 gap-3">
          <Loader2 size={24} className="animate-spin text-gray-400" />
          <p className="text-sm text-gray-500">Łączenie z kontem…</p>
        </div>
      </AuthCard>
    )
  }

  if (hashError) {
    return (
      <AuthCard
        icon={<AlertCircle size={16} className="text-red-400" />}
        title="Link wygasł"
        subtitle={hashError}
      >
        <button
          onClick={() => router.push('/login')}
          className="w-full py-3 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Wróć do logowania
        </button>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      icon={<KeyRound size={16} className="text-brand-green" />}
      title={isRecovery ? 'Ustaw nowe hasło' : 'Witaj w HACCPro!'}
      subtitle={isRecovery
        ? 'Wpisz nowe hasło do swojego konta.'
        : 'Zaproszenie przyjęte. Ustaw hasło, aby logować się ponownie.'}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {!isRecovery && (
          <div>
            <label className="label">Imię i nazwisko</label>
            <input
              className="input"
              placeholder="Jan Kowalski"
              value={name}
              onChange={e => setName(e.target.value)}
              autoComplete="name"
            />
          </div>
        )}

        <div>
          <label className="label">Nowe hasło</label>
          <input
            className="input"
            type="password"
            placeholder="Minimum 8 znaków"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="new-password"
            required
            minLength={8}
          />
        </div>

        <div>
          <label className="label">Potwierdź hasło</label>
          <input
            className="input"
            type="password"
            placeholder="Powtórz hasło"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-brand-green hover:bg-green-700 text-white font-semibold text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          {loading ? 'Zapisywanie…' : isRecovery ? 'Zmień hasło' : 'Ustaw hasło i wejdź do aplikacji'}
        </button>
      </form>
    </AuthCard>
  )
}

export default function SetPasswordPage() {
  return (
    <Suspense>
      <SetPasswordContent />
    </Suspense>
  )
}
