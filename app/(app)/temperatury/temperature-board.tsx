'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  Thermometer, CheckCircle2, AlertCircle, Clock,
  ArrowRight, Settings, ChevronRight, Trash2, Pencil, Circle, Sun, Moon, Plus,
} from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { DeviceWithStatus } from './page'
import { Dialog } from '@/components/ui/dialog'
import { PageHeader } from '@/components/ui/page-header'
import { AlertBox } from '@/components/ui/alert-box'
import { EmptyState } from '@/components/ui/empty-state'
import { FilterChips } from '@/components/ui/filter-chips'
import { CompactRecordCard } from '@/components/ui/compact-record-card'

type FilterType = 'all' | 'missing' | 'ok' | 'alarm'

/** True once we're past the location's configured split hour (afternoon check window is open). */
function isPmDue(splitHour: number): boolean {
  return new Date().getHours() >= splitHour
}

function isDeviceMissing(d: DeviceWithStatus, checksPerDay: number, pmDue: boolean): boolean {
  if (checksPerDay === 2) return d.amCount === 0 || (pmDue && d.pmCount === 0)
  return d.todayCount === 0
}

function getDeviceStatus(d: DeviceWithStatus, checksPerDay: number, pmDue: boolean): 'ok' | 'alarm' | 'missing' | 'unchecked' {
  if (d.lastTemp === null) return 'unchecked'
  if (d.lastOk === false) return 'alarm'
  if (isDeviceMissing(d, checksPerDay, pmDue)) return 'missing'
  return 'ok'
}

/** More specific "missing" label for 2x-daily locations — which check (rano/popołudnie) is still due. */
function getMissingLabel(d: DeviceWithStatus, pmDue: boolean): string {
  const amMissing = d.amCount === 0
  const pmMissing = pmDue && d.pmCount === 0
  if (amMissing && pmMissing) return 'Brak wpisów dziś'
  if (amMissing) return 'Brak porannego wpisu'
  if (pmMissing) return 'Brak popołudniowego wpisu'
  return 'Brak wpisu dziś'
}

function groupDevicesByZone(devices: DeviceWithStatus[]): { zone: string | null; devices: DeviceWithStatus[] }[] {
  const map = new Map<string | null, DeviceWithStatus[]>()
  for (const d of devices) {
    const key = d.zone?.trim() || null
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(d)
  }
  const groups = Array.from(map.entries()).map(([zone, devs]) => ({ zone, devices: devs }))
  groups.sort((a, b) => {
    if (a.zone === null) return 1
    if (b.zone === null) return -1
    return a.zone.localeCompare(b.zone, 'pl')
  })
  return groups
}

function guessQuickValues(min_ok: number, max_ok: number): number[] {
  if (max_ok <= -15) return [-24, -22, -20, -18, -16]
  if (max_ok <= 0) return [-4, -3, -2, -1, 0]
  if (max_ok <= 10) return [0, 1, 2, 3, 4, 5, 6, 7, 8]
  return [-20, -10, 0, 5, 10, 15, 20]
}

const STATUS_STYLE = {
  ok:        { dot: 'bg-green-500',  badge: 'bg-green-100 text-green-700',   label: 'OK' },
  alarm:     { dot: 'bg-red-500',    badge: 'bg-red-100 text-red-700',       label: 'Poza normą' },
  missing:   { dot: 'bg-yellow-400', badge: 'bg-yellow-100 text-yellow-700', label: 'Brak wpisu dziś' },
  unchecked: { dot: 'bg-gray-300',   badge: 'bg-gray-100 text-gray-500',     label: 'Nigdy nie sprawdzane' },
}

interface QuickEntryModalProps {
  device: DeviceWithStatus | null
  locationId: string
  checksPerDay: number
  pmDue: boolean
  onClose: () => void
  onSaved: () => void
}

