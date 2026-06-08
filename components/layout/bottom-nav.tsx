'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Thermometer, Truck, Droplets, Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AppPermissions } from '@/lib/permissions'
import { useMobileNav } from './mobile-nav-context'

const ITEMS = [
  { href: '/dashboard',   label: 'Start',    Icon: LayoutDashboard, permission: null },
  { href: '/temperatury', label: 'Temp.',     Icon: Thermometer,     permission: 'temperatures' },
  { href: '/dostawy',     label: 'Dostawy',   Icon: Truck,           permission: 'deliveries' },
  { href: '/mycie',       label: 'Mycie',     Icon: Droplets,        permission: 'cleaning' },
] as const

export function BottomNav({ permissions }: { permissions: AppPermissions }) {
  const pathname = usePathname()
  const { open, setOpen } = useMobileNav()

  const visible = ITEMS.filter(item =>
    item.permission === null || permissions[item.permission as keyof AppPermissions]
  )

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.08)] flex lg:hidden pb-safe">
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
              active ? 'bg-brand-navy/10' : ''
            )}>
              <Icon
                size={22}
                strokeWidth={active ? 2.5 : 1.75}
                className={cn(active ? 'text-brand-navy' : 'text-gray-400')}
              />
            </span>
            <span className={cn(active ? 'text-brand-navy' : 'text-gray-400')}>
              {label}
            </span>
          </Link>
        )
      })}

      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Otwórz menu"
        className="flex-1 flex flex-col items-center gap-1 py-3 px-1 text-[11px] font-semibold transition-colors"
      >
        <span className={cn(
          'flex items-center justify-center w-12 h-8 rounded-2xl transition-all',
          open ? 'bg-brand-navy/10' : ''
        )}>
          <Menu
            size={22}
            strokeWidth={open ? 2.5 : 1.75}
            className={cn(open ? 'text-brand-navy' : 'text-gray-400')}
          />
        </span>
        <span className={cn(open ? 'text-brand-navy' : 'text-gray-400')}>
          Więcej
        </span>
      </button>
    </nav>
  )
}
