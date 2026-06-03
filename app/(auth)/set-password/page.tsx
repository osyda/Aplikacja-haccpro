'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, KeyRound, AlertCircle } from 'lucide-react'

export default function SetPasswordPage() {
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [hashError, setHashError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Detect error in URL hash (Supabase implicit flow error)
    const hash = typeof window !== 'undefined' ? window.location.hash : ''
    if (hash.includes('error=')) {
      const params = new URLSearchParams(hash.replace('#', ''))
      const code = params.get('error_code')
      setHashError(
        code === 'otp_expired'
          ? 'Link zaproszenia wygasł. Poproś właściciela o wysłanie nowego zaproszenia.'
          : 'Link jest nieprawidłowy. Poproś właściciela o wysłanie nowego zaproszenia.'
      )
      setChecking(false)
      return
    }

    // Wait for session — could come from hash (implicit flow) or existing cookie
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setChecking(false)
      }
    })

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setChecking(false)
      } else if (!hash.includes('access_token')) {
        // No hash token and no session — not a valid invite flow
        router.replace('/login')
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { toast.error('Podaj imię i nazwisko'); return }
    if (password.length < 8) { toast.error('Hasło musi mieć minimum 8 znaków'); return }
    if (password !== confirm) { toast.error('Hasła nie są identyczne'); return }

    setLoading(true)
    const { data: { user }, error: authErr } = await supabase.auth.updateUser({ password })
    if (authErr) { toast.error('Błąd: ' + authErr.message); setLoading(false); return }

    if (user) {
      await supabase.from('profiles').update({ full_name: name.trim() }).eq('id', user.id)
    }

    toast.success('Hasło ustawione — witaj w HACCPro!')
    router.push('/dashboard')
  }

  if (checking) {
    return (
      <div className="flex flex-col items-center py-8 gap-3">
        <Loader2 size={24} className="animate-spin text-gray-400" />
        <p className="text-sm text-gray-500">Weryfikowanie zaproszenia…</p>
      </div>
    )
  }

  if (hashError) {
    return (
      <div className="space-y-5 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-red-100 rounded-xl mx-auto">
          <AlertCircle size={22} className="text-red-500" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">Link wygasł</h2>
          <p className="text-sm text-gray-500 mt-1">{hashError}</p>
        </div>
        <button
          onClick={() => router.push('/login')}
          className="w-full py-3 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Wróć do logowania
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-xl mb-3">
          <KeyRound size={22} className="text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Witaj w HACCPro!</h2>
        <p className="text-sm text-gray-500 mt-1">
          Zaproszenie przyjęte. Ustaw hasło, aby móc logować się ponownie.
        </p>
      </div>

      <div>
        <label className="label">Imię i nazwisko</label>
        <input
          className="input"
          placeholder="Jan Kowalski"
          value={name}
          onChange={e => setName(e.target.value)}
          autoComplete="name"
          required
        />
      </div>

      <div>
        <label className="label">Hasło</label>
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
        {loading ? 'Zapisywanie…' : 'Ustaw hasło i wejdź do aplikacji'}
      </button>
    </form>
  )
}