function QuickEntryModal({ device, locationId, checksPerDay, pmDue, onClose, onSaved }: QuickEntryModalProps) {
  const [temp, setTemp] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (device) {
      setTemp(device.lastTemp !== null
        ? String(device.lastTemp)
        : String(Math.round(((device.min_ok + device.max_ok) / 2) * 10) / 10))
      setNotes('')
    }
  }, [device])

  const tempNum = temp === '' ? null : parseFloat(temp.replace(',', '.'))
  const hasTemp = tempNum !== null && !isNaN(tempNum)
  const normMin = device ? Math.min(device.min_ok, device.max_ok) : 0
  const normMax = device ? Math.max(device.min_ok, device.max_ok) : 0
  const inRange = hasTemp && tempNum >= normMin && tempNum <= normMax
  const outOfRange = hasTemp && !inRange
  const isUnusual = hasTemp && (tempNum < -40 || tempNum > 100)
  const notesRequired = outOfRange
  const quickValues = device ? guessQuickValues(device.min_ok, device.max_ok) : []

  function adjust(delta: number) {
    const current = parseFloat(temp.replace(',', '.'))
    if (isNaN(current)) return
    setTemp(String(Math.round((current + delta) * 10) / 10))
  }

  async function handleSave() {
    if (!device) return
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
    if (error) { setSaving(false); toast.error('Błąd zapisu: ' + error.message); return }

    if (outOfRange) {
      const { error: ncError } = await supabase.from('nonconformities').insert({
        location_id: locationId,
        source: 'temperature_alarm',
        description: `Alarm temperatury: ${device.name} — zmierzono ${tempNum}°C (norma ${device.min_ok}–${device.max_ok}°C)`,
        corrective_action: notes.trim() || null,
        status: 'open',
        reported_by: user!.id,
      })
      if (ncError) toast.error('Temperatura zapisana, ale nie udało się zgłosić niezgodności: ' + ncError.message)
      fetch('/api/push/notify-alarm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceName: device.name, temperature: tempNum }),
      }).catch(() => {})
      toast.error(`ALARM: ${device.name} ${tempNum}°C poza normą — zgłoszono niezgodność`)
    } else {
      toast.success(`Temperatura zapisana — ${device.name} ${tempNum}°C`)
    }

    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <Dialog
      open={!!device}
      onClose={onClose}
      title={device?.name}
      description={device
        ? `Norma: ${device.min_ok} – ${device.max_ok}°C${checksPerDay === 2 ? ` • Odczyt ${pmDue ? 'popołudniowy' : 'poranny'}` : ''}`
        : undefined}
      size="sm"
    >
      {device && (
        <div className="space-y-4">
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
                      ? 'border-brand-navy bg-brand-navy text-white'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-brand-navy/40'
                  )}
                >
                  {v > 0 ? '+' : ''}{v}°
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Temperatura (°C)</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => adjust(-0.1)}
                className="w-14 h-14 rounded-xl border-2 border-gray-200 text-3xl font-bold text-gray-600 hover:bg-gray-50 active:bg-gray-100 flex items-center justify-center shrink-0 select-none"
              >
                −
              </button>
              <input
                type="number"
                step="0.1"
                inputMode="decimal"
                className="input font-mono text-2xl text-center py-3 h-14 flex-1 min-w-0"
                value={temp}
                onChange={e => setTemp(e.target.value)}
              />
              <button
                type="button"
                onClick={() => adjust(0.1)}
                className="w-14 h-14 rounded-xl border-2 border-gray-200 text-3xl font-bold text-gray-600 hover:bg-gray-50 active:bg-gray-100 flex items-center justify-center shrink-0 select-none"
              >
                +
              </button>
            </div>
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
                  : 'bg-brand-green hover:bg-brand-green-dark'
              )}
            >
              {saving ? 'Zapisywanie…' : 'Zapisz temperaturę'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-3.5 rounded-xl text-sm font-medium text-gray-600 border-2 border-gray-200 hover:bg-gray-50 min-h-[52px]"
            >
              Anuluj
            </button>
          </div>
        </div>
      )}
    </Dialog>
  )
}

interface TempScheduleSettingsProps {
  locationId: string
  checksPerDay: number
  splitHour: number
  onChanged: () => void
}

