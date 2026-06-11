import { formatDate } from './utils'

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
