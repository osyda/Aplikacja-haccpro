import { AlertTriangle, AlertCircle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

type AlertVariant = 'error' | 'warning' | 'info'

interface AlertBoxProps {
  variant: AlertVariant
  title: string
  description?: string
  action?: React.ReactNode
}

const VARIANT_STYLE: Record<AlertVariant, { wrap: string; icon: string; title: string; desc: string; Icon: typeof AlertTriangle }> = {
  error: {
    wrap: 'border-red-200 bg-red-50',
    icon: 'text-red-600',
    title: 'text-red-800',
    desc: 'text-red-600',
    Icon: AlertTriangle,
  },
  warning: {
    wrap: 'border-orange-200 bg-orange-50',
    icon: 'text-orange-600',
    title: 'text-orange-800',
    desc: 'text-orange-600',
    Icon: AlertCircle,
  },
  info: {
    wrap: 'border-blue-200 bg-blue-50',
    icon: 'text-blue-600',
    title: 'text-blue-800',
    desc: 'text-blue-600',
    Icon: Info,
  },
}

export function AlertBox({ variant, title, description, action }: AlertBoxProps) {
  const s = VARIANT_STYLE[variant]
  return (
    <div className={cn('rounded-xl border-2 p-4 flex items-start gap-3', s.wrap)}>
      <s.Icon size={18} className={cn('mt-0.5 shrink-0', s.icon)} />
      <div className="min-w-0">
        <p className={cn('font-bold text-sm', s.title)}>{title}</p>
        {description && <p className={cn('text-xs mt-0.5', s.desc)}>{description}</p>}
      </div>
      {action && <div className="ml-auto shrink-0">{action}</div>}
    </div>
  )
}
