import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import {
  Thermometer, Truck, Droplets, AlertTriangle, ChevronRight, CheckCircle2,
  GraduationCap, Stethoscope, FileText, Apple, Bug, Sun, Moon,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { getTodayStart, getTodayEnd, getTodaySplit, isTemperatureOk, cn } from '@/lib/utils'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { GettingStarted, type OnboardingStep } from '@/components/onboarding/getting-started'
import { getCurrentProfile, getCurrentPermissions } from '@/lib/get-profile'
import type { PermissionKey } from '@/lib/permissions'

// Maps dashboard "Priorytety na dziś" links to the permission required to see them
const PRIORITY_PERMISSIONS: Record<string, PermissionKey> = {
  '/temperatury': 'temperatures',
  '/niezgodnosci': 'nonconformities',
  '/mycie': 'cleaning',
  '/dostawy': 'deliveries',
}

async function getDashboardData(locationId: string) {
  const supabase = createClient()
  const todayStart = getTodayStart()
  const todayEnd = getTodayEnd()

  const [allTempLogsRes, deliveryLogs, cleaningLogs, nonconformities, devicesRes, cleaningTasksRes, completedTaskIdsRes, locationRes] = await Promise.all([
    // fetch recent logs (not just today) to determine current alarm status per device
    supabase.from('temperature_logs').select('*').eq('location_id', locationId)
      .order('measured_at', { ascending: false }).limit(300),
    supabase.from('delivery_logs').select('*').eq('location_id', locationId).gte('received_at', todayStart).lte('received_at', todayEnd).order('received_at', { ascending: false }),
    supabase.from('cleaning_logs').select('id,area,agent,cleaned_at').eq('location_id', locationId).gte('cleaned_at', todayStart).lte('cleaned_at', todayEnd).order('cleaned_at', { ascending: false }),
    supabase.from('nonconformities').select('id').eq('location_id', locationId).eq('status', 'open'),
    supabase.from('location_devices').select('id,name,min_ok,max_ok').eq('location_id', locationId),
    supabase.from('cleaning_tasks').select('id,frequency,day_of_week,day_of_month').eq('location_id', locationId).eq('is_active', true),
    supabase.from('cleaning_logs').select('cleaning_task_id').eq('location_id', locationId).gte('cleaned_at', todayStart).not('cleaning_task_id', 'is', null),
    supabase.from('locations').select('temp_checks_per_day, temp_check_split_hour').eq('id', locationId).single(),
  ])

  const allTempLogs = allTempLogsRes.data ?? []
  const dLogs = deliveryLogs.data ?? []
  const cLogs = cleaningLogs.data ?? []
  const checksPerDay = locationRes.data?.temp_checks_per_day ?? 1
  const splitHour = locationRes.data?.temp_check_split_hour ?? 14
  const splitTime = new Date(getTodaySplit(splitHour)).getTime()
  const pmDue = Date.now() >= splitTime

  // Build set of all device names (registered + orphan) — same logic as temperatures page
  const registeredNames = new Set((devicesRes.data ?? []).map(d => d.name as string))
  const allDeviceNames = new Set<string>(
    Array.from(registeredNames).concat(allTempLogs.map(l => l.device_name as string))
  )

  const todayStartDate = new Date(todayStart)

  // Per-device: last log + today count (or AM/PM counts when checking twice daily)
  let checkedDevices = 0
  let tempAlarms = 0
  let missingAm = 0
  let missingPm = 0
  for (const name of Array.from(allDeviceNames)) {
    const dv = (devicesRes.data ?? []).find(d => d.name === name)
    const logs = allTempLogs.filter(l => l.device_name === name)
    const lastLog = logs[0] ?? null
    const todayLogs = logs.filter(l => new Date(l.measured_at) >= todayStartDate)
    if (checksPerDay === 2) {
      const amCount = todayLogs.filter(l => new Date(l.measured_at).getTime() < splitTime).length
      const pmCount = todayLogs.filter(l => new Date(l.measured_at).getTime() >= splitTime).length
      if (amCount === 0) missingAm++
      if (pmDue && pmCount === 0) missingPm++
      if (amCount > 0 && (!pmDue || pmCount > 0)) checkedDevices++
    } else {
      if (todayLogs.length > 0) checkedDevices++
    }
    if (lastLog) {
      const min = dv?.min_ok ?? lastLog.min_ok
      const max = dv?.max_ok ?? lastLog.max_ok
      if (!isTemperatureOk(lastLog.temperature, min, max)) tempAlarms++
    }
  }

  const totalDevices = allDeviceNames.size

  const lastDelivery = dLogs[0] ?? null
  const lastCleaning = cLogs[0] ?? null

  // Count cleaning tasks due today that haven't been completed
  const completedTaskIds = new Set(
    (completedTaskIdsRes.data ?? []).map((r: { cleaning_task_id: string }) => r.cleaning_task_id)
  )
  const now = new Date()
  const todayDow = now.getDay() === 0 ? 6 : now.getDay() - 1
  const todayDom = now.getDate()
  let pendingCleaningTasks = 0
  for (const t of (cleaningTasksRes.data ?? [])) {
    if (completedTaskIds.has(t.id)) continue
    const due = t.frequency === 'daily' ||
      (t.frequency === 'weekly'  && t.day_of_week  === todayDow) ||
      (t.frequency === 'monthly' && t.day_of_month === todayDom)
    if (due) pendingCleaningTasks++
  }

  return {
    totalDevices,
    checkedDevices,
    tempProgress: totalDevices > 0 ? Math.round((checkedDevices / totalDevices) * 100) : 0,
    tempAlarms,
    checksPerDay,
    splitHour,
    missingAm,
    missingPm,
    pmDue,
    deliveryCount: dLogs.length,
    lastDelivery,
    cleaningCount: cLogs.length,
    lastCleaning,
    pendingCleaningTasks,
    openNonconformities: nonconformities.data?.length ?? 0,
    hasRegisteredDevices: (devicesRes.data ?? []).length > 0,
    hasTemperatureLog: allTempLogs.length > 0,
  }
}

export default async function DashboardPage() {
  const supabase = createClient()
  const [profileResult, permissions] = await Promise.all([
    getCurrentProfile(),
    getCurrentPermissions(),
  ])
  const user = profileResult?.user
  const profile = profileResult?.profile

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
      id: 'devices',
      label: 'Dodaj urządzenia chłodnicze',
      description: 'Zarejestruj lodówki i zamrażarki do monitorowania temperatur',
      done: !!data?.hasRegisteredDevices,
      href: '/temperatury',
      ctaLabel: 'Dodaj urządzenie',
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

  const firstName = profile?.full_name?.trim().split(/\s+/)[0] || null
  const initial = (firstName ?? user?.email ?? 'U')[0]?.toUpperCase() ?? 'U'

  interface Priority {
    id: string
    icon: LucideIcon
    iconClass: string
    bgClass: string
    label: string
    href: string
  }

  const priorities: Priority[] = []
  if (data) {
    if (data.tempAlarms > 0) {
      priorities.push({
        id: 'temp-alarm', icon: Thermometer, iconClass: 'text-red-500', bgClass: 'bg-red-50',
        label: `Alarmy temperatur (${data.tempAlarms})`, href: '/temperatury',
      })
    }
    if (data.checksPerDay === 2 && data.totalDevices > 0) {
      const amDone = data.missingAm === 0
      priorities.push({
        id: 'temp-am',
        icon: Sun,
        iconClass: amDone ? 'text-brand-green' : 'text-orange-500',
        bgClass: amDone ? 'bg-green-50' : 'bg-orange-50',
        label: amDone
          ? `Poranny odczyt temperatur — wykonano (${data.totalDevices}/${data.totalDevices})`
          : `Poranny odczyt temperatur — do wpisania (${data.missingAm}/${data.totalDevices})`,
        href: '/temperatury',
      })

      if (!data.pmDue) {
        priorities.push({
          id: 'temp-pm',
          icon: Moon, iconClass: 'text-gray-400', bgClass: 'bg-gray-100',
          label: `Popołudniowy odczyt temperatur — od godziny ${String(data.splitHour).padStart(2, '0')}:00`,
          href: '/temperatury',
        })
      } else {
        const pmDone = data.missingPm === 0
        priorities.push({
          id: 'temp-pm',
          icon: Moon,
          iconClass: pmDone ? 'text-brand-green' : 'text-orange-500',
          bgClass: pmDone ? 'bg-green-50' : 'bg-orange-50',
          label: pmDone
            ? `Popołudniowy odczyt temperatur — wykonano (${data.totalDevices}/${data.totalDevices})`
            : `Popołudniowy odczyt temperatur — do wpisania (${data.missingPm}/${data.totalDevices})`,
          href: '/temperatury',
        })
      }
    } else if (data.checksPerDay !== 2) {
      const missing = data.totalDevices - data.checkedDevices
      if (missing > 0) {
        priorities.push({
          id: 'temp-missing', icon: Thermometer, iconClass: 'text-orange-500', bgClass: 'bg-orange-50',
          label: missing === 1 ? '1 temperatura do wpisania' : `Temperatury do wpisania (${missing})`,
          href: '/temperatury',
        })
      }
    }
    if (data.openNonconformities > 0) {
      priorities.push({
        id: 'nonconf', icon: AlertTriangle, iconClass: 'text-orange-500', bgClass: 'bg-orange-50',
        label: `Otwarte niezgodności (${data.openNonconformities})`, href: '/niezgodnosci',
      })
    }
    if (data.pendingCleaningTasks > 0) {
      priorities.push({
        id: 'pending-cleaning', icon: Droplets, iconClass: 'text-orange-500', bgClass: 'bg-orange-50',
        label: data.pendingCleaningTasks === 1
          ? '1 zadanie mycia niewykonane'
          : `Zadania mycia do wykonania (${data.pendingCleaningTasks})`,
        href: '/mycie',
      })
    } else if (data.cleaningCount === 0) {
      priorities.push({
        id: 'no-cleaning', icon: Droplets, iconClass: 'text-orange-500', bgClass: 'bg-orange-50',
        label: 'Brak wpisów mycia dzisiaj', href: '/mycie',
      })
    }
    if (data.deliveryCount === 0) {
      priorities.push({
        id: 'no-delivery', icon: Truck, iconClass: 'text-gray-400', bgClass: 'bg-gray-100',
        label: 'Brak dostaw dzisiaj', href: '/dostawy',
      })
    }
  }

  const QUICK_ACTIONS_ALL: { href: string; label: string; icon: LucideIcon; permission: PermissionKey }[] = [
    { href: '/temperatury', label: 'Dodaj temperaturę', icon: Thermometer, permission: 'temperatures' },
    { href: '/dostawy/nowa', label: 'Dodaj dostawę', icon: Truck, permission: 'deliveries' },
    { href: '/mycie', label: 'Dodaj mycie', icon: Droplets, permission: 'cleaning' },
    { href: '/niezgodnosci', label: 'Zgłoś niezgodność', icon: AlertTriangle, permission: 'nonconformities' },
  ]
  const QUICK_ACTIONS = QUICK_ACTIONS_ALL.filter(a => permissions[a.permission])

  interface ModuleStatus {
    id: string
    icon: LucideIcon
    title: string
    href: string
    cta: string
    badgeVariant: 'ok' | 'warn' | 'error' | 'neutral'
    badgeLabel: string
    description: string
    permission: PermissionKey
  }

  const moduleStatusAll: ModuleStatus[] = data ? [
    {
      id: 'temperatury', icon: Thermometer, title: 'Temperatury', href: '/temperatury', cta: 'Dodaj temperaturę',
      badgeVariant: data.totalDevices === 0 ? 'neutral' : data.tempAlarms > 0 ? 'error' : data.checkedDevices === data.totalDevices ? 'ok' : 'warn',
      badgeLabel: data.totalDevices === 0 ? 'Brak' : data.tempAlarms > 0 ? 'Alarm' : data.checkedDevices === data.totalDevices ? 'OK' : 'Braki',
      description: data.totalDevices === 0 ? 'Brak zarejestrowanych urządzeń' : `Sprawdzone ${data.checkedDevices}/${data.totalDevices} dziś`,
      permission: 'temperatures',
    },
    {
      id: 'dostawy', icon: Truck, title: 'Dostawy', href: '/dostawy/nowa', cta: 'Dodaj dostawę',
      badgeVariant: data.deliveryCount > 0 ? 'ok' : 'neutral',
      badgeLabel: data.deliveryCount > 0 ? `${data.deliveryCount} dziś` : 'Brak',
      description: data.lastDelivery ? `Ostatnia: ${data.lastDelivery.supplier}` : 'Brak dostaw dzisiaj',
      permission: 'deliveries',
    },
    {
      id: 'mycie', icon: Droplets, title: 'Mycie i dezynfekcja', href: '/mycie', cta: 'Dodaj mycie',
      badgeVariant: data.pendingCleaningTasks > 0 ? 'warn' : data.cleaningCount > 0 ? 'ok' : 'neutral',
      badgeLabel: data.pendingCleaningTasks > 0 ? `${data.pendingCleaningTasks} zad.` : data.cleaningCount > 0 ? 'OK' : 'Brak',
      description: data.pendingCleaningTasks > 0
        ? `${data.pendingCleaningTasks} zadań do wykonania dziś`
        : data.lastCleaning ? `Ostatnie: ${data.lastCleaning.area}` : 'Brak wpisów dzisiaj',
      permission: 'cleaning',
    },
  ] : []
  const moduleStatus = moduleStatusAll.filter(m => permissions[m.permission])

  const OTHER_MODULES_ALL: { href: string; label: string; icon: LucideIcon; permission: PermissionKey }[] = [
    { href: '/niezgodnosci', label: 'Niezgodności', icon: AlertTriangle, permission: 'nonconformities' },
    { href: '/szkolenia', label: 'Szkolenia', icon: GraduationCap, permission: 'training' },
    { href: '/orzeczenia', label: 'Orzeczenia', icon: Stethoscope, permission: 'certificates' },
    { href: '/raporty', label: 'Raporty PDF', icon: FileText, permission: 'reports' },
    { href: '/alergeny', label: 'Alergeny', icon: Apple, permission: 'allergens' },
    { href: '/ddd', label: 'Kontrola DDD', icon: Bug, permission: 'ddd' },
  ]
  const OTHER_MODULES = OTHER_MODULES_ALL.filter(m => permissions[m.permission])

  const visiblePriorities = priorities.filter(p => {
    const key = PRIORITY_PERMISSIONS[p.href]
    return !key || permissions[key]
  })

  return (
    <div className="space-y-4">
      {/* Compact greeting header */}
      <div className="card flex items-center gap-3">
        <div className="w-11 h-11 rounded-full bg-brand-green/15 flex items-center justify-center shrink-0">
          <span className="text-brand-green font-bold">{initial}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-gray-900 truncate">Dzień dobry{firstName ? `, ${firstName}` : ''}</p>
          <p className="text-xs text-gray-500 truncate">{locationName} • {dateStr}</p>
        </div>
        <Badge variant={todoCount > 0 ? 'warn' : 'ok'} className="shrink-0 px-2.5 py-1 text-xs font-bold">
          {todoCount > 0 ? `Do wykonania: ${todoCount}` : 'Wszystko OK'}
        </Badge>
      </div>

      <GettingStarted steps={onboardingSteps} />

      {/* Priorytety na dziś */}
      <div className="card">
        <p className="font-bold text-gray-900 text-sm mb-1">Priorytety na dziś</p>
        {visiblePriorities.length > 0 ? (
          <div className="divide-y divide-gray-50">
            {visiblePriorities.map(p => (
              <Link key={p.id} href={p.href} className="flex items-center gap-3 py-3 first:pt-2 last:pb-1 group">
                <div className={cn('p-2 rounded-lg shrink-0', p.bgClass)}>
                  <p.icon size={16} className={p.iconClass} />
                </div>
                <span className="text-sm text-gray-700 flex-1 min-w-0">{p.label}</span>
                <ChevronRight size={16} className="text-gray-300 shrink-0 group-hover:text-gray-400 transition-colors" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-3 py-2">
            <div className="p-2 rounded-lg bg-green-50 shrink-0">
              <CheckCircle2 size={16} className="text-brand-green" />
            </div>
            <span className="text-sm text-gray-500">Brak pilnych spraw — wszystko w porządku</span>
          </div>
        )}
      </div>

      {/* Szybkie akcje */}
      {QUICK_ACTIONS.length > 0 && (
        <div className="card">
          <p className="font-bold text-gray-900 text-sm mb-3">Szybkie akcje</p>
          <div className="grid grid-cols-4 gap-2">
            {QUICK_ACTIONS.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-gray-100 py-3 px-1 text-center hover:border-brand-navy/30 hover:bg-brand-navy/5 active:scale-[0.97] transition-all">
                <div className="p-2 bg-brand-navy/10 rounded-lg">
                  <Icon size={16} className="text-brand-navy" />
                </div>
                <span className="text-[11px] font-semibold text-gray-700 leading-tight">{label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Status modułów */}
      {moduleStatus.length > 0 && (
        <div>
          <p className="font-bold text-gray-900 text-sm mb-2">Status modułów</p>
          <div className="grid grid-cols-3 gap-2">
            {moduleStatus.map(m => (
              <div key={m.id} className="rounded-xl border border-gray-100 bg-white p-3 flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <m.icon size={14} className="text-brand-navy shrink-0" />
                  <span className="text-xs font-bold text-gray-900 truncate">{m.title}</span>
                </div>
                <Badge variant={m.badgeVariant} className="w-fit text-[10px] px-1.5 py-0.5">{m.badgeLabel}</Badge>
                <p className="text-[11px] text-gray-500 leading-snug line-clamp-2 flex-1">{m.description}</p>
                <Link href={m.href} className="text-[11px] font-semibold text-brand-green hover:underline">
                  {m.cta} →
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pozostałe moduły */}
      {OTHER_MODULES.length > 0 && (
        <div className="card">
          <p className="font-bold text-gray-900 text-sm mb-3">Pozostałe moduły</p>
          <div className="grid grid-cols-2 gap-2">
            {OTHER_MODULES.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href}
                className="flex items-center gap-2.5 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                <div className="p-1.5 bg-brand-navy/10 rounded-lg shrink-0">
                  <Icon size={14} className="text-brand-navy" />
                </div>
                <span className="text-sm font-medium text-gray-700 truncate flex-1 min-w-0">{label}</span>
                <ChevronRight size={14} className="text-gray-300 shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
