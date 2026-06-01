'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Thermometer,
  Truck,
  Droplets,
  GraduationCap,
  AlertTriangle,
  Bug,
  FileText,
  Clock,
  Settings,
  LayoutDashboard,
  Apple,
  Stethoscope,
} from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/temperatury', label: 'Temperatury', icon: Thermometer },
  { href: '/dostawy', label: 'Dostawy', icon: Truck },
  { href: '/mycie', label: 'Mycie i dezynfekcja', icon: Droplets },
  { href: '/szkolenia', label: 'Szkolenia', icon: GraduationCap },
  { href: '/orzeczenia', label: 'Orzeczenia', icon: Stethoscope },
  { href: '/niezgodnosci', label: 'Niezgodności', icon: AlertTriangle },
  { href: '/ddd', label: 'Kontrola DDD', icon: Bug },
  { href: '/alergeny', label: 'Alergeny', icon: Apple },
  { href: '/raporty', label: 'Raporty PDF', icon: FileText },
  { href: '/historia', label: 'Historia zmian', icon: Clock },
  { href: '/ustawienia', label: 'Ustawienia', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden lg:flex w-64 bg-brand-navy text-white flex-col h-full fixed left-0 top-0 z-30">
      <div className="p-5 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-brand-green rounded-lg flex items-center justify-center text-white font-bold text-sm">
            H
          </div>
          <div>
            <p className="font-bold text-sm leading-tight">HACCPro</p>
            <p className="text-xs text-white/50">Rejestry HACCP</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                isActive
                  ? 'bg-white/10 text-white font-medium'
                  : 'text-white/70 hover:bg-white/5 hover:text-white'
              )}
            >
              <Icon size={16} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="p-3 border-t border-white/10">
        <p className="text-xs text-white/40 text-center">© 2026 HACCPro</p>
      </div>
    </aside>
  )
}
