'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'

export default function ConfirmPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    async function verify() {
      const hash = window.location.hash

      // Error from Supabase in hash (e.g. expired link)
      if (hash.includes('error=')) {
        router.replace('/login?error=link_expired')
        return
      }

      // Implicit flow: access_token in hash fragment
      if (hash.includes('access_token=')) {
        const params = new URLSearchParams(hash.replace('#', ''))
        const access_token = params.get('access_token') ?? ''
        const refresh_token = params.get('refresh_token') ?? ''
        const type = params.get('type')

        const { error } = await supabase.auth.setSession({ access_token, refresh_token })
        if (error) {
          router.replace('/login?error=link_expired')
          return
        }
        if (type === 'recovery' || type === 'invite' || type === 'signup') {
          router.replace('/set-password')
        } else {
          router.replace('/dashboard')
        }
        return
      }

      // PKCE flow: token_hash in URL params
      const token_hash = searchParams.get('token_hash')
      const type = searchParams.get('type') as 'recovery' | 'invite' | 'signup' | 'email' | null
      const next = searchParams.get('next') ?? '/dashboard'

      if (token_hash && type) {
        const { error } = await supabase.auth.verifyOtp({ token_hash, type })
        if (error) {
          router.replace('/login?error=link_expired')
          return
        }
        if (type === 'recovery' || type === 'invite' || type === 'signup') {
          router.replace('/set-password')
        } else {
          router.replace(next)
        }
        return
      }

      // No recognizable auth params
      router.replace('/login')
    }

    verify()
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-3">
        <Loader2 size={28} className="animate-spin text-gray-400" />
        <p className="text-sm text-gray-500">Weryfikowanie…</p>
      </div>
    </div>
  )
}
