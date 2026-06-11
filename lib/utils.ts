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

export function getTodayStart() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export function getTodayEnd() {
  const d = new Date()
  d.setHours(23, 59, 59, 999)
  return d.toISOString()
}

/** Today's timestamp at the given hour — used to split AM/PM temperature-check windows. */
export function getTodaySplit(hour: number) {
  const d = new Date()
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}
