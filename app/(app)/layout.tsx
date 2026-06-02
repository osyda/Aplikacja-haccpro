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
    .select('location_id, org_id, locations(name)')
    .eq('id', user.id)
    .single()

  const locRaw = profile?.locations
  const locationName = (locRaw && !Array.isArray(locRaw) ? (locRaw as { name: string }) : null)?.name ?? 'Mój lokal'
  const currentLocationId = profile?.location_id ?? ''

  // Fetch all locations for this org so topbar can show switcher
  const { data: allLocations } = await supabase
    .from('locations')
    .select('id, name')
    .eq('org_id', profile?.org_id ?? '')
    .order('name')

  return (
    <div className="min-h-screen bg-gray-50">
      <ToastProvider />
      <Sidebar />
      <Topbar
        locationName={locationName}
        userEmail={user.email}
        locations={allLocations ?? []}
        currentLocationId={currentLocationId}
      />
      <main className="lg:ml-64 pt-14 pb-16 lg:pb-0 min-h-screen">
        <div className="p-4 md:p-6 max-w-5xl">
          {children}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
