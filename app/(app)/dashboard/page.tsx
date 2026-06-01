import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Thermometer, Truck, Droplets, AlertTriangle, Plus, ChevronRight } from 'lucide-react'
import { getTodayStart, getTodayEnd, isTemperatureOk, formatDateTime } from '@/lib/utils'

async function getDashboardData(locationId: string) {
  const supabase = createClient()
  const todayStart = getTodayStart()
  const todayEnd = getTodayEnd()

  const [tempLogs, deliveryLogs, cleaningLogs, nonconformities, devices] = await Promise.all([
    supabase.from('temperature_logs').select('*').eq('location_id', locationId).gte('measured_at', todayStart).lte('measured_at', todayEnd),
    supabase.from('delivery_logs').select('*').eq('location_id', locationId).gte('received_at', todayStart).lte('received_at', todayEnd).order('received_at', { ascending: false }),
    supabase.from('cleaning_logs').select('id,area,agent,cleaned_at').eq('location_id', locationId).gte('cleaned_at', todayStart).lte('cleaned_at', todayEnd).order('cleaned_at', { ascending: false }),
    supabase.from('nonconformities').select('id').eq('location_id', locationId).eq('status', 'open'),
    supabase.from('location_devices').select('id').eq('location_id', locationId),
  ])

  const tLogs = tempLogs.data ?? []
  const dLogs = deliveryLogs.data ?? []
  const cLogs = cleaningLogs.data ?? []

  const checkedDeviceNames = new Set(tLogs.map(l => l.device_name))
  const totalDevices = devices.data?.length ?? 0
  const checkedDevices = checkedDeviceNames.size
  const alarmLogs = tLogs.filter(l => !isTemperatureOk(l.temperature, l.min_ok, l.max_ok))

  const lastDelivery = dLogs[0] ?? null
  const lastCleaning = cLogs[0] ?? null

  return {
    totalDevices,
    checkedDevices,
    tempProgress: totalDevices > 0 ? Math.round((checkedDevices / totalDevices) * 100) : 0,
    tempAlarms: alarmLogs.length,
    deliveryCount: dLogs.length,
    lastDelivery,
    cleaningCount: cLogs.length,
    lastCleaning,
    openNonconformities: nonconformities.data?.length ?? 0,
  }
}

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('location_id, locations(name)')
    .eq('id', user!.id)
    .single()

  const locationId = profile?.location_id ?? ''
  const locRaw = profile?.locations
  const locationName = (locRaw && !Array.isArray(locRaw) ? (locRaw as { name: string }) : null)?.name ?? 'Mój lokal'
  const data = locationId ? await getDashboardData(locationId) : null

  const today = new Date()
  const dateStr = today.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const todoCount = (() => {
    if (!data) return 0
    let n = 0
    if (data.checkedDevices < data.totalDevices) n++
    if (data.cleaningCount === 0) n++
    if (data.tempAlarms > 0) n++
    return n
  })()

  if (!locationId) {
    return (
      <div className="card border-dashed border-2 border-gray-200 text-center py-16">
        <p className="text-gray-500 mb-4">Najpierw skonfiguruj swój lokal</p>
        <Link href="/ustawienia/lokale" className="btn-primary inline-block">Dodaj lokal</Link>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{locationName}</h1>
          <p className="text-sm text-gray-500 mt-0.5 capitalize">{dateStr}</p>
        </div>
        {todoCount > 0 ? (
          <span className="px-3 py-1.5 rounded-full bg-orange-100 text-orange-700 text-xs font-bold shrink-0 mt-1">
            Do wykonania: {todoCount}
          </span>
        ) : (
          <span className="px-3 py-1.5 rounded-full bg-green-100 text-green-700 text-xs font-bold shrink-0 mt-1">
            Wszystko OK
          </span>
        )}
      </div>

      {/* Alert banner */}
      {data && data.tempAlarms > 0 && (
        <div className="rounded-xl border-2 border-red-200 bg-red-50 p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-red-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-bold text-red-800 text-sm">Alarmy temperatur ({data.tempAlarms})</p>
            <p className="text-xs text-red-600 mt-0.5">Sprawdź urządzenia z przekroczoną normą</p>
          </div>
          <Link href="/temperatury" className="ml-auto shrink-0 text-xs text-red-700 font-semibold hover:underline">
            Przejdź →
          </Link>
        </div>
      )}

      {data && data.openNonconformities > 0 && (
        <div className="rounded-xl border-2 border-orange-200 bg-orange-50 p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-orange-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-bold text-orange-800 text-sm">Otwarte niezgodności ({data.openNonconformities})</p>
            <p className="text-xs text-orange-600 mt-0.5">Wymagają zamknięcia lub działania korygującego</p>
          </div>
          <Link href="/niezgodnosci" className="ml-auto shrink-0 text-xs text-orange-700 font-semibold hover:underline">
            Przejdź →
          </Link>
        </div>
      )}

      {/* Temperature tile */}
      <div className={`rounded-2xl border-2 p-5 ${
        data && data.tempAlarms > 0
          ? 'border-red-200 bg-red-50'
          : data && data.checkedDevices === data.totalDevices && data.totalDevices > 0
          ? 'border-green-200 bg-green-50'
          : 'border-blue-100 bg-white'
      }`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 rounded-xl">
              <Thermometer size={18} className="text-blue-600" />
            </div>
            <span className="font-bold text-gray-900">Temperatury</span>
          </div>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
            data && data.tempAlarms > 0 ? 'bg-red-200 text-red-800'
            : data && data.checkedDevices === data.totalDevices && data.totalDevices > 0 ? 'bg-green-200 text-green-800'
            : data && data.checkedDevices > 0 ? 'bg-orange-100 text-orange-700'
            : 'bg-gray-100 text-gray-600'
          }`}>
            {data
              ? data.totalDevices === 0 ? 'Brak urządzeń'
              : data.tempAlarms > 0 ? `${data.tempAlarms} alarm${data.tempAlarms > 1 ? 'y' : ''}`
              : data.checkedDevices === data.totalDevices ? 'Wszystkie OK'
              : 'Do uzupełnienia'
              : '–'}
          </span>
        </div>

        {data && data.totalDevices > 0 && (
          <>
            <p className="text-sm text-gray-600 mb-2">
              Sprawdzone: <span className="font-bold text-gray-900">{data.checkedDevices}/{data.totalDevices}</span> urządzeń
            </p>
            <div className="w-full bg-white/60 rounded-full h-2.5 mb-4 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  data.tempAlarms > 0 ? 'bg-red-500'
                  : data.checkedDevices === data.totalDevices ? 'bg-green-500'
                  : 'bg-blue-500'
                }`}
                style={{ width: `${data.tempProgress}%` }}
              />
            </div>
          </>
        )}

        <Link href="/temperatury"
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3.5 text-sm font-bold transition-colors min-h-[52px]">
          {data && data.checkedDevices < data.totalDevices ? 'Sprawdź temperatury' : 'Rejestr temperatur'}
          <ChevronRight size={16} />
        </Link>
      </div>

      {/* Deliveries tile */}
      <div className="rounded-2xl border-2 border-purple-100 bg-white p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-100 rounded-xl">
              <Truck size={18} className="text-purple-600" />
            </div>
            <span className="font-bold text-gray-900">Dostawy</span>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-purple-100 text-purple-700">
            {data ? `${data.deliveryCount} dziś` : '–'}
          </span>
        </div>

        {data?.lastDelivery ? (
          <p className="text-sm text-gray-600 mb-4">
            Ostatnia: <span className="font-medium text-gray-900">{data.lastDelivery.supplier}</span>
            {data.lastDelivery.product && <span className="text-gray-500"> · {data.lastDelivery.product}</span>}
          </p>
        ) : (
          <p className="text-sm text-gray-400 mb-4">Brak dostaw dzisiaj. Dodaj pierwszą dostawę.</p>
        )}

        <Link href="/dostawy/nowa"
          className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl py-3.5 text-sm font-bold transition-colors min-h-[52px]">
          <Plus size={16} />
          Dodaj dostawę
        </Link>
      </div>

      {/* Cleaning tile */}
      <div className={`rounded-2xl border-2 p-5 ${
        data && data.cleaningCount > 0 ? 'border-cyan-100 bg-white' : 'border-yellow-200 bg-yellow-50/50'
      }`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-cyan-100 rounded-xl">
              <Droplets size={18} className="text-cyan-600" />
            </div>
            <span className="font-bold text-gray-900">Mycie i dezynfekcja</span>
          </div>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
            data && data.cleaningCount > 0 ? 'bg-cyan-100 text-cyan-700' : 'bg-yellow-100 text-yellow-700'
          }`}>
            {data ? `${data.cleaningCount} dziś` : '–'}
          </span>
        </div>

        {data?.lastCleaning ? (
          <p className="text-sm text-gray-600 mb-4">
            Ostatni: <span className="font-medium text-gray-900">{data.lastCleaning.area}</span>
            <span className="text-gray-500"> · {data.lastCleaning.agent}</span>
          </p>
        ) : (
          <p className="text-sm text-gray-400 mb-4">Brak wpisów mycia dzisiaj.</p>
        )}

        <Link href="/mycie"
          className="w-full flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl py-3.5 text-sm font-bold transition-colors min-h-[52px]">
          <Plus size={16} />
          Dodaj mycie
        </Link>
      </div>

      {/* Quick access */}
      <div className="card">
        <p className="text-sm font-semibold text-gray-700 mb-3">Pozostałe moduły</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { href: '/niezgodnosci', label: 'Niezgodności', color: 'text-orange-600' },
            { href: '/szkolenia', label: 'Szkolenia', color: 'text-indigo-600' },
            { href: '/orzeczenia', label: 'Orzeczenia', color: 'text-purple-600' },
            { href: '/raporty', label: 'Raporty PDF', color: 'text-gray-600' },
          ].map(({ href, label, color }) => (
            <Link key={href} href={href}
              className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
              <span className={`text-sm font-medium ${color}`}>{label}</span>
              <ChevronRight size={14} className="text-gray-300" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
