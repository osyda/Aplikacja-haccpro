import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { getTodayStart, getTodayEnd } from '@/lib/utils'
import { sendPushToSubscriptions } from '@/lib/push'

// Called by Vercel Cron at 20:00 daily
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const resend = new Resend(process.env.RESEND_API_KEY)

  const todayStart = getTodayStart()
  const todayEnd = getTodayEnd()

  const { data: locations } = await supabase.from('locations').select('*, organizations(name)')

  if (!locations) return NextResponse.json({ ok: true })

  const alerts: string[] = []

  for (const location of locations) {
    const [tempLogs, cleaningLogs] = await Promise.all([
      supabase.from('temperature_logs').select('id').eq('location_id', location.id).gte('measured_at', todayStart).lte('measured_at', todayEnd),
      supabase.from('cleaning_logs').select('id').eq('location_id', location.id).gte('cleaned_at', todayStart).lte('cleaned_at', todayEnd),
    ])

    const missing: string[] = []
    if (!tempLogs.data?.length) missing.push('Rejestr temperatur')
    if (!cleaningLogs.data?.length) missing.push('Mycie i dezynfekcja')

    if (missing.length > 0) {
      alerts.push(`${location.name}: brakuje — ${missing.join(', ')}`)

      const { data: owners } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('org_id', location.org_id)
        .in('role', ['owner', 'manager'])

      for (const owner of owners ?? []) {
        await resend.emails.send({
          from: 'HACCPro <alerty@haccpro.pl>',
          to: owner.email,
          subject: `HACCPro — Brakujące wpisy HACCP: ${location.name}`,
          html: `
            <h2>Brakujące wpisy HACCP na dziś</h2>
            <p>Lokal: <strong>${location.name}</strong></p>
            <p>Brakuje:</p>
            <ul>${missing.map((m) => `<li>${m}</li>`).join('')}</ul>
            <p><a href="https://app.haccpro.pl">Uzupełnij teraz →</a></p>
          `,
        })
      }

      const ownerIds = (owners ?? []).map((o) => o.id)
      if (ownerIds.length > 0) {
        const { data: subs } = await supabase
          .from('push_subscriptions')
          .select('endpoint, p256dh, auth_key')
          .in('profile_id', ownerIds)

        if (subs?.length) {
          const dead = await sendPushToSubscriptions(subs, {
            title: `Brakujące wpisy — ${location.name}`,
            body: `Uzupełnij dzisiaj: ${missing.join(', ')}`,
            url: '/dashboard',
          })
          if (dead.length) await supabase.from('push_subscriptions').delete().in('endpoint', dead)
        }
      }
    }
  }

  return NextResponse.json({ ok: true, alerts })
}
