import { cn } from '@/lib/utils'

interface FilterChipsProps<T extends string> {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string; count?: number }[]
}

export function FilterChips<T extends string>({ value, onChange, options }: FilterChipsProps<T>) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'px-3.5 py-2 rounded-full text-xs font-semibold whitespace-nowrap border transition-colors shrink-0',
            value === opt.value
              ? 'bg-brand-navy text-white border-brand-navy'
              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
          )}
        >
          {opt.label}{opt.count !== undefined ? ` (${opt.count})` : ''}
        </button>
      ))}
    </div>
  )
}
