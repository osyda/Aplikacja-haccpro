import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL ?? 'osyda@icloud.com'

async function checkAdmin() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.email === SUPERADMIN_EMAIL ? user : null
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const user = await checkAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { id } = params

  const [orgRes, profilesRes, locationsRes] = await Promise.all([
    admin
      .from('organizations')
      .select('id, name, plan, is_active, trial_ends_at, created_at, nip, address_street, address_building_no, address_unit_no, address_postal_code, address_city')
      .eq('id', id)
      .single(),
    admin
      .from('profiles')
      .select('id, full_name, email, phone, role, location_id, created_at, locations(name)')
      .eq('org_id', id)
      .order('role'),
    admin
      .from('locations')
      .select('id, name, type, address, city, postal_code, oil_company_name, oil_company_phone, created_at')
      .eq('org_id', id)
      .order('name'),
  ])

  if (orgRes.error) return NextResponse.json({ error: orgRes.error.message }, { status: 500 })
  if (profilesRes.error) return NextResponse.json({ error: profilesRes.error.message }, { status: 500 })
  if (locationsRes.error) return NextResponse.json({ error: locationsRes.error.message }, { status: 500 })

  return NextResponse.json({
    organization: orgRes.data,
    profiles: profilesRes.data ?? [],
    locations: locationsRes.data ?? [],
  })
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await checkAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { id } = params

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { action } = body

  switch (action) {
    case 'suspend': {
      const { error } = await admin
        .from('organizations')
        .update({ is_active: false, deactivated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      break
    }

    case 'activate': {
      const { error } = await admin
        .from('organizations')
        .update({ is_active: true, deactivated_at: null })
        .eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      break
    }

    case 'extend_trial': {
      const days = typeof body.days === 'number' ? body.days : 14
      const { data: org, error: fetchErr } = await admin
        .from('organizations')
        .select('trial_ends_at')
        .eq('id', id)
        .single()
      if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })

      const base = org?.trial_ends_at && new Date(org.trial_ends_at) > new Date()
        ? new Date(org.trial_ends_at)
        : new Date()
      base.setDate(base.getDate() + days)

      const { error } = await admin
        .from('organizations')
        .update({ trial_ends_at: base.toISOString(), plan: 'trial', is_active: true })
        .eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      break
    }

    case 'change_plan': {
      const plan = String(body.plan ?? '')
      const valid = ['trial', 'start', 'pro', 'multi', 'enterprise']
      if (!valid.includes(plan)) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
      const { error } = await admin.from('organizations').update({ plan }).eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      break
    }

    case 'update_notes': {
      const notes = body.notes === '' ? null : String(body.notes ?? '')
      const { error } = await admin.from('organizations').update({ admin_notes: notes }).eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      break
    }

    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const user = await checkAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { id } = params

  // Fetch all user IDs before deleting (cascade will remove profiles)
  const { data: profiles } = await admin
    .from('profiles')
    .select('id')
    .eq('org_id', id)

  // Delete organization — cascade removes profiles, locations, and all related records
  const { error: deleteOrgErr } = await admin
    .from('organizations')
    .delete()
    .eq('id', id)

  if (deleteOrgErr) return NextResponse.json({ error: deleteOrgErr.message }, { status: 500 })

  // Delete auth users (best-effort, don't fail if individual deletes error)
  if (profiles && profiles.length > 0) {
    await Promise.allSettled(
      profiles.map(p => admin.auth.admin.deleteUser(p.id))
    )
  }

  return NextResponse.json({ ok: true })
}
