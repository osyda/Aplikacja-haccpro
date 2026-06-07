import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CompactRecordCardProps {
  dotClassName?: string
  title: string
  value?: React.ReactNode
  meta?: React.ReactNode
  badge?: React.ReactNode
  onClick?: () => void
  className?: string
}

export function CompactRecordCard({ dotClassName, title, value, meta, badge, onClick, className }: CompactRecordCardProps) {
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 text-left transition-colors',
        onClick && 'hover:border-gray-200 hover:bg-gray-50',
        className
      )}
    >
      {dotClassName && <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', dotClassName)} />}
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-gray-900 text-sm truncate">{title}</p>
        {meta && <p className="text-xs text-gray-500 mt-0.5 truncate">{meta}</p>}
      </div>
      {value && <div className="shrink-0 text-right">{value}</div>}
      {badge && <div className="shrink-0">{badge}</div>}
      {onClick && <ChevronRight size={16} className="text-gray-300 shrink-0" />}
    </Comp>
  )
}
