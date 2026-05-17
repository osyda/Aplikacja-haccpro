import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Thermometer, Plus, ChevronRight } from 'lucide-react'
import { formatDateTime, isTemperatureOk, getTodayStart } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { AddTemperatureForm } from './add-temperature-form'

interface DeviceStatus {
  device_name: string
  last_log: {
    id: string
    temperature: number
    min_ok: number
    max_ok: number
    measured_at: string
  } | null
  today_count: number
}

export default async function TemperaturyPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('location_id')
    .eq('id', user!.id)
    .single()

  const locationId = profile?.location_id ?? ''
  const todayStart = getTodayStart()

  const { data: logs } = await supabase
    .from('temperature_logs')
    .select('*')
    .eq('location_id', locationId)
    .order('measured_at', { ascending: false })
    .limit(100)

  const deviceMap = new Map<string, DeviceStatus>()

  for (const log of logs ?? []) {
    if (!deviceMap.has(log.device_name)) {
      deviceMap.set(log.device_name, {
        device_name: log.device_name,
        last_log: log,
        today_count: 0,
      })
    }
    if (new Date(log.measured_at) >= new Date(todayStart)) {
      const d = deviceMap.get(log.device_name)!
      d.today_count++
    }
  }

  const devices = Array.from(deviceMap.values())

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rejestr temperatur</h1>
          <p className="text-sm text-gray-500 mt-0.5">Monitoruj temperatury urządzeń chłodniczych</p>
        </div>
      </div>

      <AddTemperatureForm locationId={locationId} />

      {devices.length > 0 ? (
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-3">Urządzenia</h2>
          <div className="divide-y divide-gray-50">
            {devices.map((device) => {
              const log = device.last_log
              const ok = log ? isTemperatureOk(log.temperature, log.min_ok, log.max_ok) : null
              return (
                <Link
                  key={device.device_name}
                  href={`/temperatury/${encodeURIComponent(device.device_name)}`}
                  className="flex items-center justify-between py-3 hover:bg-gray-50 -mx-4 px-4 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${ok === null ? 'bg-gray-100' : ok ? 'bg-green-100' : 'bg-red-100'}`}>
                      <Thermometer size={16} className={ok === null ? 'text-gray-500' : ok ? 'text-green-600' : 'text-red-600'} />
                    </div>
                    <div>
                      <p className="font-medium text-sm text-gray-900">{device.device_name}</p>
                      {log ? (
                        <p className="text-xs text-gray-400">
                          Ostatni wpis: {formatDateTime(log.measured_at)}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-400">Brak wpisów</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {log && (
                      <>
                        <div className="text-right">
                          <p className="font-mono font-semibold text-sm">{log.temperature}°C</p>
                          <p className="text-xs text-gray-400">norma: {log.min_ok}–{log.max_ok}°C</p>
                        </div>
                        <Badge variant={ok ? 'ok' : 'error'}>
                          {ok ? 'OK' : 'ALARM'}
                        </Badge>
                        <span className="text-xs text-gray-400">dziś: {device.today_count}x</span>
                      </>
                    )}
                    <ChevronRight size={14} className="text-gray-300" />
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="card border-dashed border-2 border-gray-200 text-center py-12">
          <Thermometer size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">Brak urządzeń. Dodaj pierwszy wpis powyżej.</p>
        </div>
      )}
    </div>
  )
}
