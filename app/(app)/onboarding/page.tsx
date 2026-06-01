'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { MapPin, CheckCircle2, Thermometer, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const schema = z.object({
  name: z.string().min(2, 'Podaj nazwę lokalu'),
  type: z.string().min(1, 'Wybierz typ lokalu'),
  address: z.string().min(3, 'Podaj adres'),
  city: z.string().min(2, 'Podaj miasto'),
})

type FormData = z.infer<typeof schema>

const LOCATION_TYPES = ['Restauracja', 'Bar', 'Kawiarnia', 'Pizzeria', 'Fast-food', 'Stołówka', 'Catering', 'Sklep spożywczy', 'Inny']

const STEPS = [
  { id: 1, label: 'Twój lokal', icon: MapPin },
  { id: 2, label: 'Gotowe!', icon: CheckCircle2 },
]

export default function OnboardingPage() {
  const [step, setStep] = useState(1)
  const [selectedType, setSelectedType] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
  })

  async function onSubmit(data: FormData) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()

    const { data: loc, error } = await supabase.from('locations').insert({
      org_id: profile?.org_id ?? '',
      name: data.name,
      type: data.type,
      address: data.address,
      city: data.city,
    }).select().single()

    if (error) {
      toast.error('Błąd tworzenia lokalu')
      return
    }

    await supabase.from('profiles').update({ location_id: loc.id }).eq('id', user.id)

    setStep(2)
  }

  if (step === 2) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 size={40} className="text-brand-green" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gotowe! Witaj w HACCPro</h1>
            <p className="text-gray-500 mt-2">Twój lokal jest skonfigurowany. Możesz zacząć prowadzić rejestry HACCP.</p>
          </div>

          <div className="card text-left space-y-3">
            <p className="text-sm font-medium text-gray-700">Pierwsze kroki:</p>
            {[
              { icon: Thermometer, label: 'Dodaj pierwszy odczyt temperatury', href: '/temperatury' },
              { icon: MapPin, label: 'Skonfiguruj normy urządzeń', href: '/ustawienia/lokale' },
            ].map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.href}
                  onClick={() => router.push(item.href)}
                  className="w-full flex items-center gap-3 p-3 border border-gray-100 rounded-lg hover:border-brand-green hover:bg-green-50 transition-colors"
                >
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <Icon size={16} className="text-gray-600" />
                  </div>
                  <span className="text-sm text-gray-700">{item.label}</span>
                  <ChevronRight size={14} className="text-gray-300 ml-auto" />
                </button>
              )
            })}
          </div>

          <Button size="lg" className="w-full" onClick={() => router.push('/')}>
            Przejdź do dashboardu
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-brand-navy rounded-xl mb-4">
            <span className="text-white font-bold text-xl">H</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Konfiguracja lokalu</h1>
          <p className="text-gray-500 text-sm mt-1">Uzupełnij dane swojego punktu gastronomicznego</p>
        </div>

        <div className="flex items-center justify-center gap-4 mb-2">
          {STEPS.map((s) => {
            const Icon = s.icon
            const active = step === s.id
            const done = step > s.id
            return (
              <div key={s.id} className="flex items-center gap-1.5">
                <div className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors',
                  done ? 'bg-brand-green text-white' : active ? 'bg-brand-navy text-white' : 'bg-gray-200 text-gray-500'
                )}>
                  {done ? '✓' : s.id}
                </div>
                <span className={cn('text-xs', active ? 'text-gray-900 font-medium' : 'text-gray-400')}>{s.label}</span>
              </div>
            )
          })}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="card space-y-4">
          <div>
            <label className="label">Typ lokalu</label>
            <div className="flex flex-wrap gap-2">
              {LOCATION_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setSelectedType(t); setValue('type', t) }}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm border transition-colors',
                    selectedType === t
                      ? 'border-brand-green bg-green-50 text-brand-green font-medium'
                      : 'border-gray-200 hover:border-gray-300'
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
            {errors.type && <p className="text-xs text-red-600 mt-0.5">{errors.type.message}</p>}
          </div>

          <div>
            <label className="label">Nazwa lokalu</label>
            <input {...register('name')} placeholder="np. Pizzeria Mario" className="input" />
            {errors.name && <p className="text-xs text-red-600 mt-0.5">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="label">Adres</label>
              <input {...register('address')} placeholder="ul. Główna 1" className="input" />
              {errors.address && <p className="text-xs text-red-600 mt-0.5">{errors.address.message}</p>}
            </div>
            <div>
              <label className="label">Miasto</label>
              <input {...register('city')} placeholder="Kraków" className="input" />
              {errors.city && <p className="text-xs text-red-600 mt-0.5">{errors.city.message}</p>}
            </div>
          </div>

          <Button type="submit" loading={isSubmitting} size="lg" className="w-full">
            Utwórz lokal i przejdź dalej
          </Button>
        </form>
      </div>
    </div>
  )
}
