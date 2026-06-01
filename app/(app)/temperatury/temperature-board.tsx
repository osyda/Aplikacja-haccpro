'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  Thermometer, Plus, CheckCircle2, AlertCircle, Clock,
  ArrowRight, Settings, ChevronRight, Trash2,
} from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { DeviceWithStatus } from './page'

type FilterType = 'all' | 'missing' | 'ok' | 'alarm'

function getDeviceStatus(d: DeviceWithStatus): 'ok' | 'alarm' | 'missing' | 'unchecked' {
  if (d.lastTemp === null) return 'unchecked'
  if (d.todayCount === 0) return 'missing'
  if (d.lastOk === false) return 'alarm'
  return 'ok'
}

function guessQuickValues(min_ok: number, max_ok: number): number[] {
  if (max_ok <= -15) return [-24, -22, -20, -18, -16]
  if (max_ok <= 0) return [-4, -3, -2, -1, 0]
  if (max_ok <= 10) return [0, 1, 2, 3, 4, 5, 6, 7, 8]
  return [-20, -10, 0, 5, 10, 15, 20]
}

const STATUS_STYLE = {
  ok:        { dot: 'bg-green-500',  card: 'border-green-100 bg-white',       badge: 'bg-green-100 text-green-700',   label: 'OK' },
  alarm:     { dot: 'bg-red-500',    card: 'border-red-200 bg-red-50',         badge: 'bg-red-100 text-red-700',       label: 'Poza normą' },
  missing:   { dot: 'bg-yellow-400', card: 'border-yellow-200 bg-yellow-50/40', badge: 'bg-yellow-100 text-yellow-700', label: 'Brak wpisu dziś' },
  unchecked: { dot: 'bg-gray-300',   card: 'border-gray-100 bg-white',         badge: 'bg-gray-100 text-gray-500',     label: 'Nigdy nie sprawdzane' },
}

interface DeviceCardProps {
  device: DeviceWithStatus
  locationId: string
  onSaved: () => void
}

