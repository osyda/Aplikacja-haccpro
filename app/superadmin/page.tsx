import { createAdminClient } from '@/lib/supabase/admin'
import { OrgDashboard } from './org-dashboard'
import type { OrgRow } from './org-dashboard'

export const dynamic = 'force-dynamic'

function extractErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object') {
    const obj = e as Record<string, unknown>
    if (typeof obj.message === 'string') return obj.message
    if (typeof obj.hint === 'string') return `${obj.hint}`
    if (typeof obj.details === 'string') return obj.details
    try { return JSON.stringify(obj) } catch { return 'Nieznany błąd' }
  }
  return String(e)
}

export default async function SuperadminPage() {
  let rows: OrgRow[] = []
  let error: string | null = null
  let migrationNeeded = false

  try {
    const admin = createAdminClient()

    // Try with new admin columns first; fall back if migration hasn't been run yet
    let { data: orgs, error: orgsErr } = await admin
      .from('organizations')
      .select('id, name, plan, is_active, trial_ends_at, admin_notes, created_at')
      .order('created_at', { ascending: false })

    if (orgsErr) {
      // Likely missing columns — try without them
      const fallback = await admin
        .from('organizations')
        .select('id, name, plan, created_at')
        .order('created_at', { ascending: false })
      if (fallback.error) throw fallback.error
      orgs = (fallback.data ?? []).map((o: { id: string; name: string; plan: string; created_at: string }) => ({
        ...o, is_active: true, trial_ends_at: null, admin_notes: null,
      }))
      migrationNeeded = true
    }

    const orgIds = (orgs ?? []).map((o: { id: string }) => o.id)

    const [ownersRes, locsRes, usersRes] = await Promise.all([
      admin.from('profiles').select('org_id, full_name, email, phone').in('org_id', orgIds).eq('role', 'owner'),
      admin.from('locations').select('org_id').in('org_id', orgIds),
      admin.from('profiles').select('org_id').in('org_id', orgIds),
    ])

    const ownerMap: Record<string, { name: string; email: string; phone: string }> = {}
    ;(ownersRes.data ?? []).forEach((p: { org_id: string; full_name: string; email: string; phone: string | null }) => {
      if (!ownerMap[p.org_id]) ownerMap[p.org_id] = { name: p.full_name ?? '', email: p.email ?? '', phone: p.phone ?? '' }
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
      owner_phone: ownerMap[org.id]?.phone ?? '',
      location_count: locCounts[org.id] ?? 0,
      user_count: userCounts[org.id] ?? 0,
    }))
  } catch (e) {
    error = extractErrorMessage(e)
  }

  if (error) {
    return (
      <div className="mt-12 text-center space-y-3">
        <p className="text-red-600 font-semibold">Błąd ładowania danych</p>
        <p className="text-sm text-gray-500 font-mono bg-red-50 p-3 rounded-lg max-w-lg mx-auto break-all">{error}</p>
        <p className="text-xs text-gray-400">Sprawdź czy zmienna SUPABASE_SERVICE_ROLE_KEY jest poprawnie ustawiona w Vercel.</p>
      </div>
    )
  }

  return (
    <>
      {migrationNeeded && (
        <div className="mb-4 p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
          <strong>Wymagana migracja SQL</strong> — niektóre funkcje (zawieszanie, trial, notatki) będą działać dopiero po uruchomieniu migracji w Supabase SQL Editor:
          <pre className="mt-2 text-xs bg-amber-100 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">{`ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS trial_ends_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS admin_notes    TEXT,
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;

UPDATE organizations SET trial_ends_at = created_at + INTERVAL '14 days' WHERE plan = 'trial';`}</pre>
        </div>
      )}
      <OrgDashboard initialOrgs={rows} />
    </>
  )
}
