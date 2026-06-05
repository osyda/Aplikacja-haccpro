import { createAdminClient } from '@/lib/supabase/admin'
import { OrgDashboard } from './org-dashboard'
import type { OrgRow } from './org-dashboard'

export const dynamic = 'force-dynamic'

export default async function SuperadminPage() {
  let rows: OrgRow[] = []
  let error: string | null = null

  try {
    const admin = createAdminClient()

    const { data: orgs, error: orgsErr } = await admin
      .from('organizations')
      .select('id, name, plan, is_active, trial_ends_at, admin_notes, deactivated_at, created_at')
      .order('created_at', { ascending: false })

    if (orgsErr) throw orgsErr

    const orgIds = (orgs ?? []).map((o: { id: string }) => o.id)

    const [ownersRes, locsRes, usersRes] = await Promise.all([
      admin
        .from('profiles')
        .select('org_id, full_name, email')
        .in('org_id', orgIds)
        .eq('role', 'owner'),
      admin.from('locations').select('org_id').in('org_id', orgIds),
      admin.from('profiles').select('org_id').in('org_id', orgIds),
    ])

    const ownerMap: Record<string, { name: string; email: string }> = {}
    ;(ownersRes.data ?? []).forEach((p: { org_id: string; full_name: string; email: string }) => {
      if (!ownerMap[p.org_id]) ownerMap[p.org_id] = { name: p.full_name ?? '', email: p.email ?? '' }
    })

    const locCounts: Record<string, number> = {}
    ;(locsRes.data ?? []).forEach((l: { org_id: string }) => {
      locCounts[l.org_id] = (locCounts[l.org_id] ?? 0) + 1
    })

    const userCounts: Record<string, number> = {}
    ;(usersRes.data ?? []).forEach((p: { org_id: string }) => {
      userCounts[p.org_id] = (userCounts[p.org_id] ?? 0) + 1
    })

    rows = (orgs ?? []).map((org: {
      id: string; name: string; plan: string; is_active: boolean | null;
      trial_ends_at: string | null; admin_notes: string | null; created_at: string;
    }) => ({
      id: org.id,
      name: org.name,
      plan: org.plan ?? 'trial',
      is_active: org.is_active ?? true,
      trial_ends_at: org.trial_ends_at ?? null,
      admin_notes: org.admin_notes ?? null,
      created_at: org.created_at,
      owner_name: ownerMap[org.id]?.name ?? '—',
      owner_email: ownerMap[org.id]?.email ?? '—',
      location_count: locCounts[org.id] ?? 0,
      user_count: userCounts[org.id] ?? 0,
    }))
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
  }

  if (error) {
    return (
      <div className="mt-12 text-center space-y-3">
        <p className="text-red-600 font-semibold">Błąd ładowania danych</p>
        <p className="text-sm text-gray-500 font-mono bg-red-50 p-3 rounded-lg max-w-lg mx-auto">{error}</p>
        <p className="text-xs text-gray-400">Sprawdź czy zmienna SUPABASE_SERVICE_ROLE_KEY jest ustawiona w Vercel.</p>
      </div>
    )
  }

  return <OrgDashboard initialOrgs={rows} />
}