function TempScheduleSettings({ locationId, checksPerDay, splitHour, onChanged }: TempScheduleSettingsProps) {
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  async function update(updates: { temp_checks_per_day?: number; temp_check_split_hour?: number }) {
    setSaving(true)
    const { error } = await supabase.from('locations').update(updates).eq('id', locationId)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    onChanged()
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => checksPerDay !== 1 && update({ temp_checks_per_day: 1 })}
          className={cn(
            'flex-1 px-3 py-2 rounded-lg text-sm border transition-colors',
            checksPerDay === 1 ? 'border-brand-navy bg-brand-navy text-white font-medium' : 'border-gray-200 hover:border-gray-300'
          )}
        >
          1x dziennie
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => checksPerDay !== 2 && update({ temp_checks_per_day: 2 })}
          className={cn(
            'flex-1 px-3 py-2 rounded-lg text-sm border transition-colors',
            checksPerDay === 2 ? 'border-brand-navy bg-brand-navy text-white font-medium' : 'border-gray-200 hover:border-gray-300'
          )}
        >
          2x dziennie
        </button>
      </div>
      {checksPerDay === 2 && (
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 flex-1">Drugi spis (popołudniowy) od godziny:</label>
          <select
            className="input w-24 text-sm"
            value={splitHour}
            disabled={saving}
            onChange={e => update({ temp_check_split_hour: Number(e.target.value) })}
          >
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
            ))}
          </select>
        </div>
      )}
      {checksPerDay === 2 && (
        <p className="text-xs text-gray-400">
          Każde urządzenie trzeba sprawdzić raz przed i raz po tej godzinie.
        </p>
      )}
    </div>
  )
}

interface ManagedDevice { id: string; name: string; min_ok: number; max_ok: number; zone: string | null }

/** Common refrigeration equipment types with their typical HACCP temperature norms — used to pre-fill the "add device" form. */
const DEVICE_TYPES: { label: string; min: number; max: number }[] = [
  { label: 'Lodówka', min: 0, max: 4 },
  { label: 'Zamrażarka', min: -22, max: -18 },
  { label: 'Chłodnia', min: 0, max: 4 },
  { label: 'Witryna', min: 2, max: 6 },
]

