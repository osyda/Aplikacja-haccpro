import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="card border-dashed border-2 border-gray-200 text-center py-12">
      <Icon size={32} className="mx-auto text-gray-300 mb-3" />
      <p className="text-gray-500 mb-1">{title}</p>
      {description && <p className="text-sm text-gray-400">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
