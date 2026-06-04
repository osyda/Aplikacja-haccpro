'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Thermometer, Truck, Droplets, GraduationCap, AlertTriangle,
  Bug, FileText, Clock, Settings, LayoutDashboard, Apple, Stethoscope,
} from 'lucide-react'
import type { AppPermissions } from '@/lib/permissions'

const NAV_ITEMS = [
  { href: '/dashboard',     label: 'Dashboard',           icon: LayoutDashboard, permission: null },
  { href: '/temperatury',   label: 'Temperatury',          icon: Thermometer,     permission: 'temperatures' },
  { href: '/dostawy',       label: 'Dostawy',              icon: Truck,           permission: 'deliveries' },
  { href: '/mycie',         label: 'Mycie i dezynfekcja',  icon: Droplets,        permission: 'cleaning' },
  { href: '/niezgodnosci',  label: 'Niezgodności',         icon: AlertTriangle,   permission: 'nonconformities' },
  { href: '/szkolenia',     label: 'Szkolenia',            icon: GraduationCap,   permission: 'training' },
  { href: '/orzeczenia',    label: 'Orzeczenia',           icon: Stethoscope,     permission: 'certificates' },
  { href: '/ddd',           label: 'Kontrola DDD',         icon: Bug,             permission: 'ddd' },
  { href: '/alergeny',      label: 'Alergeny',             icon: Apple,           permission: 'allergens' },
  { href: '/raporty',       label: 'Raporty PDF',          icon: FileText,        permission: 'reports' },
  { href: '/historia',      label: 'Historia zmian',       icon: Clock,           permission: 'history' },
  { href: '/ustawienia',    label: 'Ustawienia',           icon: Settings,        permission: 'settings' },
] as const

export function Sidebar({ permissions, openNonconformities = 0 }: { permissions: AppPermissions; openNonconformities?: number }) {
  const pathname = usePathname()

  const visible = NAV_ITEMS.filter(item =>
    item.permission === null || permissions[item.permission as keyof AppPermissions]
  )

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
        {visible.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          const badge = item.href === '/niezgodnosci' && openNonconformities > 0 ? openNonconformities : null
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
              <span className="flex-1">{item.label}</span>
              {badge && (
                <span className="ml-auto min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
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
