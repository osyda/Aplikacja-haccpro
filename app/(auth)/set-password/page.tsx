'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, KeyRound } from 'lucide-react'

export default function SetPasswordPage() {
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace('/login')
      } else {
        setChecking(false)
      }
    })
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
      <div className="flex justify-center py-8">
        <Loader2 size={24} className="animate-spin text-gray-400" />
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
