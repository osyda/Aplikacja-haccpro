'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Plus, ChevronDown, ChevronUp } from 'lucide-react'

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
  const [form, setForm] = useState({ device_name: '', temperature: '', min_ok: '', max_ok: '', notes: '' })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  function selectDevice(device: typeof COMMON_DEVICES[0]) {
    setForm((prev) => ({ ...prev, device_name: device.name, min_ok: String(device.min), max_ok: String(device.max) }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase.from('temperature_logs').insert({
      location_id: locationId,
      device_name: form.device_name,
      temperature: parseFloat(form.temperature),
      min_ok: parseFloat(form.min_ok),
      max_ok: parseFloat(form.max_ok),
      measured_at: new Date().toISOString(),
      recorded_by: user!.id,
      notes: form.notes || null,
    })

    setLoading(false)
    if (!error) {
      setSuccess(true)
      setForm({ device_name: '', temperature: '', min_ok: '', max_ok: '', notes: '' })
      setTimeout(() => { setSuccess(false); setExpanded(false) }, 2000)
      router.refresh()
    }
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
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <p className="label">Wybierz urządzenie</p>
            <div className="flex flex-wrap gap-2">
              {COMMON_DEVICES.map((d) => (
                <button
                  key={d.name}
                  type="button"
                  onClick={() => selectDevice(d)}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${form.device_name === d.name ? 'border-brand-green bg-green-50 text-brand-green font-medium' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  {d.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Nazwa urządzenia"
              placeholder="np. Lodówka 1"
              value={form.device_name}
              onChange={(e) => setForm((p) => ({ ...p, device_name: e.target.value }))}
              required
            />
            <Input
              label="Temperatura (°C)"
              type="number"
              step="0.1"
              placeholder="np. 3.5"
              value={form.temperature}
              onChange={(e) => setForm((p) => ({ ...p, temperature: e.target.value }))}
              required
            />
            <Input
              label="Min. norma (°C)"
              type="number"
              step="0.5"
              placeholder="np. 0"
              value={form.min_ok}
              onChange={(e) => setForm((p) => ({ ...p, min_ok: e.target.value }))}
              required
            />
            <Input
              label="Max. norma (°C)"
              type="number"
              step="0.5"
              placeholder="np. 4"
              value={form.max_ok}
              onChange={(e) => setForm((p) => ({ ...p, max_ok: e.target.value }))}
              required
            />
          </div>

          <Input
            label="Uwagi (opcjonalnie)"
            placeholder="Dodatkowe informacje..."
            value={form.notes}
            onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
          />

          <Button type="submit" loading={loading} className={success ? 'bg-green-600' : ''}>
            {success ? 'Zapisano!' : 'Zapisz wpis'}
          </Button>
        </form>
      )}
    </div>
  )
}
