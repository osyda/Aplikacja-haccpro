'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, AlertTriangle } from 'lucide-react'

function ConfirmContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [warning, setWarning] = useState<{ currentEmail: string; type: string } | null>(null)
  const [proceeding, setProceeding] = useState(false)

  useEffect(() => {
    async function verify() {
      const hash = window.location.hash

      if (hash.includes('error=')) {
        router.replace('/login?error=link_expired')
        return
      }

      const type = hash.includes('access_token=')
        ? new URLSearchParams(hash.replace('#', '')).get('type')
        : searchParams.get('type')

      if (type === 'invite') {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setWarning({ currentEmail: user.email ?? '', type: 'invite' })
          return
        }
      }

      await doVerify()
    }

    verify()
  }, [])

  async function doVerify() {
    setProceeding(true)
    const hash = window.location.hash

    if (hash.includes('access_token=')) {
      const params = new URLSearchParams(hash.replace('#', ''))
      const access_token = params.get('access_token') ?? ''
      const refresh_token = params.get('refresh_token') ?? ''
      const type = params.get('type')

      const { error } = await supabase.auth.setSession({ access_token, refresh_token })
      if (error) { router.replace('/login?error=link_expired'); return }
      if (type === 'recovery' || type === 'invite') {
        router.replace('/set-password')
      } else if (type === 'signup') {
        router.replace('/login?confirmed=1')
      } else {
        router.replace('/dashboard')
      }
      return
    }

    const token_hash = searchParams.get('token_hash')
    const type = searchParams.get('type') as 'recovery' | 'invite' | 'signup' | 'email' | null
    const next = searchParams.get('next') ?? '/dashboard'

    if (token_hash && type) {
      const { error } = await supabase.auth.verifyOtp({ token_hash, type })
      if (error) { router.replace('/login?error=link_expired'); return }
      if (type === 'recovery' || type === 'invite') {
        router.replace('/set-password')
      } else if (type === 'signup') {
        router.replace('/login?confirmed=1')
      } else {
        router.replace(next)
      }
      return
    }

    router.replace('/login')
  }

  if (warning) {
    return (
      <div className="min-h-screen bg-brand-navy flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md space-y-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-100 flex items-center justify-center shrink-0">
              <AlertTriangle size={20} className="text-yellow-600" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">Jesteś już zalogowany/a</h2>
              <p className="text-sm text-gray-500 mt-1">
                Ten link to zaproszenie dla nowego pracownika, ale jesteś zalogowany/a jako{' '}
                <strong>{warning.currentEmail}</strong>.
              </p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
            <strong>Jeśli jesteś właścicielem:</strong> Wyślij ten link pracownikowi — powinien otworzyć go
            w przeglądarce gdzie nie jest zalogowany (np. tryb incognito).
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={() => router.push('/dashboard')}
              className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold text-sm transition-colors"
            >
              Wróć do aplikacji
            </button>
            <button
              onClick={async () => {
                await supabase.auth.signOut()
                await doVerify()
              }}
              disabled={proceeding}
              className="w-full py-3 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {proceeding && <Loader2 size={14} className="animate-spin" />}
              Wyloguj mnie i kontynuuj jako nowy pracownik
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-3">
        <Loader2 size={28} className="animate-spin text-gray-400" />
        <p className="text-sm text-gray-500">Weryfikowanie…</p>
      </div>
    </div>
  )
}

export default function ConfirmPage() {
  return (
    <Suspense>
      <ConfirmContent />
    </Suspense>
  )
}
