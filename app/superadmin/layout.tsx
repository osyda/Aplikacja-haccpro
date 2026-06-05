import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ToastProvider } from '@/components/ui/toast-provider'
import Link from 'next/link'
import { LayoutDashboard, LogOut } from 'lucide-react'

const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL ?? 'osyda@icloud.com'

export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.email !== SUPERADMIN_EMAIL) {
    redirect('/dashboard')
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
