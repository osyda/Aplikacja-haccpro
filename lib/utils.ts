import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...options,
  }).format(typeof date === 'string' ? new Date(date) : date)
}

export function formatDateTime(date: string | Date) {
  return new Intl.DateTimeFormat('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(typeof date === 'string' ? new Date(date) : date)
}

export function isTemperatureOk(temp: number, min: number, max: number) {
  return temp >= Math.min(min, max) && temp <= Math.max(min, max)
}

/** Combine street + building number + optional unit number into one address line, e.g. "Marszałkowska 10/5". */
export function buildAddressLine(street: string, buildingNo: string, unitNo: string) {
  const base = [street.trim(), buildingNo.trim()].filter(Boolean).join(' ')
  const unit = unitNo.trim()
  return unit ? `${base}/${unit}` : base
}

// The app's reference timezone (Polish locations) — used for "today" boundaries
// so they line up with the user's wall-clock day regardless of the server's TZ.
const APP_TIMEZONE = 'Europe/Warsaw'

/** UTC offset (e.g. "+02:00") of APP_TIMEZONE at the given instant — accounts for DST. */
function getTzOffset(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: APP_TIMEZONE, timeZoneName: 'shortOffset' }).formatToParts(date)
  const raw = parts.find(p => p.type === 'timeZoneName')?.value ?? 'GMT+0'
  const match = raw.match(/GMT([+-]\d+)(?::(\d+))?/)
  const h = match ? parseInt(match[1], 10) : 0
  const m = match?.[2] ? parseInt(match[2], 10) : 0
  const sign = h < 0 ? '-' : '+'
  return `${sign}${String(Math.abs(h)).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** ISO timestamp for a given time on "today", as seen in APP_TIMEZONE. */
function todayAt(hour: number, minute: number, second: number, ms: number): string {
  const now = new Date()
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}.${String(ms).padStart(3, '0')}`
  return new Date(`${ymd}T${time}${getTzOffset(now)}`).toISOString()
}

export function getTodayStart() {
  return todayAt(0, 0, 0, 0)
}

export function getTodayEnd() {
  return todayAt(23, 59, 59, 999)
}

/** Today's timestamp at the given hour — used to split AM/PM temperature-check windows. */
export function getTodaySplit(hour: number) {
  return todayAt(hour, 0, 0, 0)
}
