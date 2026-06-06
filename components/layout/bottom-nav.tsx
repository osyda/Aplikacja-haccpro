'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Thermometer, Truck, Droplets, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AppPermissions } from '@/lib/permissions'

const ITEMS = [
  { href: '/dashboard',   label: 'Start',    Icon: LayoutDashboard, permission: null },
  { href: '/temperatury', label: 'Temp.',     Icon: Thermometer,     permission: 'temperatures' },
  { href: '/dostawy',     label: 'Dostawy',   Icon: Truck,           permission: 'deliveries' },
  { href: '/mycie',       label: 'Mycie',     Icon: Droplets,        permission: 'cleaning' },
  { href: '/raporty',     label: 'Raporty',   Icon: FileText,        permission: 'reports' },
] as const

export function BottomNav({ permissions }: { permissions: AppPermissions }) {
  const pathname = usePathname()

  const visible = ITEMS.filter(item =>
    item.permission === null || permissions[item.permission as keyof AppPermissions]
  )

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-[#1B2E4B] shadow-[0_-4px_24px_rgba(0,0,0,0.25)] flex lg:hidden pb-safe">
      {visible.map(({ href, label, Icon }) => {
        const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
        return (
          <Link
            key={href}
            href={href}
            className="flex-1 flex flex-col items-center gap-1 py-3 px-1 text-[11px] font-semibold transition-colors"
          >
            <span className={cn(
              'flex items-center justify-center w-12 h-8 rounded-2xl transition-all',
              active ? 'bg-[#22C55E]/20' : ''
            )}>
              <Icon
                size={22}
                strokeWidth={active ? 2.5 : 1.75}
                className={cn(active ? 'text-[#22C55E]' : 'text-white/40')}
              />
            </span>
            <span className={cn(active ? 'text-[#22C55E]' : 'text-white/40')}>
              {label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
