'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { LogOut, MapPin, Bell } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface TopbarProps {
  locationName?: string
  userEmail?: string
}

export function Topbar({ locationName = 'Mój lokal', userEmail }: TopbarProps) {
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-between px-6 fixed top-0 right-0 left-64 z-20">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <MapPin size={14} className="text-brand-green" />
        <span className="font-medium text-gray-900">{locationName}</span>
        <span className="text-gray-400">•</span>
        <span>Dzisiaj, {formatDate(new Date())}</span>
      </div>

      <div className="flex items-center gap-2">
        <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors relative">
          <Bell size={16} />
        </button>
        {userEmail && (
          <span className="text-sm text-gray-500 hidden md:block">{userEmail}</span>
        )}
        <button
          onClick={handleSignOut}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <LogOut size={14} />
          Wyloguj
        </button>
      </div>
    </header>
  )
}
