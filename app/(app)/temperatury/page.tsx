import { createClient } from '@/lib/supabase/server'
import { getTodayStart, getTodaySplit, isTemperatureOk } from '@/lib/utils'
import { resolvePermissions } from '@/lib/permissions'
import { TemperatureBoard } from './temperature-board'
import type { AppPermissions } from '@/lib/permissions'

export interface DeviceWithStatus {
  id: string
  name: string
  min_ok: number
  max_ok: number
  zone: string | null
  lastTemp: number | null
  lastMeasuredAt: string | null
  lastOk: boolean | null
  todayCount: number
  amCount: number
  pmCount: number
}

export default async function TemperaturyPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles').select('location_id, role, permissions').eq('id', user!.id).single()
  const locationId = profile?.location_id ?? ''
  const permissions = resolvePermissions(profile?.role, profile?.permissions as Partial<AppPermissions> | null)
  const todayStart = getTodayStart()

  const [devicesRes, logsRes, locationRes] = await Promise.all([
    supabase.from('location_devices').select('*').eq('location_id', locationId).order('created_at'),
    supabase.from('temperature_logs').select('*').eq('location_id', locationId)
      .order('measured_at', { ascending: false }).limit(300),
    supabase.from('locations').select('temp_checks_per_day, temp_check_split_hour').eq('id', locationId).single(),
  ])

  const devices = devicesRes.data ?? []
  const allLogs = logsRes.data ?? []
  const checksPerDay = locationRes.data?.temp_checks_per_day ?? 1
  const splitHour = locationRes.data?.temp_check_split_hour ?? 14
  const splitTime = new Date(getTodaySplit(splitHour)).getTime()

  const deviceStatuses: DeviceWithStatus[] = []
  const knownNames = new Set<string>()

  for (const device of devices) {
    knownNames.add(device.name)
    const dLogs = allLogs.filter(l => l.device_name === device.name)
    const last = dLogs[0] ?? null
    const todayLogs = dLogs.filter(l => new Date(l.measured_at) >= new Date(todayStart))
    deviceStatuses.push({
      id: device.id,
      name: device.name,
      min_ok: device.min_ok,
      max_ok: device.max_ok,
      zone: device.zone ?? null,
      lastTemp: last?.temperature ?? null,
      lastMeasuredAt: last?.measured_at ?? null,
      lastOk: last ? isTemperatureOk(last.temperature, device.min_ok, device.max_ok) : null,
      todayCount: todayLogs.length,
      amCount: todayLogs.filter(l => new Date(l.measured_at).getTime() < splitTime).length,
      pmCount: todayLogs.filter(l => new Date(l.measured_at).getTime() >= splitTime).length,
    })
  }

  // backward compat: devices that only exist in logs (no location_devices entry)
  const orphanNames = Array.from(new Set(allLogs.map(l => l.device_name as string))).filter(n => !knownNames.has(n))
  for (const name of orphanNames) {
    const dLogs = allLogs.filter(l => l.device_name === name)
    const last = dLogs[0]
    const todayLogs = dLogs.filter(l => new Date(l.measured_at) >= new Date(todayStart))
    deviceStatuses.push({
      id: name,
      name,
      min_ok: last.min_ok,
      max_ok: last.max_ok,
      zone: null,
      lastTemp: last.temperature,
      lastMeasuredAt: last.measured_at,
      lastOk: isTemperatureOk(last.temperature, last.min_ok, last.max_ok),
      todayCount: todayLogs.length,
      amCount: todayLogs.filter(l => new Date(l.measured_at).getTime() < splitTime).length,
      pmCount: todayLogs.filter(l => new Date(l.measured_at).getTime() >= splitTime).length,
    })
  }

  return (
    <TemperatureBoard
      devices={deviceStatuses}
      locationId={locationId}
      canManageDevices={permissions.temperatures_manage_devices}
      checksPerDay={checksPerDay}
      splitHour={splitHour}
    />
  )
}
