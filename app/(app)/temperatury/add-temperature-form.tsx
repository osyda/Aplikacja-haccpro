'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Plus, ChevronDown, ChevronUp, Thermometer } from 'lucide-react'
import { cn } from '@/lib/utils'

const schema = z.object({
  device_name: z.string().min(1, 'Podaj nazwę urządzenia'),
  temperature: z.coerce.number().refine((v) => !isNaN(v), 'Podaj temperaturę'),
  min_ok: z.coerce.number().refine((v) => !isNaN(v), 'Podaj minimalną normę'),
  max_ok: z.coerce.number().refine((v) => !isNaN(v), 'Podaj maksymalną normę'),
  notes: z.string().optional(),
})

type FormData = z.output<typeof schema>

interface AddTemperatureFormProps {
  locationId: string
}

const COMMON_DEVICES = [
  { name: 'Lodówka 1', min: 0, max: 4 },
  { name: 'Lodówka 2', min: 0, max: 4 },
  { name: 'Zamrażarka', min: -25, max: -18 },
  { name: 'Witryna chłodnicza', min: 0, max: 8 },
  { name: 'Chłodnia', min: 0, max: 6 },
]

export function AddTemperatureForm({ locationId }: AddTemperatureFormProps) {
  const [expanded, setExpanded] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<FormData>({ resolver: zodResolver(schema) as any })

  const watchedDevice = watch('device_name')

  function selectDevice(device: typeof COMMON_DEVICES[0]) {
    setValue('device_name', device.name)
    setValue('min_ok', device.min)
    setValue('max_ok', device.max)
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

    if (error) {
      toast.error('Błąd zapisu temperatury: ' + error.message)
      return
    }

    const ok = data.temperature >= data.min_ok && data.temperature <= data.max_ok
    if (ok) {
      toast.success(`Zapisano: ${data.device_name} ${data.temperature}°C — norma OK`)
    } else {
      toast.error(`ALARM: ${data.device_name} ${data.temperature}°C poza normą (${data.min_ok}–${data.max_ok}°C)`)
    }

    reset()
    setExpanded(false)
    router.refresh()
  }

  return (
    <div className="card">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <div className="bg-blue-500 p-1.5 rounded-lg">
            <Plus size={14} className="text-white" />
          </div>
          <span className="font-semibold text-gray-900">Dodaj wpis temperatury</span>
        </div>
        {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>

      {expanded && (
        <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
          <div>
            <p className="label">Szybki wybór urządzenia</p>
            <div className="flex flex-wrap gap-2">
              {COMMON_DEVICES.map((d) => (
                <button
                  key={d.name}
                  type="button"
                  onClick={() => selectDevice(d)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm border transition-colors',
                    watchedDevice === d.name
                      ? 'border-brand-green bg-green-50 text-brand-green font-medium'
                      : 'border-gray-200 hover:border-gray-300'
                  )}
                >
                  {d.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Nazwa urządzenia</label>
              <input
                {...register('device_name')}
                placeholder="np. Lodówka przy barze"
                className="input"
              />
              {errors.device_name && <p className="text-xs text-red-600 mt-0.5">{errors.device_name.message}</p>}
            </div>

            <div>
              <label className="label">Temperatura (°C)</label>
              <input
                {...register('temperature')}
                type="number"
                step="0.1"
                placeholder="np. 3.5"
                className="input font-mono text-lg"
              />
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
              <Thermometer size={14} />
              Zapisz odczyt
            </Button>
            <Button type="button" variant="ghost" onClick={() => setExpanded(false)}>
              Anuluj
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
