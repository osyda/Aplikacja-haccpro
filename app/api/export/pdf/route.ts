import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { HacppPdfDocument } from './pdf-document'

export const dynamic = 'force-dynamic'

const MONTH_NAMES = ['', 'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień']

async function fetchModuleData(
  supabase: ReturnType<typeof createClient>,
  locationId: string,
  moduleIds: string[],
  year: number,
  month: number
) {
  const start = new Date(year, month - 1, 1).toISOString()
  const end = new Date(year, month, 0, 23, 59, 59).toISOString()

  const results: Record<string, unknown[]> = {}

  const fetches = moduleIds.map(async (mod) => {
    switch (mod) {
      case 'temperatury': {
        const { data } = await supabase.from('temperature_logs').select('*').eq('location_id', locationId).gte('measured_at', start).lte('measured_at', end).order('measured_at')
        results.temperatury = data ?? []
        break
      }
      case 'dostawy': {
        const { data } = await supabase.from('delivery_logs').select('*').eq('location_id', locationId).gte('received_at', start).lte('received_at', end).order('received_at')
        results.dostawy = data ?? []
        break
      }
      case 'mycie': {
        const { data } = await supabase.from('cleaning_logs').select('*').eq('location_id', locationId).gte('cleaned_at', start).lte('cleaned_at', end).order('cleaned_at')
        results.mycie = data ?? []
        break
      }
      case 'szkolenia': {
        const { data } = await supabase.from('training_logs').select('*').eq('location_id', locationId).gte('trained_at', start).lte('trained_at', end).order('trained_at')
        results.szkolenia = data ?? []
        break
      }
      case 'niezgodnosci': {
        const { data } = await supabase.from('nonconformities').select('*').eq('location_id', locationId).gte('created_at', start).lte('created_at', end).order('created_at')
        results.niezgodnosci = data ?? []
        break
      }
      case 'ddd': {
        const { data } = await supabase.from('ddd_logs').select('*').eq('location_id', locationId).gte('inspected_at', start).lte('inspected_at', end).order('inspected_at')
        results.ddd = data ?? []
        break
      }
    }
  })

  await Promise.all(fetches)
  return results
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const moduleIds = (searchParams.get('modules') ?? 'temperatury,dostawy,mycie').split(',')
    const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))
    const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('location_id, locations(name, address, city)')
      .eq('id', user.id)
      .single()

    const locationId = profile?.location_id ?? ''
    const locRaw = profile?.locations
    const location: { name: string; address: string; city: string } | null =
      locRaw && !Array.isArray(locRaw) ? (locRaw as { name: string; address: string; city: string }) : null

    const data = await fetchModuleData(supabase, locationId, moduleIds, year, month)

    // Collect all recorded_by UUIDs across modules and resolve full names
    const allIds = new Set<string>()
    type WithRecordedBy = { recorded_by?: string | null }
    type WithReportedBy = { reported_by?: string | null; resolved_by?: string | null }
    ;(data.temperatury as WithRecordedBy[] ?? []).forEach(r => { if (r.recorded_by) allIds.add(r.recorded_by) })
    ;(data.dostawy as WithRecordedBy[] ?? []).forEach(r => { if (r.recorded_by) allIds.add(r.recorded_by) })
    ;(data.mycie as WithRecordedBy[] ?? []).forEach(r => { if (r.recorded_by) allIds.add(r.recorded_by) })
    ;(data.niezgodnosci as WithReportedBy[] ?? []).forEach(r => {
      if (r.reported_by) allIds.add(r.reported_by)
      if (r.resolved_by) allIds.add(r.resolved_by)
    })
    const idArr = Array.from(allIds)
    const profilesMap: Record<string, string> = {}
    if (idArr.length > 0) {
      const { data: pData } = await supabase.from('profiles').select('id, full_name').in('id', idArr)
      ;(pData ?? []).forEach((p: { id: string; full_name: string | null }) => { profilesMap[p.id] = p.full_name ?? '' })
    }

    const element = createElement(HacppPdfDocument, {
      monthName: MONTH_NAMES[month],
      year,
      locationName: location?.name ?? 'Brak danych',
      locationAddress: location ? `${location.address}, ${location.city}` : '',
      moduleIds,
      data,
      profilesMap,
    })

    const buffer = Buffer.from(await renderToBuffer(element as any))

    if (locationId) {
      const filePath = `${locationId}/${year}-${String(month).padStart(2, '0')}-${Date.now()}.pdf`
      const { error: uploadError } = await supabase.storage.from('reports').upload(filePath, buffer, {
        contentType: 'application/pdf',
      })
      if (!uploadError) {
        await supabase.from('generated_reports').insert({
          location_id: locationId,
          modules: moduleIds,
          period_month: month,
          period_year: year,
          file_path: filePath,
          generated_by: user.id,
        })
      } else {
        console.error('[PDF] report storage error:', uploadError.message)
      }
    }

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="HACCP_${MONTH_NAMES[month]}_${year}.pdf"`,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? `${err.message}\n${err.stack}` : String(err)
    console.error('[PDF] generation error:', msg)
    return new NextResponse(msg, { status: 500 })
  }
}
