'use client'

import { Fragment } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Dialog, Transition } from '@headlessui/react'
import { cn } from '@/lib/utils'
import {
  Thermometer, Truck, Droplets, GraduationCap, AlertTriangle,
  Bug, FileText, Clock, Settings, LayoutDashboard, Apple,
  Menu, X, LogOut, Stethoscope, Recycle, FlaskConical, Trash2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useMobileNav } from './mobile-nav-context'
import type { AppPermissions } from '@/lib/permissions'

const navItems: { href: string; label: string; icon: typeof LayoutDashboard; permission: keyof AppPermissions | null }[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: null },
  { href: '/temperatury', label: 'Temperatury', icon: Thermometer, permission: 'temperatures' },
  { href: '/dostawy', label: 'Dostawy', icon: Truck, permission: 'deliveries' },
  { href: '/mycie', label: 'Mycie i dezynfekcja', icon: Droplets, permission: 'cleaning' },
  { href: '/olej', label: 'Odbiór oleju', icon: Recycle, permission: 'oil_collection' },
  { href: '/badania-wody', label: 'Badania wody', icon: FlaskConical, permission: 'water_tests' },
  { href: '/odpady', label: 'Odpady', icon: Trash2, permission: 'waste' },
  { href: '/szkolenia', label: 'Szkolenia', icon: GraduationCap, permission: 'training' },
  { href: '/orzeczenia', label: 'Orzeczenia', icon: Stethoscope, permission: 'certificates' },
  { href: '/niezgodnosci', label: 'Niezgodności', icon: AlertTriangle, permission: 'nonconformities' },
  { href: '/ddd', label: 'Kontrola DDD', icon: Bug, permission: 'ddd' },
  { href: '/alergeny', label: 'Alergeny', icon: Apple, permission: 'allergens' },
  { href: '/raporty', label: 'Raporty PDF', icon: FileText, permission: 'reports' },
  { href: '/historia', label: 'Historia zmian', icon: Clock, permission: 'history' },
  { href: '/ustawienia', label: 'Ustawienia', icon: Settings, permission: 'settings' },
]

export function MobileNav({ locationName, permissions }: { locationName?: string; permissions: AppPermissions }) {
  const { open, setOpen } = useMobileNav()
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const visible = navItems.filter(item => item.permission === null || permissions[item.permission])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        aria-label="Otwórz menu"
      >
        <Menu size={20} />
      </button>

      <Transition show={open} as={Fragment}>
        <Dialog onClose={() => setOpen(false)} className="relative z-50 lg:hidden">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/40" />
          </Transition.Child>

          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="-translate-x-full"
            enterTo="translate-x-0"
            leave="ease-in duration-150"
            leaveFrom="translate-x-0"
            leaveTo="-translate-x-full"
          >
            <Dialog.Panel className="fixed inset-y-0 left-0 w-72 bg-brand-navy text-white flex flex-col">
              <div className="p-5 flex items-center justify-between border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-brand-green rounded-lg flex items-center justify-center text-white font-bold text-sm">
                    H
                  </div>
                  <div>
                    <p className="font-bold text-sm">HACCPro</p>
                    {locationName && <p className="text-xs text-white/50 truncate max-w-36">{locationName}</p>}
                  </div>
                </div>
                <button onClick={() => setOpen(false)} className="p-1 text-white/60 hover:text-white">
                  <X size={18} />
                </button>
              </div>

              <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
                {visible.map((item) => {
                  const Icon = item.icon
                  const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
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
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                >
                  <LogOut size={14} />
                  Wyloguj się
                </button>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </Dialog>
      </Transition>
    </>
  )
}
