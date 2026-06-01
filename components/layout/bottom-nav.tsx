'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Thermometer, Truck, Droplets, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

const ITEMS = [
  { href: '/dashboard', label: 'Start', Icon: LayoutDashboard },
  { href: '/temperatury', label: 'Temp.', Icon: Thermometer },
  { href: '/dostawy', label: 'Dostawy', Icon: Truck },
  { href: '/mycie', label: 'Mycie', Icon: Droplets },
  { href: '/raporty', label: 'Raporty', Icon: FileText },
]

export function BottomNav() {
  const pathname = usePathname()
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 flex lg:hidden">
      {ITEMS.map(({ href, label, Icon }) => {
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