function DeviceCard({ device, locationId, onSaved }: DeviceCardProps) {
  const [open, setOpen] = useState(false)
  const [temp, setTemp] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  const status = getDeviceStatus(device)
  const s = STATUS_STYLE[status]

  const tempNum = temp === '' ? null : parseFloat(temp.replace(',', '.'))
  const hasTemp = tempNum !== null && !isNaN(tempNum)
  const inRange = hasTemp && tempNum >= device.min_ok && tempNum <= device.max_ok
  const outOfRange = hasTemp && !inRange
  const isUnusual = hasTemp && (tempNum < -40 || tempNum > 100)
  const notesRequired = outOfRange

  const quickValues = guessQuickValues(device.min_ok, device.max_ok)

  async function handleSave() {
    if (!hasTemp) { toast.error('Podaj temperaturę'); return }
    if (notesRequired && !notes.trim()) { toast.error('Temperatura poza normą — dodaj uwagę'); return }
    if (isUnusual && !window.confirm(`Ta temperatura (${tempNum}°C) wygląda nietypowo. Czy na pewno zapisać?`)) return

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('temperature_logs').insert({
      location_id: locationId,
      device_name: device.name,
      temperature: tempNum,
      min_ok: device.min_ok,
      max_ok: device.max_ok,
      measured_at: new Date().toISOString(),
      recorded_by: user!.id,
      notes: notes.trim() || null,
    })
    setSaving(false)
    if (error) { toast.error('Błąd zapisu: ' + error.message); return }

    if (inRange) toast.success(`Temperatura zapisana — ${device.name} ${tempNum}°C`)
    else toast.error(`ALARM: ${device.name} ${tempNum}°C poza normą (${device.min_ok}–${device.max_ok}°C)`)

    setTemp('')
    setNotes('')
    setOpen(false)
    onSaved()
  }

  return (
    <div className={cn('rounded-xl border-2 p-4 transition-all', s.card, open && 'shadow-md')}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={cn('w-3 h-3 rounded-full mt-1.5 shrink-0', s.dot)} />
          <div>
            <p className="font-semibold text-gray-900 text-base leading-tight">{device.name}</p>
            <p className="text-xs text-gray-500 mt-0.5">Norma: <span className="font-mono">{device.min_ok} – {device.max_ok}°C</span></p>
            {device.lastTemp !== null && (
              <p className="text-xs text-gray-500 mt-0.5">
                Ostatni: <span className="font-mono font-medium">{device.lastTemp}°C</span>
                {device.lastMeasuredAt && <span className="text-gray-400"> · {formatDateTime(device.lastMeasuredAt)}</span>}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', s.badge)}>{s.label}</span>
          {device.todayCount > 0 && (
            <span className="text-xs text-gray-400">dziś: {device.todayCount}×</span>
          )}
        </div>
      </div>

      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full mt-3 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl py-3 text-sm font-semibold transition-colors min-h-[52px]"
        >
          <Plus size={16} />
          Dodaj temperaturę
        </button>
      ) : (
        <div className="mt-4 space-y-4 border-t border-gray-100 pt-4">
          <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
            <Thermometer size={13} />
            Norma: <span className="font-mono font-semibold">{device.min_ok} – {device.max_ok}°C</span>
          </div>

          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Szybki wybór:</p>
            <div className="flex flex-wrap gap-2">
              {quickValues.map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setTemp(String(v))}
                  className={cn(
                    'px-3.5 py-2 rounded-xl text-sm font-mono font-semibold border-2 transition-colors min-h-[44px]',
                    temp === String(v)
                      ? 'border-blue-500 bg-blue-600 text-white'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300'
                  )}
                >
                  {v > 0 ? '+' : ''}{v}°
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Temperatura (°C)</label>
            <input
              type="number"
              step="0.1"
              inputMode="decimal"
              placeholder="wpisz lub wybierz powyżej"
              className="input font-mono text-2xl text-center py-3 h-14"
              value={temp}
              onChange={e => setTemp(e.target.value)}
              autoFocus
            />
          </div>

          {hasTemp && (
            <div className={cn(
              'flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold border-2',
              inRange
                ? 'bg-green-50 text-green-700 border-green-200'
                : 'bg-red-50 text-red-700 border-red-200'
            )}>
              {inRange
                ? <><CheckCircle2 size={16} /> Temperatura w normie</>
                : <><AlertCircle size={16} /> Poza normą — dodaj uwagę poniżej</>}
            </div>
          )}

          <div>
            <label className="label">
              Uwagi{notesRequired
                ? <span className="text-red-500 ml-1">*wymagane</span>
                : <span className="text-gray-400 font-normal ml-1">(opcjonalne)</span>}
            </label>
            <input
              className="input"
              placeholder={notesRequired ? 'Opisz przyczynę i podjęte działania...' : 'Dodatkowe informacje...'}
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !hasTemp || (notesRequired && !notes.trim())}
              className={cn(
                'flex-1 py-3.5 rounded-xl text-sm font-bold text-white transition-colors min-h-[52px]',
                saving || !hasTemp || (notesRequired && !notes.trim())
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
              )}
            >
              {saving ? 'Zapisywanie…' : 'Zapisz temperaturę'}
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setTemp(''); setNotes('') }}
              className="px-4 py-3.5 rounded-xl text-sm font-medium text-gray-600 border-2 border-gray-200 hover:bg-gray-50 min-h-[52px]"
            >
              Anuluj
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function DeviceManager({ locationId, onChanged }: { locationId: string; onChanged: () => void }) {
  const [devices, setDevices] = useState<Array<{ id: string; name: string; min_ok: number; max_ok: number }>>([])
  const [loaded, setLoaded] = useState(false)
  const [newDev, setNewDev] = useState({ name: '', min: '0', max: '4' })
  const supabase = createClient()

  async function load() {
    const { data } = await supabase.from('location_devices').select('*').eq('location_id', locationId).order('created_at')
    setDevices(data ?? [])
    setLoaded(true)
  }

  async function addDevice() {
    if (!newDev.name.trim()) { toast.error('Podaj nazwę urządzenia'); return }
    const { error } = await supabase.from('location_devices').insert({
      location_id: locationId,
      name: newDev.name.trim(),
      min_ok: parseFloat(newDev.min) || 0,
      max_ok: parseFloat(newDev.max) || 4,
    })
    if (error) { toast.error(error.message); return }
    setNewDev({ name: '', min: '0', max: '4' })
    load()
    onChanged()
    toast.success('Urządzenie dodane')
  }

  async function removeDevice(id: string) {
    await supabase.from('location_devices').delete().eq('id', id)
    load()
    onChanged()
  }

  if (!loaded) {
    return (
      <button onClick={load} className="text-sm text-blue-600 hover:underline">
        Załaduj listę urządzeń…
      </button>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        <input
          className="input flex-1 min-w-36 text-sm"
          placeholder="Nazwa (np. Lodówka 1)"
          value={newDev.name}
          onChange={e => setNewDev(p => ({ ...p, name: e.target.value }))}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addDevice())}
        />
        <input className="input w-20 text-sm" type="number" step="0.5" placeholder="Min°C"
          value={newDev.min} onChange={e => setNewDev(p => ({ ...p, min: e.target.value }))} />
        <input className="input w-20 text-sm" type="number" step="0.5" placeholder="Max°C"
          value={newDev.max} onChange={e => setNewDev(p => ({ ...p, max: e.target.value }))} />
        <button onClick={addDevice}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
          Dodaj
        </button>
      </div>
      <div className="space-y-1">
        {devices.map(d => (
          <div key={d.id} className="flex items-center justify-between bg-white border border-gray-100 p-2.5 rounded-lg text-sm">
            <span className="font-medium text-gray-900">{d.name}</span>
            <div className="flex items-center gap-3">
              <span className="text-gray-400 text-xs font-mono">{d.min_ok} – {d.max_ok}°C</span>
              <button onClick={() => removeDevice(d.id)} className="text-red-400 hover:text-red-600">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        {devices.length === 0 && <p className="text-sm text-gray-400 italic">Brak zarejestrowanych urządzeń</p>}
      </div>
    </div>
  )
}

interface TemperatureBoardProps {
  devices: DeviceWithStatus[]
  locationId: string
}

export function TemperatureBoard({ devices, locationId }: TemperatureBoardProps) {
  const [filter, setFilter] = useState<FilterType>('all')
  const [showManager, setShowManager] = useState(false)
  const router = useRouter()

  const todayChecked = devices.filter(d => d.todayCount > 0).length
  const total = devices.length
  const progress = total > 0 ? Math.round((todayChecked / total) * 100) : 0

  const counts = {
    all: devices.length,
    missing: devices.filter(d => d.todayCount === 0).length,
    ok: devices.filter(d => d.todayCount > 0 && d.lastOk !== false).length,
    alarm: devices.filter(d => d.lastOk === false).length,
  }

  const filtered = devices.filter(d => {
    if (filter === 'missing') return d.todayCount === 0
    if (filter === 'ok') return d.todayCount > 0 && d.lastOk !== false
    if (filter === 'alarm') return d.lastOk === false
    return true
  })

  const firstUnchecked = devices.find(d => d.todayCount === 0)

  const filterLabels: Record<FilterType, string> = {
    all: `Wszystkie (${counts.all})`,
    missing: `Nieuzupełnione (${counts.missing})`,
    ok: `OK (${counts.ok})`,
    alarm: `Alarm (${counts.alarm})`,
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Temperatury</h1>
          <p className="text-sm text-gray-500 mt-0.5">Urządzenia chłodnicze</p>
        </div>
        <button
          onClick={() => setShowManager(!showManager)}
          className={cn(
            'flex items-center gap-1.5 text-sm px-3 py-2 border rounded-lg transition-colors',
            showManager ? 'bg-blue-600 text-white border-blue-600' : 'text-gray-500 border-gray-200 hover:border-gray-300'
          )}
        >
          <Settings size={14} />
          <span className="hidden sm:inline">Zarządzaj</span>
        </button>
      </div>

      {/* Device manager */}
      {showManager && (
        <div className="card space-y-3">
          <p className="font-semibold text-gray-800 text-sm flex items-center gap-2">
            <Settings size={14} />
            Urządzenia chłodnicze
          </p>
          <DeviceManager locationId={locationId} onChanged={() => router.refresh()} />
        </div>
      )}

      {/* Progress bar */}
      {total > 0 && (
        <div className="card py-4 px-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-700">Sprawdzone dzisiaj</span>
            <span className={cn(
              'text-sm font-bold tabular-nums',
              todayChecked === total ? 'text-green-600'
                : todayChecked === 0 ? 'text-gray-400'
                : 'text-orange-500'
            )}>
              {todayChecked} / {total}
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-700',
                todayChecked === total ? 'bg-green-500'
                  : todayChecked > 0 ? 'bg-orange-400'
                  : 'bg-gray-200'
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
          {firstUnchecked && todayChecked < total && (
            <button
              onClick={() => document.getElementById(`dev-${firstUnchecked.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
              className="mt-3 flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              <ArrowRight size={14} />
              Następne nieuzupełnione: {firstUnchecked.name}
            </button>
          )}
        </div>
      )}

      {/* Alarm banner */}
      {counts.alarm > 0 && (
        <div className="rounded-xl border-2 border-red-200 bg-red-50 p-4 flex items-start gap-3">
          <AlertCircle size={18} className="text-red-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-bold text-red-800 text-sm">Alarmy temperatur ({counts.alarm})</p>
            <p className="text-xs text-red-600 mt-0.5">
              {devices.filter(d => d.lastOk === false).map(d => d.name).join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      {total > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none">
          {(Object.keys(filterLabels) as FilterType[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-3.5 py-2 rounded-full text-xs font-semibold whitespace-nowrap border transition-colors shrink-0',
                filter === f
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              )}
            >
              {filterLabels[f]}
            </button>
          ))}
        </div>
      )}

      {/* Device cards */}
      {filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map(device => (
            <div key={device.id} id={`dev-${device.id}`}>
              <DeviceCard device={device} locationId={locationId} onSaved={() => router.refresh()} />
              <Link
                href={`/temperatury/${encodeURIComponent(device.name)}`}
                className="flex items-center gap-1 mt-1.5 ml-3 text-xs text-gray-400 hover:text-blue-600 transition-colors w-fit"
              >
                <Clock size={11} />
                Historia wpisów
                <ChevronRight size={11} />
              </Link>
            </div>
          ))}
        </div>
      ) : total === 0 ? (
        <div className="card border-dashed border-2 border-gray-200 text-center py-12">
          <Thermometer size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 mb-1">Brak urządzeń</p>
          <p className="text-sm text-gray-400">Kliknij <strong>Zarządzaj</strong> aby dodać lodówki i zamrażarki.</p>
        </div>
      ) : (
        <div className="card text-center py-8">
          <p className="text-gray-500 text-sm">Brak wyników dla wybranego filtra.</p>
        </div>
      )}
    </div>
  )
}
