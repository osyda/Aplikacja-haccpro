import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Thermometer, Truck, Droplets, Plus, ChevronRight } from 'lucide-react'
import { getTodayStart, getTodayEnd, isTemperatureOk } from '@/lib/utils'
import { PageHeader } from '@/components/ui/page-header'
import { AlertBox } from '@/components/ui/alert-box'
import { Badge } from '@/components/ui/badge'
import { GettingStarted, type OnboardingStep } from '@/components/onboarding/getting-started'
import { cn } from '@/lib/utils'

async function getDashboardData(locationId: string) {
  const supabase = createClient()
  const todayStart = getTodayStart()
  const todayEnd = getTodayEnd()

  const [allTempLogsRes, deliveryLogs, cleaningLogs, nonconformities, devicesRes] = await Promise.all([
    // fetch recent logs (not just today) to determine current alarm status per device
    supabase.from('temperature_logs').select('*').eq('location_id', locationId)
      .order('measured_at', { ascending: false }).limit(300),
    supabase.from('delivery_logs').select('*').eq('location_id', locationId).gte('received_at', todayStart).lte('received_at', todayEnd).order('received_at', { ascending: false }),
    supabase.from('cleaning_logs').select('id,area,agent,cleaned_at').eq('location_id', locationId).gte('cleaned_at', todayStart).lte('cleaned_at', todayEnd).order('cleaned_at', { ascending: false }),
    supabase.from('nonconformities').select('id').eq('location_id', locationId).eq('status', 'open'),
    supabase.from('location_devices').select('id,name,min_ok,max_ok').eq('location_id', locationId),
  ])

  const allTempLogs = allTempLogsRes.data ?? []
  const dLogs = deliveryLogs.data ?? []
  const cLogs = cleaningLogs.data ?? []

  // Build set of all device names (registered + orphan) — same logic as temperatures page
  const registeredNames = new Set((devicesRes.data ?? []).map(d => d.name as string))
  const allDeviceNames = new Set<string>(
    Array.from(registeredNames).concat(allTempLogs.map(l => l.device_name as string))
  )

  const todayStartDate = new Date(todayStart)

  // Per-device: last log + today count
  let checkedDevices = 0
  let tempAlarms = 0
  for (const name of Array.from(allDeviceNames)) {
    const dv = (devicesRes.data ?? []).find(d => d.name === name)
    const logs = allTempLogs.filter(l => l.device_name === name)
    const lastLog = logs[0] ?? null
    const todayCount = logs.filter(l => new Date(l.measured_at) >= todayStartDate).length
    if (todayCount > 0) checkedDevices++
    if (lastLog) {
      const min = dv?.min_ok ?? lastLog.min_ok
      const max = dv?.max_ok ?? lastLog.max_ok
      if (!isTemperatureOk(lastLog.temperature, min, max)) tempAlarms++
    }
  }

  const totalDevices = allDeviceNames.size

  const lastDelivery = dLogs[0] ?? null
  const lastCleaning = cLogs[0] ?? null

  return {
    totalDevices,
    checkedDevices,
    tempProgress: totalDevices > 0 ? Math.round((checkedDevices / totalDevices) * 100) : 0,
    tempAlarms,
    deliveryCount: dLogs.length,
    lastDelivery,
    cleaningCount: cLogs.length,
    lastCleaning,
    openNonconformities: nonconformities.data?.length ?? 0,
    hasRegisteredDevices: (devicesRes.data ?? []).length > 0,
    hasTemperatureLog: allTempLogs.length > 0,
  }
}

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('location_id, org_id, locations(name)')
    .eq('id', user!.id)
    .single()

  const locationId = profile?.location_id ?? ''
  const locRaw = profile?.locations
  const locationName = (locRaw && !Array.isArray(locRaw) ? (locRaw as { name: string }) : null)?.name ?? 'Mój lokal'
  const data = locationId ? await getDashboardData(locationId) : null

  const { count: staffCount } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', profile?.org_id ?? '')

  const onboardingSteps: OnboardingStep[] = [
    {
      id: 'location',
      label: 'Dodaj swój lokal',
      description: 'Skonfiguruj dane lokalu gastronomicznego',
      done: !!locationId,
      href: '/ustawienia/lokale',
      ctaLabel: 'Dodaj lokal',
    },
    {
      id: 'staff',
      label: 'Zaproś pracowników',
      description: 'Dodaj członków zespołu i przydziel im role',
      done: (staffCount ?? 0) > 1,
      href: '/ustawienia/pracownicy',
      ctaLabel: 'Zaproś pracownika',
    },
    {
      id: 'devices',
      label: 'Dodaj urządzenia chłodnicze',
      description: 'Zarejestruj lodówki i zamrażarki do monitorowania temperatur',
      done: !!data?.hasRegisteredDevices,
      href: '/temperatury',
      ctaLabel: 'Dodaj urządzenie',
    },
    {
      id: 'reading',
      label: 'Zarejestruj pierwszy odczyt',
      description: 'Wykonaj pierwszy pomiar temperatury i zapisz go w systemie',
      done: !!data?.hasTemperatureLog,
      href: '/temperatury',
      ctaLabel: 'Zapisz odczyt',
    },
  ]

  const today = new Date()
  const dateStrRaw = today.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const dateStr = dateStrRaw.charAt(0).toUpperCase() + dateStrRaw.slice(1)

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
      <div className="space-y-5">
        <PageHeader title="Witaj w HACCPro" subtitle={dateStr} />
        <GettingStarted steps={onboardingSteps} />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={locationName}
        subtitle={dateStr}
        action={
          todoCount > 0 ? (
            <Badge variant="warn" className="px-3 py-1.5 text-xs font-bold">Do wykonania: {todoCount}</Badge>
          ) : (
            <Badge variant="ok" className="px-3 py-1.5 text-xs font-bold">Wszystko OK</Badge>
          )
        }
      />

      <GettingStarted steps={onboardingSteps} />

      {/* Priorytety na dziś */}
      {data && data.tempAlarms > 0 && (
        <AlertBox
          variant="error"
          title={`Alarmy temperatur (${data.tempAlarms})`}
          description="Sprawdź urządzenia z przekroczoną normą"
          action={<Link href="/temperatury" className="text-xs text-red-700 font-semibold hover:underline">Przejdź →</Link>}
        />
      )}

      {data && data.openNonconformities > 0 && (
        <AlertBox
          variant="warning"
          title={`Otwarte niezgodności (${data.openNonconformities})`}
          description="Wymagają zamknięcia lub działania korygującego"
          action={<Link href="/niezgodnosci" className="text-xs text-orange-700 font-semibold hover:underline">Przejdź →</Link>}
        />
      )}

      {/* Temperature tile */}
      <div className={cn('rounded-2xl border-2 p-5',
        data && data.tempAlarms > 0
          ? 'border-red-200 bg-red-50'
          : data && data.checkedDevices === data.totalDevices && data.totalDevices > 0
          ? 'border-green-200 bg-green-50'
          : 'border-gray-100 bg-white'
      )}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-brand-navy/10 rounded-xl">
              <Thermometer size={18} className="text-brand-navy" />
            </div>
            <span className="font-bold text-gray-900">Temperatury</span>
          </div>
          <Badge variant={
            !data || data.totalDevices === 0 ? 'neutral'
            : data.tempAlarms > 0 ? 'error'
            : data.checkedDevices === data.totalDevices ? 'ok'
            : 'warn'
          } className="px-2.5 py-1 font-bold">
            {data
              ? data.totalDevices === 0 ? 'Brak urządzeń'
              : data.tempAlarms > 0 ? `${data.tempAlarms} alarm${data.tempAlarms > 1 ? 'y' : ''}`
              : data.checkedDevices === data.totalDevices ? 'Wszystkie OK'
              : 'Do uzupełnienia'
              : '–'}
          </Badge>
        </div>

        {data && data.totalDevices > 0 && (
          <>
            <p className="text-sm text-gray-600 mb-2">
              Sprawdzone: <span className="font-bold text-gray-900">{data.checkedDevices}/{data.totalDevices}</span> urządzeń
            </p>
            <div className="w-full bg-white/60 rounded-full h-2.5 mb-4 overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all',
                  data.tempAlarms > 0 ? 'bg-red-500'
                  : data.checkedDevices === data.totalDevices ? 'bg-green-500'
                  : 'bg-brand-navy'
                )}
                style={{ width: `${data.tempProgress}%` }}
              />
            </div>
          </>
        )}

        <Link href="/temperatury"
          className="w-full flex items-center justify-center gap-2 bg-brand-green hover:bg-brand-green-dark text-white rounded-xl py-3.5 text-sm font-bold transition-colors min-h-[52px]">
          {data && data.checkedDevices < data.totalDevices ? 'Sprawdź temperatury' : 'Rejestr temperatur'}
          <ChevronRight size={16} />
        </Link>
      </div>

      {/* Deliveries tile */}
      <div className="rounded-2xl border-2 border-gray-100 bg-white p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-brand-navy/10 rounded-xl">
              <Truck size={18} className="text-brand-navy" />
            </div>
            <span className="font-bold text-gray-900">Dostawy</span>
          </div>
          <Badge variant="neutral" className="px-2.5 py-1 font-bold">
            {data ? `${data.deliveryCount} dziś` : '–'}
          </Badge>
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
          className="w-full flex items-center justify-center gap-2 bg-brand-green hover:bg-brand-green-dark text-white rounded-xl py-3.5 text-sm font-bold transition-colors min-h-[52px]">
          <Plus size={16} />
          Dodaj dostawę
        </Link>
      </div>

      {/* Cleaning tile */}
      <div className={cn('rounded-2xl border-2 p-5',
        data && data.cleaningCount > 0 ? 'border-gray-100 bg-white' : 'border-yellow-200 bg-yellow-50/50'
      )}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-brand-navy/10 rounded-xl">
              <Droplets size={18} className="text-brand-navy" />
            </div>
            <span className="font-bold text-gray-900">Mycie i dezynfekcja</span>
          </div>
          <Badge variant={data && data.cleaningCount > 0 ? 'neutral' : 'warn'} className="px-2.5 py-1 font-bold">
            {data ? `${data.cleaningCount} dziś` : '–'}
          </Badge>
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
          className="w-full flex items-center justify-center gap-2 bg-brand-green hover:bg-brand-green-dark text-white rounded-xl py-3.5 text-sm font-bold transition-colors min-h-[52px]">
          <Plus size={16} />
          Dodaj mycie
        </Link>
      </div>

      {/* Quick access */}
      <div className="card">
        <p className="text-sm font-semibold text-gray-700 mb-3">Pozostałe moduły</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { href: '/niezgodnosci', label: 'Niezgodności' },
            { href: '/szkolenia', label: 'Szkolenia' },
            { href: '/orzeczenia', label: 'Orzeczenia' },
            { href: '/raporty', label: 'Raporty PDF' },
          ].map(({ href, label }) => (
            <Link key={href} href={href}
              className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
              <span className="text-sm font-medium text-gray-700">{label}</span>
              <ChevronRight size={14} className="text-gray-300" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
