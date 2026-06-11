import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'
import { BottomNav } from '@/components/layout/bottom-nav'
import { MobileNavProvider } from '@/components/layout/mobile-nav-context'
import { ToastProvider } from '@/components/ui/toast-provider'
import { ServiceWorkerRegister } from '@/components/pwa/sw-register'
import { InstallPrompt } from '@/components/pwa/install-prompt'
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

  // Check if org is active; fails silently if column not yet added via migration
  const { data: orgStatus } = await supabase
    .from('organizations')
    .select('is_active')
    .eq('id', profile?.org_id ?? '')
    .maybeSingle()
  if (orgStatus && (orgStatus as { is_active?: boolean }).is_active === false) {
    redirect('/suspended')
  }

  const locRaw = profile?.locations
  const locationName = (locRaw && !Array.isArray(locRaw) ? (locRaw as { name: string }) : null)?.name ?? 'Mój lokal'
  const currentLocationId = profile?.location_id ?? ''

  const permissions = resolvePermissions(
    profile?.role,
    profile?.permissions as Partial<AppPermissions> | null,
  )

  const [{ data: allLocations }, { count: openNonconformities }, { data: recentAlerts }] = await Promise.all([
    supabase.from('locations').select('id, name').eq('org_id', profile?.org_id ?? '').order('name'),
    supabase.from('nonconformities').select('id', { count: 'exact', head: true }).eq('location_id', currentLocationId).eq('status', 'open'),
    supabase.from('nonconformities').select('id, description, source, created_at').eq('location_id', currentLocationId).eq('status', 'open').order('created_at', { ascending: false }).limit(5),
  ])

  // Staff can only see their own location — only owners/managers can switch
  const isOwnerOrManager = profile?.role === 'owner' || profile?.role === 'manager'
  const visibleLocations = isOwnerOrManager
    ? (allLocations ?? [])
    : (allLocations ?? []).filter(loc => loc.id === currentLocationId)

  const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL ?? 'osyda@icloud.com'
  const isSuperadmin = !!(user.email && SUPERADMIN_EMAIL.split(',').map(e => e.toLowerCase().trim()).includes(user.email.toLowerCase().trim()))

  return (
    <MobileNavProvider>
      <div className="min-h-screen bg-gray-50">
        <ToastProvider />
        <ServiceWorkerRegister />
        <InstallPrompt />
        <Sidebar permissions={permissions} openNonconformities={openNonconformities ?? 0} />
        <Topbar
          locationName={locationName}
          userEmail={user.email}
          locations={visibleLocations}
          currentLocationId={currentLocationId}
          isSuperadmin={isSuperadmin}
          alertCount={openNonconformities ?? 0}
          alerts={recentAlerts ?? []}
          permissions={permissions}
        />
        <main className="lg:ml-64 pt-14 pb-20 lg:pb-0 min-h-screen">
          <div className="p-4 md:p-6 max-w-5xl">
            {children}
          </div>
        </main>
        <BottomNav permissions={permissions} />
      </div>
    </MobileNavProvider>
  )
}
