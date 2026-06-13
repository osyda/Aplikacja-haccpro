import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

export async function POST(request: Request) {
  const { email, location_id, role } = await request.json() as { email: string; location_id?: string | null; role?: string }

  if (!email?.trim()) {
    return NextResponse.json({ error: 'Podaj adres email' }, { status: 400 })
  }

  const invitedRole = role === 'manager' ? 'manager' : 'staff'

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id, location_id, role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'owner' && profile.role !== 'manager')) {
    return NextResponse.json({ error: 'Tylko właściciel może zapraszać pracowników' }, { status: 403 })
  }

  // Create a server-issued invite token (RLS-checked: org_id/location_id must
  // belong to the caller's own org). The signup trigger only joins this org
  // if it finds a matching, unexpired invite for the token + email.
  const { data: invite, error: inviteError } = await supabase
    .from('invites')
    .insert({
      org_id: profile.org_id,
      location_id: location_id ?? null,
      role: invitedRole,
      email: email.trim().toLowerCase(),
      invited_by: user.id,
    })
    .select('token')
    .single()

  if (inviteError || !invite) {
    return NextResponse.json({ error: inviteError?.message ?? 'Błąd tworzenia zaproszenia' }, { status: 500 })
  }

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://app.haccpro.pl'

  const { error } = await admin.auth.admin.inviteUserByEmail(email.trim(), {
    data: {
      invite_token: invite.token,
    },
    redirectTo: `${siteUrl}/auth/confirm`,
  })

  if (error) {
    await supabase.from('invites').delete().eq('token', invite.token)
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
