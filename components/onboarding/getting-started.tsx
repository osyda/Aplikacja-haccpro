import Link from 'next/link'
import { CheckCircle2, Circle, ChevronRight, Rocket } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface OnboardingStep {
  id: string
  label: string
  description: string
  done: boolean
  href: string
  ctaLabel: string
}

interface GettingStartedProps {
  steps: OnboardingStep[]
}

export function GettingStarted({ steps }: GettingStartedProps) {
  const doneCount = steps.filter(s => s.done).length
  if (doneCount === steps.length) return null

  const progress = Math.round((doneCount / steps.length) * 100)
  const nextStep = steps.find(s => !s.done)

  return (
    <div className="rounded-2xl border-2 border-brand-navy/15 bg-brand-navy/5 p-5 space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="p-2 bg-brand-navy/10 rounded-xl">
          <Rocket size={18} className="text-brand-navy" />
        </div>
        <div>
          <p className="font-bold text-gray-900">Pierwsze kroki</p>
          <p className="text-xs text-gray-500">Ukończono {doneCount} z {steps.length}</p>
        </div>
      </div>

      <div className="w-full bg-white/60 rounded-full h-2 overflow-hidden">
        <div className="h-full rounded-full bg-brand-navy transition-all" style={{ width: `${progress}%` }} />
      </div>

      <div className="space-y-1.5">
        {steps.map(step => (
          <Link
            key={step.id}
            href={step.href}
            className={cn(
              'flex items-center gap-3 p-3 rounded-xl border transition-colors',
              step.done
                ? 'border-transparent text-gray-400'
                : 'border-gray-100 bg-white hover:border-brand-navy/30 hover:bg-brand-navy/5'
            )}
          >
            {step.done
              ? <CheckCircle2 size={18} className="text-brand-green shrink-0" />
              : <Circle size={18} className="text-gray-300 shrink-0" />}
            <div className="min-w-0 flex-1">
              <p className={cn('text-sm font-semibold', step.done ? 'line-through text-gray-400' : 'text-gray-900')}>
                {step.label}
              </p>
              {!step.done && <p className="text-xs text-gray-500 mt-0.5">{step.description}</p>}
            </div>
            {!step.done && <ChevronRight size={16} className="text-gray-300 shrink-0" />}
          </Link>
        ))}
      </div>

      {nextStep && (
        <Link
          href={nextStep.href}
          className="w-full flex items-center justify-center gap-2 bg-brand-green hover:bg-brand-green-dark text-white rounded-xl py-3.5 text-sm font-bold transition-colors min-h-[52px]"
        >
          {nextStep.ctaLabel}
          <ChevronRight size={16} />
        </Link>
      )}
    </div>
  )
}
