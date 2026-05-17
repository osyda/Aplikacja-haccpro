import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Thermometer, Truck, Droplets, AlertTriangle, Plus, CheckCircle2, XCircle } from 'lucide-react'
import { getTodayStart, getTodayEnd, isTemperatureOk, formatDateTime } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

async function getDashboardData(locationId: string) {
  const supabase = createClient()
  const todayStart = getTodayStart()
  const todayEnd = getTodayEnd()

  const [tempLogs, deliveryLogs, cleaningLogs, nonconformities] = await Promise.all([
    supabase.from('temperature_logs').select('*').eq('location_id', locationId).gte('measured_at', todayStart).lte('measured_at', todayEnd),
    supabase.from('delivery_logs').select('*').eq('location_id', locationId).gte('received_at', todayStart).lte('received_at', todayEnd),
    supabase.from('cleaning_logs').select('*').eq('location_id', locationId).gte('cleaned_at', todayStart).lte('cleaned_at', todayEnd),
    supabase.from('nonconformities').select('*').eq('location_id', locationId).eq('status', 'open'),
  ])

  const alertTempLogs = (tempLogs.data ?? []).filter(
    (log) => !isTemperatureOk(log.temperature, log.min_ok, log.max_ok)
  )

  return {
    tempCount: tempLogs.data?.length ?? 0,
    deliveryCount: deliveryLogs.data?.length ?? 0,
    cleaningCount: cleaningLogs.data?.length ?? 0,
    openNonconformities: nonconformities.data?.length ?? 0,
    alertTempLogs,
    recentTempLogs: tempLogs.data?.slice(-5).reverse() ?? [],
  }
}

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('location_id')
    .eq('id', user!.id)
    .single()

  const locationId = profile?.location_id ?? ''
  const data = locationId ? await getDashboardData(locationId) : null

  const today = new Date().toLocaleDateString('pl-PL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const quickActions = [
    { href: '/temperatury', label: 'Temperatura', icon: Thermometer, color: 'bg-blue-500' },
    { href: '/dostawy/nowa', label: 'Dostawa', icon: Truck, color: 'bg-purple-500' },
    { href: '/mycie', label: 'Mycie', icon: Droplets, color: 'bg-cyan-500' },
    { href: '/niezgodnosci', label: 'Niezgodność', icon: AlertTriangle, color: 'bg-orange-500' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-0.5 capitalize">{today}</p>
      </div>

      {data?.alertTempLogs && data.alertTempLogs.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-red-600" />
            <h2 className="font-semibold text-red-800">Alerty temperatur</h2>
          </div>
          <div className="space-y-1">
            {data.alertTempLogs.map((log) => (
              <p key={log.id} className="text-sm text-red-700">
                {log.device_name}: <strong>{log.temperature}°C</strong>
                {' '}(norma: {log.min_ok}–{log.max_ok}°C) — {formatDateTime(log.measured_at)}
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Temp. dziś', value: data?.tempCount ?? 0, icon: Thermometer, color: 'text-blue-600 bg-blue-50', ok: (data?.tempCount ?? 0) > 0 },
          { label: 'Dostawy dziś', value: data?.deliveryCount ?? 0, icon: Truck, color: 'text-purple-600 bg-purple-50', ok: true },
          { label: 'Mycie dziś', value: data?.cleaningCount ?? 0, icon: Droplets, color: 'text-cyan-600 bg-cyan-50', ok: (data?.cleaningCount ?? 0) > 0 },
          { label: 'Otwarte niezg.', value: data?.openNonconformities ?? 0, icon: AlertTriangle, color: 'text-orange-600 bg-orange-50', ok: (data?.openNonconformities ?? 0) === 0 },
        ].map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="card flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stat.color}`}>
                <Icon size={20} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-xs text-gray-500">{stat.label}</p>
              </div>
              <div className="ml-auto">
                {stat.ok
                  ? <CheckCircle2 size={16} className="text-brand-green" />
                  : <XCircle size={16} className="text-red-400" />
                }
              </div>
            </div>
          )
        })}
      </div>

      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-3">Szybkie akcje</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon
            return (
              <Link
                key={action.href}
                href={action.href}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-100 hover:border-brand-green hover:bg-green-50 transition-colors group"
              >
                <div className={`${action.color} p-3 rounded-xl text-white group-hover:scale-110 transition-transform`}>
                  <Icon size={20} />
                </div>
                <span className="text-xs font-medium text-gray-700 flex items-center gap-1">
                  <Plus size={10} />
                  {action.label}
                </span>
              </Link>
            )
          })}
        </div>
      </div>

      {data && data.recentTempLogs.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Ostatnie wpisy temperatur</h2>
            <Link href="/temperatury" className="text-sm text-brand-green hover:underline">
              Zobacz wszystkie
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {data.recentTempLogs.map((log) => {
              const ok = isTemperatureOk(log.temperature, log.min_ok, log.max_ok)
              return (
                <div key={log.id} className="py-2 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{log.device_name}</p>
                    <p className="text-xs text-gray-400">{formatDateTime(log.measured_at)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold">{log.temperature}°C</span>
                    <Badge variant={ok ? 'ok' : 'error'}>
                      {ok ? 'OK' : 'ALARM'}
                    </Badge>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {!locationId && (
        <div className="card border-dashed border-2 border-gray-200 text-center py-12">
          <p className="text-gray-500 mb-4">Najpierw skonfiguruj swój lokal</p>
          <Link href="/ustawienia/lokale" className="btn-primary inline-block">
            Dodaj lokal
          </Link>
        </div>
      )}
    </div>
  )
}
