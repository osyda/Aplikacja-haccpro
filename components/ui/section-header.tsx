import { Plus } from 'lucide-react'

interface SectionHeaderProps {
  title: string
  actionLabel: string
  onAction: () => void
}

/** Section title with a compact pill action button (e.g. "+ Nowy wpis") on the right. */
export function SectionHeader({ title, actionLabel, onAction }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="font-bold text-gray-900 text-lg">{title}</h2>
      <button type="button" onClick={onAction}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-green text-white text-xs font-bold hover:bg-brand-green-dark transition-colors shrink-0">
        <Plus size={14} /> {actionLabel}
      </button>
    </div>
  )
}
