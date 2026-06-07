interface FormSectionProps {
  title?: string
  description?: string
  children: React.ReactNode
}

export function FormSection({ title, description, children }: FormSectionProps) {
  return (
    <div className="space-y-2">
      {title && <p className="text-sm font-semibold text-gray-700">{title}</p>}
      {description && <p className="text-xs text-gray-500 -mt-1">{description}</p>}
      {children}
    </div>
  )
}
