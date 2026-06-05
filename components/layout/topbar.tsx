'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { LogOut, MapPin, Bell, ChevronDown, Check, Building2, Shield } from 'lucide-react'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { MobileNav } from './mobile-nav'
import { cn } from '@/lib/utils'

interface Location { id: string; name: string }

interface TopbarProps {
  locationName?: string
  userEmail?: string
  locations?: Location[]
  currentLocationId?: string
  isSuperadmin?: boolean
}

export function Topbar({
  locationName = 'Mój lokal',
  userEmail,
  locations = [],
  currentLocationId = '',
  isSuperadmin = false,
}: TopbarProps) {
  const router = useRouter()
  const supabase = createClient()
  const [showSwitcher, setShowSwitcher] = useState(false)
  const [switching, setSwitching] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const hasMultiple = locations.length > 1

  // Close dropdown when clicking outside
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowSwitcher(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  async function switchLocation(locationId: string) {
    if (locationId === currentLocationId || switching) return
    setSwitching(true)
    setShowSwitcher(false)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('profiles').update({ location_id: locationId }).eq('id', user.id)
    }
    router.refresh()
    setSwitching(false)
  }

  return (
    <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-between px-4 md:px-6 fixed top-0 right-0 left-0 lg:left-64 z-20">
      <div className="flex items-center gap-3">
        <div className="lg:hidden">
          <MobileNav locationName={locationName} />
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-600">
          {/* Location switcher */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => hasMultiple && setShowSwitcher(!showSwitcher)}
              disabled={switching}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-2 py-1 -mx-2 -my-1 transition-colors',
                hasMultiple ? 'hover:bg-gray-100 cursor-pointer' : 'cursor-default',
                switching && 'opacity-60'
              )}
            >
              <MapPin size={14} className="text-brand-green shrink-0" />
              <span className="font-medium text-gray-900 truncate max-w-32 md:max-w-48">
                {switching ? '…' : locationName}
              </span>
              {hasMultiple && (
                <ChevronDown
                  size={14}
                  className={cn('text-gray-400 shrink-0 transition-transform', showSwitcher && 'rotate-180')}
                />
              )}
            </button>

            {showSwitcher && (
              <div className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg z-50 min-w-52 py-1 overflow-hidden">
                <p className="px-3 py-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                  Przełącz lokal
                </p>
                {locations.map(loc => {
                  const isActive = loc.id === currentLocationId
                  return (
                    <button
                      key={loc.id}
                      onClick={() => switchLocation(loc.id)}
                      className={cn(
                        'w-full flex items-center justify-between gap-3 px-3 py-2.5 text-sm transition-colors text-left',
                        isActive
                          ? 'bg-green-50 text-green-800 font-semibold'
                          : 'text-gray-700 hover:bg-gray-50'
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Building2 size={14} className={isActive ? 'text-green-600' : 'text-gray-400'} />
                        <span className="truncate">{loc.name}</span>
                      </div>
                      {isActive && <Check size={14} className="text-green-600 shrink-0" />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <span className="text-gray-400 hidden sm:block">•</span>
          <span className="hidden sm:block">{formatDate(new Date())}</span>
        </div>
      </div>

      <div className="flex items-center gap-1 md:gap-2">
        {isSuperadmin && (
          <Link
            href="/superadmin"
            title="Panel właściciela"
            className="p-2 text-brand-green hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors"
          >
            <Shield size={16} />
          </Link>
        )}
        <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
          <Bell size={16} />
        </button>
        {userEmail && (
          <span className="text-sm text-gray-500 hidden lg:block">{userEmail}</span>
        )}
        <button
          onClick={handleSignOut}
          className="flex items-center gap-1.5 px-2 md:px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <LogOut size={14} />
          <span className="hidden md:block">Wyloguj</span>
        </button>
      </div>
    </header>
  )
}
