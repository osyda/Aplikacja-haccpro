import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { sendPushToSubscriptions } from '@/lib/push'

// Called from the client right after a temperature alarm creates a
// nonconformity — pushes a real-time notification to everyone at that
// location who has push notifications enabled (PWA).
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const deviceName = body?.deviceName
  const temperature = body?.temperature
  if (!deviceName || temperature == null) {
    return NextResponse.json({ error: 'Brak danych' }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('location_id, locations(name)')
    .eq('id', user.id)
    .single()

  const locationId = profile?.location_id
  if (!locationId) return NextResponse.json({ ok: true })
  const locRaw = profile?.locations
  const locationName = (locRaw && !Array.isArray(locRaw) ? (locRaw as { name: string }) : null)?.name ?? ''

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: locationProfiles } = await service.from('profiles').select('id').eq('location_id', locationId)
  const profileIds = (locationProfiles ?? []).map((p) => p.id)
  if (profileIds.length === 0) return NextResponse.json({ ok: true })

  const { data: subs } = await service
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth_key')
    .in('profile_id', profileIds)
  if (!subs?.length) return NextResponse.json({ ok: true })

  const dead = await sendPushToSubscriptions(subs, {
    title: `Alarm temperatury — ${locationName}`,
    body: `${deviceName}: ${temperature}°C poza normą`,
    url: '/temperatury',
  })
  if (dead.length) await service.from('push_subscriptions').delete().in('endpoint', dead)

  return NextResponse.json({ ok: true })
}
