import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ChevronLeft, Thermometer } from 'lucide-react'
import { formatDateTime, isTemperatureOk } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { TemperatureChart } from './temperature-chart'

interface PageProps {
  params: { deviceId: string }
}

export default async function DeviceHistoryPage({ params }: PageProps) {
  const deviceName = decodeURIComponent(params.deviceId)
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('location_id')
    .eq('id', user!.id)
    .single()

  const { data: logs } = await supabase
    .from('temperature_logs')
    .select('*')
    .eq('location_id', profile?.location_id ?? '')
    .eq('device_name', deviceName)
    .order('measured_at', { ascending: false })
    .limit(100)

  const stats = logs && logs.length > 0 ? {
    avg: (logs.reduce((s: number, l: { temperature: number }) => s + l.temperature, 0) / logs.length).toFixed(1),
    min: Math.min(...logs.map((l: { temperature: number }) => l.temperature)),
    max: Math.max(...logs.map((l: { temperature: number }) => l.temperature)),
    alarms: logs.filter((l: { temperature: number; min_ok: number; max_ok: number }) => !isTemperatureOk(l.temperature, l.min_ok, l.max_ok)).length,
  } : null

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/temperatury" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ChevronLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Thermometer size={22} className="text-blue-500" />
            {deviceName}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Historia pomiarów — ostatnie {logs?.length ?? 0} wpisów</p>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Średnia', value: `${stats.avg}°C`, warn: false },
            { label: 'Minimum', value: `${stats.min}°C`, warn: false },
            { label: 'Maksimum', value: `${stats.max}°C`, warn: false },
            { label: 'Alarmy', value: String(stats.alarms), warn: stats.alarms > 0 },
          ].map((s) => (
            <div key={s.label} className={`card text-center ${s.warn ? 'border-red-200 bg-red-50' : ''}`}>
              <p className={`text-2xl font-bold font-mono ${s.warn ? 'text-red-700' : 'text-gray-900'}`}>{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {logs && logs.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">Wykres temperatury</h2>
          <TemperatureChart logs={logs} />
        </div>
      )}

      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-3">Tabela pomiarów ({logs?.length ?? 0})</h2>
        {logs && logs.length > 0 ? (
          <div className="divide-y divide-gray-50">
            {logs.map((log: { id: string; temperature: number; min_ok: number; max_ok: number; measured_at: string; notes: string | null }) => {
              const ok = isTemperatureOk(log.temperature, log.min_ok, log.max_ok)
              return (
                <div key={log.id} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-gray-700">{formatDateTime(log.measured_at)}</p>
                    {log.notes && <p className="text-xs text-gray-400 mt-0.5">{log.notes}</p>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-mono font-semibold text-sm">{log.temperature}°C</span>
                    <span className="text-xs text-gray-400 hidden sm:block">norma: {log.min_ok}–{log.max_ok}°C</span>
                    <Badge variant={ok ? 'ok' : 'error'}>{ok ? 'OK' : 'ALARM'}</Badge>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-center text-gray-400 py-8">Brak pomiarów dla tego urządzenia</p>
        )}
      </div>
    </div>
  )
}
