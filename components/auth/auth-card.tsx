import { Sparkles } from 'lucide-react'
import { type ReactNode } from 'react'

interface AuthCardProps {
  icon?: ReactNode
  title: string
  subtitle?: string
  children: ReactNode
}

export function AuthCard({ icon, title, subtitle, children }: AuthCardProps) {
  return (
    <div className="bg-white rounded-2xl shadow-xl shadow-brand-navy/10 overflow-hidden">
      <div className="bg-brand-navy px-6 py-6">
        <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center mb-3">
          {icon ?? <Sparkles size={16} className="text-brand-green" />}
        </div>
        <h2 className="text-xl font-bold text-white">{title}</h2>
        {subtitle && <p className="text-sm text-white/55 mt-1">{subtitle}</p>}
      </div>
      <div className="px-6 py-6">{children}</div>
    </div>
  )
}
