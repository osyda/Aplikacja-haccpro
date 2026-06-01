import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'
import { BottomNav } from '@/components/layout/bottom-nav'
import { ToastProvider } from '@/components/ui/toast-provider'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, locations(name)')
    .eq('id', user.id)
    .single()

  const locationName = (profile?.locations as { name: string } | null)?.name ?? 'Mój lokal'

  return (
    <div className="min-h-screen bg-gray-50">
      <ToastProvider />
      {/* Desktop sidebar */}
      <Sidebar />
      {/* Topbar — mobile full width, desktop offset */}
      <Topbar locationName={locationName} userEmail={user.email} />
      <main className="lg:ml-64 pt-14 pb-16 lg:pb-0 min-h-screen">
        <div className="p-4 md:p-6 max-w-5xl">
          {children}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
