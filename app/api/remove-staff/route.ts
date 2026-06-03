import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

export async function POST(request: Request) {
  const { targetUserId } = await request.json() as { targetUserId: string }
  if (!targetUserId) return NextResponse.json({ error: 'Brak ID użytkownika' }, { status: 400 })

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })

  if (user.id === targetUserId) {
    return NextResponse.json({ error: 'Nie możesz usunąć własnego konta' }, { status: 400 })
  }

  const { data: caller } = await supabase
    .from('profiles').select('org_id, role').eq('id', user.id).single()

  if (!caller || (caller.role !== 'owner' && caller.role !== 'manager')) {
    return NextResponse.json({ error: 'Tylko właściciel może usuwać pracowników' }, { status: 403 })
  }

  const { data: target } = await supabase
    .from('profiles').select('org_id, role').eq('id', targetUserId).single()

  if (!target || target.org_id !== caller.org_id) {
    return NextResponse.json({ error: 'Użytkownik nie należy do Twojej organizacji' }, { status: 403 })
  }

  if (target.role === 'owner') {
    return NextResponse.json({ error: 'Nie można usunąć właściciela' }, { status: 403 })
  }

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { error } = await admin.auth.admin.deleteUser(targetUserId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
