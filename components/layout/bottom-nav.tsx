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
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 flex lg:hidden">
      {visible.map(({ href, label, Icon }) => {
        const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex-1 flex flex-col items-center gap-0.5 py-2.5 px-1 text-[11px] font-medium transition-colors',
              active ? 'text-brand-green' : 'text-gray-400'
            )}
          >
            <Icon size={22} strokeWidth={active ? 2.5 : 1.75} />
            <span>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
