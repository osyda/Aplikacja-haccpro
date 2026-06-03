import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
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

    // Make sure target is in the same org
    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', body.targetUserId)
      .single()

    if (!targetProfile || targetProfile.org_id !== callerProfile.org_id) {
      return NextResponse.json({ error: 'Użytkownik nie należy do tej organizacji' }, { status: 403 })
    }

    // Use admin client to bypass RLS (profiles_update_own only allows self-update)
    const admin = createAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { error } = await admin
      .from('profiles')
      .update({ role: body.role, permissions: body.permissions })
      .eq('id', body.targetUserId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
