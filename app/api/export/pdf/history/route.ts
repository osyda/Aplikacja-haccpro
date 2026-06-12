import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('location_id')
    .eq('id', user.id)
    .single()

  const locationId = profile?.location_id ?? ''

  const { data: reports } = await supabase
    .from('generated_reports')
    .select('id, modules, period_month, period_year, file_path, generated_at')
    .eq('location_id', locationId)
    .order('generated_at', { ascending: false })
    .limit(20)

  const items = (reports ?? []).map(r => ({
    id: r.id,
    modules: r.modules,
    period_month: r.period_month,
    period_year: r.period_year,
    generated_at: r.generated_at,
    url: supabase.storage.from('reports').getPublicUrl(r.file_path).data.publicUrl,
  }))

  return NextResponse.json({ reports: items })
}