function DeviceManager({ locationId, onChanged }: { locationId: string; onChanged: () => void }) {
  const [devices, setDevices] = useState<ManagedDevice[]>([])
  const [addStep, setAddStep] = useState<'closed' | 'type' | 'form'>('closed')
  const [newDev, setNewDev] = useState({ name: '', min: '0', max: '4', zone: '' })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDev, setEditDev] = useState({ name: '', min: '', max: '', zone: '' })
  const supabase = createClient()

  async function load() {
    const { data } = await supabase.from('location_devices').select('*').eq('location_id', locationId).order('created_at')
    setDevices(data ?? [])
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId])

  const zoneOptions = Array.from(
    new Set(devices.map(d => d.zone?.trim()).filter((z): z is string => !!z))
  ).sort((a, b) => a.localeCompare(b, 'pl'))

  function selectDeviceType(type: typeof DEVICE_TYPES[number]) {
    setNewDev({ name: type.label, min: String(type.min), max: String(type.max), zone: '' })
    setAddStep('form')
  }

  async function addDevice() {
    if (!newDev.name.trim()) { toast.error('Podaj nazwę urządzenia'); return }
    const { error } = await supabase.from('location_devices').insert({
      location_id: locationId,
      name: newDev.name.trim(),
      min_ok: parseFloat(newDev.min) || 0,
      max_ok: parseFloat(newDev.max) || 4,
      zone: newDev.zone.trim() || null,
    })
    if (error) { toast.error(error.message); return }
    setNewDev({ name: '', min: '0', max: '4', zone: '' })
    setAddStep('closed')
    load()
    onChanged()
    toast.success('Urządzenie dodane')
  }

  function startEdit(d: ManagedDevice) {
    setEditingId(d.id)
    setEditDev({ name: d.name, min: String(d.min_ok), max: String(d.max_ok), zone: d.zone ?? '' })
  }

  async function saveEdit(id: string) {
    if (!editDev.name.trim()) { toast.error('Podaj nazwę urządzenia'); return }
    const { error } = await supabase.from('location_devices').update({
      name: editDev.name.trim(),
      min_ok: parseFloat(editDev.min) || 0,
      max_ok: parseFloat(editDev.max) || 4,
      zone: editDev.zone.trim() || null,
    }).eq('id', id)
    if (error) { toast.error(error.message); return }
    setEditingId(null)
    load()
    onChanged()
    toast.success('Zapisano zmiany')
  }

  async function removeDevice(id: string) {
    const { error } = await supabase.from('location_devices').delete().eq('id', id)
    if (error) { toast.error('Błąd usuwania: ' + error.message); return }
    if (editingId === id) setEditingId(null)
    load()
    onChanged()
  }

  return (
    <div className="space-y-3">
      <datalist id="zone-suggestions">
        {zoneOptions.map(z => <option key={z} value={z} />)}
      </datalist>

      {addStep === 'closed' && (
        <button
          onClick={() => setAddStep('type')}
          className="btn-primary w-full flex items-center justify-center gap-2 py-3"
        >
          <Plus size={16} />
          Dodaj urządzenie
        </button>
      )}

      {addStep === 'type' && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">Wybierz rodzaj urządzenia:</p>
          <div className="grid grid-cols-2 gap-2">
            {DEVICE_TYPES.map(t => (
              <button
                key={t.label}
                onClick={() => selectDeviceType(t)}
                className="flex flex-col items-start gap-0.5 p-3 rounded-lg border border-gray-200 hover:border-brand-navy hover:bg-brand-navy/5 transition-colors text-left"
              >
                <span className="font-semibold text-gray-900 text-sm">{t.label}</span>
                <span className="text-xs text-gray-400 font-mono">{t.min} – {t.max}°C</span>
              </button>
            ))}
          </div>
          <button onClick={() => setAddStep('closed')} className="text-sm text-gray-500 hover:underline">
            Anuluj
          </button>
        </div>
      )}

      {addStep === 'form' && (
        <div className="space-y-2 p-3 bg-gray-50 rounded-lg border border-gray-100">
          <div className="flex gap-2 flex-wrap">
            <input
              className="input flex-1 min-w-36 text-sm"
              placeholder="Nazwa (np. Lodówka 1)"
              value={newDev.name}
              onChange={e => setNewDev(p => ({ ...p, name: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addDevice())}
              autoFocus
            />
            <input className="input w-20 text-sm" type="number" step="0.5" placeholder="Min°C"
              value={newDev.min} onChange={e => setNewDev(p => ({ ...p, min: e.target.value }))} />
            <input className="input w-20 text-sm" type="number" step="0.5" placeholder="Max°C"
              value={newDev.max} onChange={e => setNewDev(p => ({ ...p, max: e.target.value }))} />
          </div>
          <input
            className="input w-full text-sm"
            list="zone-suggestions"
            placeholder="Strefa, np. Kuchnia, Sala, Magazyn (opcjonalnie)"
            value={newDev.zone}
            onChange={e => setNewDev(p => ({ ...p, zone: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addDevice())}
          />
          <div className="flex gap-2">
            <button onClick={addDevice} className="btn-primary flex-1 text-sm">
              Dodaj
            </button>
            <button
              onClick={() => setAddStep('closed')}
              className="px-4 py-2 text-gray-500 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50"
            >
              Anuluj
            </button>
          </div>
        </div>
      )}

      <div className="space-y-1">
        {devices.map(d => (
          <div key={d.id} className="bg-white border border-gray-100 rounded-lg text-sm overflow-hidden">
            {editingId === d.id ? (
              <div className="p-2.5 space-y-2">
                <div className="flex gap-2 flex-wrap">
                  <input className="input flex-1 min-w-32 text-sm" value={editDev.name}
                    onChange={e => setEditDev(p => ({ ...p, name: e.target.value }))} />
                  <input className="input w-20 text-sm" type="number" step="0.5" value={editDev.min}
                    onChange={e => setEditDev(p => ({ ...p, min: e.target.value }))} />
                  <input className="input w-20 text-sm" type="number" step="0.5" value={editDev.max}
                    onChange={e => setEditDev(p => ({ ...p, max: e.target.value }))} />
                </div>
                <input className="input w-full text-sm" list="zone-suggestions" placeholder="Strefa (opcjonalnie)"
                  value={editDev.zone} onChange={e => setEditDev(p => ({ ...p, zone: e.target.value }))} />
                <div className="flex gap-2">
                  <button onClick={() => saveEdit(d.id)}
                    className="px-3 py-1.5 bg-brand-green text-white text-xs font-medium rounded-lg hover:bg-brand-green-dark">
                    Zapisz
                  </button>
                  <button onClick={() => setEditingId(null)}
                    className="px-3 py-1.5 text-gray-500 text-xs font-medium rounded-lg border border-gray-200 hover:bg-gray-50">
                    Anuluj
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between p-2.5">
                <button onClick={() => startEdit(d)} className="flex-1 text-left min-w-0 truncate">
                  <span className="font-medium text-gray-900">{d.name}</span>
                  {d.zone && <span className="ml-2 text-xs text-gray-400">· {d.zone}</span>}
                </button>
                <div className="flex items-center gap-3 shrink-0 pl-2">
                  <span className="text-gray-400 text-xs font-mono">{d.min_ok} – {d.max_ok}°C</span>
                  <button onClick={() => startEdit(d)} className="text-gray-400 hover:text-brand-navy">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => removeDevice(d.id)} className="text-red-400 hover:text-red-600">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )}
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
  canManageDevices?: boolean
  checksPerDay: number
  splitHour: number
}

export function TemperatureBoard({ devices, locationId, canManageDevices = true, checksPerDay, splitHour }: TemperatureBoardProps) {
  const [filter, setFilter] = useState<FilterType>('missing')
  const [showManager, setShowManager] = useState(false)
  const [selected, setSelected] = useState<DeviceWithStatus | null>(null)
  const router = useRouter()

  const pmDue = isPmDue(splitHour)
  const total = devices.length

  const todayChecked = devices.filter(d => d.todayCount > 0).length
  const progressTotal = checksPerDay === 2 ? total * (pmDue ? 2 : 1) : total
  const progressDone = checksPerDay === 2
    ? devices.reduce((sum, d) => sum + (d.amCount > 0 ? 1 : 0) + (pmDue && d.pmCount > 0 ? 1 : 0), 0)
    : todayChecked
  const progress = progressTotal > 0 ? Math.round((progressDone / progressTotal) * 100) : 0

  const counts = {
    all: devices.length,
    missing: devices.filter(d => isDeviceMissing(d, checksPerDay, pmDue)).length,
    ok: devices.filter(d => !isDeviceMissing(d, checksPerDay, pmDue) && d.lastOk !== false).length,
    alarm: devices.filter(d => d.lastOk === false).length,
  }

  const filtered = devices.filter(d => {
    if (filter === 'missing') return isDeviceMissing(d, checksPerDay, pmDue)
    if (filter === 'ok') return !isDeviceMissing(d, checksPerDay, pmDue) && d.lastOk !== false
    if (filter === 'alarm') return d.lastOk === false
    return true
  })

  const groupedDevices = groupDevicesByZone(filtered)
  const showZoneHeaders = groupedDevices.length > 1

  const nextDue = devices.find(d => isDeviceMissing(d, checksPerDay, pmDue))

  const filterOptions: { value: FilterType; label: string; count: number }[] = [
    { value: 'missing', label: 'Nieuzupełnione', count: counts.missing },
    { value: 'all', label: 'Wszystkie', count: counts.all },
    { value: 'ok', label: 'OK', count: counts.ok },
    { value: 'alarm', label: 'Alarm', count: counts.alarm },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title="Temperatury"
        subtitle="Urządzenia chłodnicze"
        action={canManageDevices ? (
          <button
            onClick={() => setShowManager(!showManager)}
            className={cn(
              'flex items-center gap-1.5 text-sm px-3 py-2 border rounded-lg transition-colors',
              showManager ? 'bg-brand-navy text-white border-brand-navy' : 'text-gray-500 border-gray-200 hover:border-gray-300'
            )}
          >
            <Settings size={14} />
            <span className="hidden sm:inline">Zarządzaj</span>
          </button>
        ) : undefined}
      />

      {/* Device manager */}
      {showManager && canManageDevices && (
        <>
          <div className="card space-y-3">
            <p className="font-semibold text-gray-800 text-sm flex items-center gap-2">
              <Clock size={14} />
              Częstotliwość spisywania temperatur
            </p>
            <TempScheduleSettings
              locationId={locationId}
              checksPerDay={checksPerDay}
              splitHour={splitHour}
              onChanged={() => router.refresh()}
            />
          </div>
          <div className="card space-y-3">
            <p className="font-semibold text-gray-800 text-sm flex items-center gap-2">
              <Settings size={14} />
              Urządzenia chłodnicze
            </p>
            <DeviceManager locationId={locationId} onChanged={() => router.refresh()} />
          </div>
        </>
      )}

      {/* Progress bar */}
      {total > 0 && (
        <div className="card py-4 px-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-700">
              Sprawdzone dzisiaj{checksPerDay === 2 && (pmDue ? ' (rano + popołudnie)' : ' (rano)')}
            </span>
            <span className={cn(
              'text-sm font-bold tabular-nums',
              progressDone === progressTotal ? 'text-green-600'
                : progressDone === 0 ? 'text-gray-400'
                : 'text-orange-500'
            )}>
              {progressDone} / {progressTotal}
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-700',
                progressDone === progressTotal ? 'bg-green-500'
                  : progressDone > 0 ? 'bg-orange-400'
                  : 'bg-gray-200'
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
          {nextDue && progressDone < progressTotal && (
            <button
              onClick={() => setSelected(nextDue)}
              className="mt-3 flex items-center gap-1.5 text-sm text-brand-navy hover:text-brand-navy-light font-medium"
            >
              <ArrowRight size={14} />
              Następne nieuzupełnione: {nextDue.name}
            </button>
          )}
        </div>
      )}

      {/* Alarm banner */}
      {counts.alarm > 0 && (
        <AlertBox
          variant="error"
          title={`Alarmy temperatur (${counts.alarm})`}
          description={devices.filter(d => d.lastOk === false).map(d => d.name).join(', ')}
        />
      )}

      {/* Filters */}
      {total > 0 && (
        <FilterChips value={filter} onChange={setFilter} options={filterOptions} />
      )}

      {/* Device cards */}
      {filtered.length > 0 ? (
        <div className="space-y-5">
          {groupedDevices.map(group => (
            <div key={group.zone ?? '__none__'} className="space-y-2">
              {showZoneHeaders && (
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">
                  {group.zone ?? 'Bez przypisanej strefy'}
                </p>
              )}
              {group.devices.map(device => {
                const status = getDeviceStatus(device, checksPerDay, pmDue)
                const s = STATUS_STYLE[status]
                const badgeLabel = status === 'missing' && checksPerDay === 2 ? getMissingLabel(device, pmDue) : s.label
                return (
                  <div key={device.id}>
                    <CompactRecordCard
                      dotClassName={s.dot}
                      title={device.name}
                      meta={checksPerDay === 2 ? (
                        <span className="flex items-center gap-2.5 flex-wrap">
                          <span className={cn('inline-flex items-center gap-1', device.amCount > 0 ? 'text-green-600' : 'text-gray-400')}>
                            {device.amCount > 0 ? <CheckCircle2 size={11} /> : <Circle size={11} />}
                            <Sun size={11} />
                          </span>
                          <span className={cn('inline-flex items-center gap-1', device.pmCount > 0 ? 'text-green-600' : pmDue ? 'text-gray-400' : 'text-gray-300')}>
                            {device.pmCount > 0 ? <CheckCircle2 size={11} /> : <Circle size={11} />}
                            <Moon size={11} />
                          </span>
                          {device.lastTemp !== null && <span className="font-mono">{device.lastTemp}°C</span>}
                        </span>
                      ) : device.lastTemp !== null
                        ? <>Ostatni: <span className="font-mono">{device.lastTemp}°C</span>{device.lastMeasuredAt && <> · {formatDateTime(device.lastMeasuredAt)}</>}</>
                        : `Norma: ${device.min_ok} – ${device.max_ok}°C`}
                      badge={<span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', s.badge)}>{badgeLabel}</span>}
                      onClick={() => setSelected(device)}
                    />
                    <Link
                      href={`/temperatury/${encodeURIComponent(device.name)}`}
                      className="flex items-center gap-1 mt-1 ml-3 text-xs text-gray-400 hover:text-brand-navy transition-colors w-fit"
                    >
                      <Clock size={11} />
                      Historia wpisów
                      <ChevronRight size={11} />
                    </Link>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      ) : total === 0 ? (
        <EmptyState
          icon={Thermometer}
          title="Brak urządzeń"
          description={canManageDevices
            ? <>Kliknij <strong>Zarządzaj</strong> aby dodać lodówki i zamrażarki.</>
            : 'Brak skonfigurowanych urządzeń. Skontaktuj się z właścicielem lokalu.'}
        />
      ) : (
        <div className="card text-center py-8">
          <p className="text-gray-500 text-sm">Brak wyników dla wybranego filtra.</p>
        </div>
      )}

      <QuickEntryModal
        device={selected}
        locationId={locationId}
        checksPerDay={checksPerDay}
        pmDue={pmDue}
        onClose={() => setSelected(null)}
        onSaved={() => router.refresh()}
      />
    </div>
  )
}
