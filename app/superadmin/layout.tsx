import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ToastProvider } from '@/components/ui/toast-provider'
import Link from 'next/link'
import { LayoutDashboard } from 'lucide-react'

export const dynamic = 'force-dynamic'

// Allowed superadmin emails (comma-separated in env var, or hardcoded fallback)
const SUPERADMIN_EMAILS = (process.env.SUPERADMIN_EMAIL ?? 'osyda@icloud.com')
  .split(',')
  .map(e => e.toLowerCase().trim())
  .filter(Boolean)

function isSuperadmin(email: string | undefined | null): boolean {
  if (!email) return false
  return SUPERADMIN_EMAILS.includes(email.toLowerCase().trim())
}

export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  if (!isSuperadmin(user.email)) {
    // Show a helpful error instead of silently redirecting
    return (
      <div className="min-h-screen bg-[#1B2E4B] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center space-y-4">
          <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mx-auto">
            <span className="text-2xl">🔒</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Brak dostępu</h1>
          <p className="text-sm text-gray-500">
            Zalogowany jako: <strong className="text-gray-800">{user.email}</strong>
          </p>
          <p className="text-xs text-gray-400">
            Panel właściciela jest dostępny tylko dla: <strong>{SUPERADMIN_EMAILS.join(', ')}</strong>
          </p>
          <Link
            href="/dashboard"
            className="block py-2.5 px-4 bg-[#1B2E4B] text-white rounded-xl text-sm font-semibold hover:bg-[#243d63] transition-colors"
          >
            Wróć do aplikacji
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <ToastProvider />
      <header className="bg-[#1B2E4B] text-white px-6 py-3 flex items-center gap-3 sticky top-0 z-30 shadow-lg">
        <div className="w-8 h-8 bg-[#22C55E] rounded-lg flex items-center justify-center font-bold text-sm shrink-0">H</div>
        <span className="font-bold text-base">HACCPro</span>
        <span className="text-white/30 mx-1">·</span>
        <span className="text-sm font-medium text-white/70">Panel właściciela</span>
        <div className="ml-auto flex items-center gap-4">
          <span className="text-xs text-white/50 hidden sm:block">{user.email}</span>
          <Link href="/dashboard" className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white transition-colors">
            <LayoutDashboard size={14} />
            Aplikacja
          </Link>
        </div>
      </header>
      <main className="p-4 md:p-6 max-w-screen-xl mx-auto">
        {children}
      </main>
    </div>
  )
}
