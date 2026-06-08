import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const endpoint = body?.endpoint
  const p256dh = body?.keys?.p256dh
  const authKey = body?.keys?.auth
  if (!endpoint || !p256dh || !authKey) {
    return NextResponse.json({ error: 'Nieprawidłowa subskrypcja' }, { status: 400 })
  }

  const { error } = await supabase.from('push_subscriptions').insert(
    { profile_id: user.id, endpoint, p256dh, auth_key: authKey }
  )
  // ignore duplicate endpoint (same device re-subscribing)
  if (error && error.code !== '23505') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
