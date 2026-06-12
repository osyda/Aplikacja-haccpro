import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { AppPermissions } from '@/lib/permissions'

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Verify caller is owner/manager in this org
    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('org_id, role')
      .eq('id', user.id)
      .single()

    if (!callerProfile || !['owner', 'manager'].includes(callerProfile.role ?? '')) {
      return NextResponse.json({ error: 'Brak uprawnień właściciela' }, { status: 403 })
    }

    const body = await req.json() as {
      targetUserId: string
      role: string
      permissions: AppPermissions | null
    }

    const VALID_ROLES = ['owner', 'manager', 'staff']
    if (!VALID_ROLES.includes(body.role)) {
      return NextResponse.json({ error: 'Nieprawidłowa rola' }, { status: 400 })
    }

    if (body.targetUserId === user.id) {
      return NextResponse.json({ error: 'Nie możesz zmienić własnej roli' }, { status: 403 })
    }

    // Make sure target is in the same org
    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('org_id, role')
      .eq('id', body.targetUserId)
      .single()

    if (!targetProfile || targetProfile.org_id !== callerProfile.org_id) {
      return NextResponse.json({ error: 'Użytkownik nie należy do tej organizacji' }, { status: 403 })
    }

    // Only an existing owner can grant or revoke the owner role
    if ((body.role === 'owner' || targetProfile.role === 'owner') && callerProfile.role !== 'owner') {
      return NextResponse.json({ error: 'Tylko właściciel może zarządzać rolą właściciela' }, { status: 403 })
    }

    // Use SECURITY DEFINER RPC to bypass RLS (PostgREST admin client has issues)
    const { error } = await supabase.rpc('update_staff_permissions', {
      target_id: body.targetUserId,
      new_role: body.role,
      new_permissions: body.permissions,
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
