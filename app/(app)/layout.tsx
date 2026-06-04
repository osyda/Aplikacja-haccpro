import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'
import { BottomNav } from '@/components/layout/bottom-nav'
import { ToastProvider } from '@/components/ui/toast-provider'
import { resolvePermissions } from '@/lib/permissions'
import type { AppPermissions } from '@/lib/permissions'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('location_id, org_id, role, permissions, locations(name)')
    .eq('id', user.id)
    .single()

  const locRaw = profile?.locations
  const locationName = (locRaw && !Array.isArray(locRaw) ? (locRaw as { name: string }) : null)?.name ?? 'Mój lokal'
  const currentLocationId = profile?.location_id ?? ''

  const permissions = resolvePermissions(
    profile?.role,
    profile?.permissions as Partial<AppPermissions> | null,
  )

  const [{ data: allLocations }, { count: openNonconformities }] = await Promise.all([
    supabase.from('locations').select('id, name').eq('org_id', profile?.org_id ?? '').order('name'),
    supabase.from('nonconformities').select('id', { count: 'exact', head: true }).eq('location_id', currentLocationId).eq('status', 'open'),
  ])

  // Staff can only see their own location — only owners/managers can switch
  const isOwnerOrManager = profile?.role === 'owner' || profile?.role === 'manager'
  const visibleLocations = isOwnerOrManager
    ? (allLocations ?? [])
    : (allLocations ?? []).filter(loc => loc.id === currentLocationId)

  return (
    <div className="min-h-screen bg-gray-50">
      <ToastProvider />
      <Sidebar permissions={permissions} openNonconformities={openNonconformities ?? 0} />
      <Topbar
        locationName={locationName}
        userEmail={user.email}
        locations={visibleLocations}
        currentLocationId={currentLocationId}
      />
      <main className="lg:ml-64 pt-14 pb-16 lg:pb-0 min-h-screen">
        <div className="p-4 md:p-6 max-w-5xl">
          {children}
        </div>
      </main>
      <BottomNav permissions={permissions} />
    </div>
  )
}
