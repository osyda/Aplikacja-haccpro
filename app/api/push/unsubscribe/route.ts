import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const endpoint = body?.endpoint
  if (!endpoint) return NextResponse.json({ error: 'Brak endpoint' }, { status: 400 })

  await supabase.from('push_subscriptions').delete().eq('profile_id', user.id).eq('endpoint', endpoint)

  return NextResponse.json({ ok: true })
}
