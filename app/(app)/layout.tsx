import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'

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
      <Sidebar />
      <Topbar locationName={locationName} userEmail={user.email} />
      <main className="ml-64 pt-14 min-h-screen">
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  )
}
