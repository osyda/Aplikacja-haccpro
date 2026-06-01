'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Plus, ChevronDown, ChevronUp, Thermometer, Trash2, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const schema = z.object({
  device_name: z.string().min(1, 'Podaj nazwę urządzenia'),
  temperature: z.coerce.number().refine((v) => !isNaN(v), 'Podaj temperaturę'),
  min_ok: z.coerce.number().refine((v) => !isNaN(v), 'Podaj minimalną normę'),
  max_ok: z.coerce.number().refine((v) => !isNaN(v), 'Podaj maksymalną normę'),
  notes: z.string().optional(),
})

type FormData = z.output<typeof schema>

interface Device {
  id: string
  name: string
  min_ok: number
  max_ok: number
}

interface AddTemperatureFormProps {
  locationId: string
}

export function AddTemperatureForm({ locationId }: AddTemperatureFormProps) {
  const [expanded, setExpanded] = useState(false)
  const [managing, setManaging] = useState(false)
  const [devices, setDevices] = useState<Device[]>([])
  const [newDev, setNewDev] = useState({ name: '', min: '0', max: '4' })
  const router = useRouter()
  const supabase = createClient()

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) as any })

  const watchedDevice = watch('device_name')

  useEffect(() => {
    if (locationId) fetchDevices()
  }, [locationId])

  async function fetchDevices() {
    const { data } = await supabase
      .from('location_devices')
      .select('*')
      .eq('location_id', locationId)
      .order('created_at')
    setDevices(data ?? [])
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
    fetchDevices()
    toast.success('Urządzenie dodane')
  }

  async function deleteDevice(id: string) {
    await supabase.from('location_devices').delete().eq('id', id)
    fetchDevices()
  }

  function selectDevice(d: Device) {
    setValue('device_name', d.name)
    setValue('min_ok', d.min_ok)
    setValue('max_ok', d.max_ok)
  }

  async function onSubmit(data: FormData) {
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('temperature_logs').insert({
      location_id: locationId,
      device_name: data.device_name,
      temperature: data.temperature,
      min_ok: data.min_ok,
      max_ok: data.max_ok,
      measured_at: new Date().toISOString(),
      recorded_by: user!.id,
      notes: data.notes || null,
    })
    if (error) { toast.error('Błąd zapisu: ' + error.message); return }
    const ok = data.temperature >= data.min_ok && data.temperature <= data.max_ok
    if (ok) toast.success(`${data.device_name} ${data.temperature}°C — norma OK`)
    else toast.error(`ALARM: ${data.device_name} ${data.temperature}°C poza normą!`)
    reset()
    setExpanded(false)
    router.refresh()
  }

  return (
    <div className="card">
      <button type="button" onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-left">
        <div className="flex items-center gap-2">
          <div className="bg-blue-500 p-1.5 rounded-lg"><Plus size={14} className="text-white" /></div>
          <span className="font-semibold text-gray-900">Dodaj wpis temperatury</span>
        </div>
        {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>

      {expanded && (
        <div className="mt-4 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="label mb-0">Urządzenia</p>
              <button type="button" onClick={() => setManaging(!managing)}
                className="text-xs text-blue-600 flex items-center gap-1 hover:underline">
                <Settings size={11} />
                {managing ? 'Zamknij' : 'Zarządzaj urządzeniami'}
              </button>
            </div>

            {managing && (
              <div className="mb-3 p-3 bg-gray-50 rounded-lg space-y-2">
                <p className="text-xs font-medium text-gray-600">Dodaj nowe urządzenie:</p>
                <div className="flex gap-2 flex-wrap">
                  <input className="input flex-1 min-w-32 text-sm" placeholder="Nazwa (np. Lodówka 1)" value={newDev.name}
                    onChange={(e) => setNewDev((p) => ({ ...p, name: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addDevice())} />
                  <input className="input w-20 text-sm" type="number" step="0.5" placeholder="Min°C" value={newDev.min}
                    onChange={(e) => setNewDev((p) => ({ ...p, min: e.target.value }))} />
                  <input className="input w-20 text-sm" type="number" step="0.5" placeholder="Max°C" value={newDev.max}
                    onChange={(e) => setNewDev((p) => ({ ...p, max: e.target.value }))} />
                  <Button type="button" size="sm" onClick={addDevice}>Dodaj</Button>
                </div>
                {devices.length > 0 && (
                  <div className="space-y-1 mt-2">
                    {devices.map((d) => (
                      <div key={d.id} className="flex items-center justify-between bg-white p-2 rounded border text-sm">
                        <span>{d.name} <span className="text-gray-400 text-xs">({d.min_ok}–{d.max_ok}°C)</span></span>
                        <button type="button" onClick={() => deleteDevice(d.id)} className="text-red-400 hover:text-red-600 ml-2">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {devices.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {devices.map((d) => (
                  <button key={d.id} type="button" onClick={() => selectDevice(d)}
                    className={cn('px-3 py-1.5 rounded-lg text-sm border transition-colors',
                      watchedDevice === d.name
                        ? 'border-brand-green bg-green-50 text-brand-green font-medium'
                        : 'border-gray-200 hover:border-gray-300'
                    )}>
                    {d.name}
                  </button>
                ))}
              </div>
            ) : !managing ? (
              <p className="text-sm text-gray-400 italic">
                Kliknij &bdquo;Zarządzaj urządzeniami&rdquo; aby dodać swoje lodówki, zamrażarki itp.
              </p>
            ) : null}
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="label">Nazwa urządzenia</label>
                <input {...register('device_name')} placeholder="np. Lodówka przy barze" className="input" />
                {errors.device_name && <p className="text-xs text-red-600 mt-0.5">{errors.device_name.message}</p>}
              </div>
              <div>
                <label className="label">Temperatura (°C)</label>
                <input {...register('temperature')} type="number" step="0.1" placeholder="np. 3.5" className="input font-mono text-lg" />
                {errors.temperature && <p className="text-xs text-red-600 mt-0.5">{errors.temperature.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label">Min. norma</label>
                  <input {...register('min_ok')} type="number" step="0.5" placeholder="0" className="input" />
                </div>
                <div>
                  <label className="label">Max. norma</label>
                  <input {...register('max_ok')} type="number" step="0.5" placeholder="4" className="input" />
                </div>
              </div>
            </div>
            <div>
              <label className="label">Uwagi (opcjonalnie)</label>
              <input {...register('notes')} placeholder="Dodatkowe informacje..." className="input" />
            </div>
            <div className="flex gap-2">
              <Button type="submit" loading={isSubmitting} className="flex-1">
                <Thermometer size={14} /> Zapisz odczyt
              </Button>
              <Button type="button" variant="ghost" onClick={() => setExpanded(false)}>Anuluj</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
