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

  const [profilesRes, locationsRes] = await Promise.all([
    admin
      .from('profiles')
      .select('id, full_name, email, role, location_id, locations(name)')
      .eq('org_id', id)
      .order('role'),
    admin
      .from('locations')
      .select('id, name, created_at')
      .eq('org_id', id)
      .order('name'),
  ])

  if (profilesRes.error) return NextResponse.json({ error: profilesRes.error.message }, { status: 500 })
  if (locationsRes.error) return NextResponse.json({ error: locationsRes.error.message }, { status: 500 })

  return NextResponse.json({ profiles: profilesRes.data ?? [], locations: locationsRes.data ?? [] })
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
