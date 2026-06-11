import { formatDate, getTodayDateStr } from './utils'

// Polish day names, Monday-first (0=Poniedziałek..6=Niedziela) — matches the cleaning_tasks convention.
export const WASTE_DAYS = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela']

export type WasteFrequency = 'weekly' | 'biweekly' | 'monthly' | 'once'

export const WASTE_FREQUENCY_LABELS: Record<WasteFrequency, string> = {
  weekly: 'Co tydzień',
  biweekly: 'Co dwa tygodnie',
  monthly: 'Co miesiąc',
  once: 'Jednorazowo',
}

export interface WasteScheduleItem {
  id: string
  waste_type: string
  frequency: WasteFrequency
  day_of_week: number | null
  day_of_month: number | null
  specific_date: string | null
  anchor_date: string | null
  notes?: string | null
}

/** Day-of-week for a YYYY-MM-DD date string, 0=Monday..6=Sunday. */
function dowForDateStr(dateStr: string): number {
  const jsDay = new Date(`${dateStr}T12:00:00Z`).getUTCDay() // 0=Sunday..6=Saturday
  return jsDay === 0 ? 6 : jsDay - 1
}

/** Whether a schedule item has a pickup on the given YYYY-MM-DD date. */
export function isScheduledOn(item: WasteScheduleItem, dateStr: string): boolean {
  switch (item.frequency) {
    case 'once':
      return item.specific_date === dateStr
    case 'weekly':
      return item.day_of_week !== null && dowForDateStr(dateStr) === item.day_of_week
    case 'biweekly': {
      if (item.day_of_week === null || dowForDateStr(dateStr) !== item.day_of_week) return false
      if (!item.anchor_date) return true
      const anchor = new Date(`${item.anchor_date}T12:00:00Z`).getTime()
      const target = new Date(`${dateStr}T12:00:00Z`).getTime()
      const diffDays = Math.round((target - anchor) / 86400000)
      return ((diffDays % 14) + 14) % 14 === 0
    }
    case 'monthly':
      return item.day_of_month !== null && Number(dateStr.slice(8, 10)) === item.day_of_month
    default:
      return false
  }
}

/** Schedule items with a pickup on the given YYYY-MM-DD date. */
export function scheduledItemsForDate(items: WasteScheduleItem[], dateStr: string): WasteScheduleItem[] {
  return items.filter(i => isScheduledOn(i, dateStr))
}

/** Human-readable (Polish) description of a schedule item's recurrence. */
export function describeWasteSchedule(item: Pick<WasteScheduleItem, 'frequency' | 'day_of_week' | 'day_of_month' | 'specific_date'>): string {
  switch (item.frequency) {
    case 'weekly':
      return item.day_of_week !== null ? `Co tydzień — ${WASTE_DAYS[item.day_of_week]}` : WASTE_FREQUENCY_LABELS.weekly
    case 'biweekly':
      return item.day_of_week !== null ? `Co dwa tygodnie — ${WASTE_DAYS[item.day_of_week]}` : WASTE_FREQUENCY_LABELS.biweekly
    case 'monthly':
      return item.day_of_month !== null ? `Co miesiąc, ${item.day_of_month}. dnia miesiąca` : WASTE_FREQUENCY_LABELS.monthly
    case 'once':
      return item.specific_date ? `Jednorazowo: ${formatDate(item.specific_date)}` : WASTE_FREQUENCY_LABELS.once
    default:
      return ''
  }
}

/** Group schedule items by waste type, preserving first-seen order. */
export function groupByWasteType<T extends { waste_type: string }>(items: T[]): { waste_type: string; items: T[] }[] {
  const order: string[] = []
  const map = new Map<string, T[]>()
  for (const it of items) {
    if (!map.has(it.waste_type)) {
      map.set(it.waste_type, [])
      order.push(it.waste_type)
    }
    map.get(it.waste_type)!.push(it)
  }
  return order.map(waste_type => ({ waste_type, items: map.get(waste_type)! }))
}

/** Human-readable (Polish) summary for a group of schedule items of the same waste type
 *  — combines multiple weekly/biweekly weekdays and/or many "once" calendar dates into one line. */
export function summarizeScheduleGroup(items: Pick<WasteScheduleItem, 'frequency' | 'day_of_week' | 'day_of_month' | 'specific_date'>[]): string {
  const parts: string[] = []

  const byRecurringFreq = new Map<'weekly' | 'biweekly', number[]>()
  for (const it of items) {
    if ((it.frequency === 'weekly' || it.frequency === 'biweekly') && it.day_of_week !== null) {
      const arr = byRecurringFreq.get(it.frequency) ?? []
      arr.push(it.day_of_week)
      byRecurringFreq.set(it.frequency, arr)
    } else if (it.frequency === 'monthly') {
      parts.push(describeWasteSchedule(it))
    }
  }
  byRecurringFreq.forEach((days, freq) => {
    const label = freq === 'weekly' ? 'Co tydzień' : 'Co dwa tygodnie'
    const dayNames = Array.from(new Set(days)).sort((a, b) => a - b).map(d => WASTE_DAYS[d])
    parts.push(`${label} — ${dayNames.join(', ')}`)
  })

  const onceDates = items.filter(i => i.frequency === 'once' && i.specific_date).map(i => i.specific_date as string).sort()
  if (onceDates.length === 1) {
    parts.push(`Jednorazowo: ${formatDate(onceDates[0])}`)
  } else if (onceDates.length > 1) {
    const today = getTodayDateStr()
    const next = onceDates.find(d => d >= today) ?? onceDates[onceDates.length - 1]
    parts.push(`${onceDates.length} terminów w harmonogramie (najbliższy: ${formatDate(next)})`)
  }

  return parts.join(' • ')
}
