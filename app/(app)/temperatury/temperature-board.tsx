'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  Thermometer, CheckCircle2, AlertCircle, Clock,
  ArrowRight, Settings, ChevronRight, Trash2,
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
  ok:        { dot: 'bg-green-500',  badge: 'bg-green-100 text-green-700',   label: 'OK' },
  alarm:     { dot: 'bg-red-500',    badge: 'bg-red-100 text-red-700',       label: 'Poza normą' },
  missing:   { dot: 'bg-yellow-400', badge: 'bg-yellow-100 text-yellow-700', label: 'Brak wpisu dziś' },
  unchecked: { dot: 'bg-gray-300',   badge: 'bg-gray-100 text-gray-500',     label: 'Nigdy nie sprawdzane' },
}

interface QuickEntryModalProps {
  device: DeviceWithStatus | null
  locationId: string
  onClose: () => void
  onSaved: () => void
}

function QuickEntryModal({ device, locationId, onClose, onSaved }: QuickEntryModalProps) {
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
      await supabase.from('nonconformities').insert({
        location_id: locationId,
        source: 'temperature_alarm',
        description: `Alarm temperatury: ${device.name} — zmierzono ${tempNum}°C (norma ${device.min_ok}–${device.max_ok}°C)`,
        corrective_action: notes.trim() || null,
        status: 'open',
        reported_by: user!.id,
      })
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
      description={device ? `Norma: ${device.min_ok} – ${device.max_ok}°C` : undefined}
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
      <button onClick={load} className="text-sm text-brand-navy hover:underline">
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
          className="px-4 py-2 bg-brand-navy text-white text-sm font-medium rounded-lg hover:bg-brand-navy-light">
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
  canManageDevices?: boolean
}

export function TemperatureBoard({ devices, locationId, canManageDevices = true }: TemperatureBoardProps) {
  const [filter, setFilter] = useState<FilterType>('missing')
  const [showManager, setShowManager] = useState(false)
  const [selected, setSelected] = useState<DeviceWithStatus | null>(null)
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
              onClick={() => setSelected(firstUnchecked)}
              className="mt-3 flex items-center gap-1.5 text-sm text-brand-navy hover:text-brand-navy-light font-medium"
            >
              <ArrowRight size={14} />
              Następne nieuzupełnione: {firstUnchecked.name}
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
        <div className="space-y-2">
          {filtered.map(device => {
            const status = getDeviceStatus(device)
            const s = STATUS_STYLE[status]
            return (
              <div key={device.id}>
                <CompactRecordCard
                  dotClassName={s.dot}
                  title={device.name}
                  meta={device.lastTemp !== null
                    ? <>Ostatni: <span className="font-mono">{device.lastTemp}°C</span>{device.lastMeasuredAt && <> · {formatDateTime(device.lastMeasuredAt)}</>}</>
                    : `Norma: ${device.min_ok} – ${device.max_ok}°C`}
                  badge={<span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', s.badge)}>{s.label}</span>}
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
        onClose={() => setSelected(null)}
        onSaved={() => router.refresh()}
      />
    </div>
  )
}
