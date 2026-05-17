import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ChevronLeft, Users, Crown, Shield, User } from 'lucide-react'
import type { UserRole } from '@/types/database'

const ROLE_CONFIG: Record<UserRole, { label: string; icon: typeof User; color: string }> = {
  owner: { label: 'Właściciel', icon: Crown, color: 'text-yellow-600 bg-yellow-50' },
  manager: { label: 'Kierownik', icon: Shield, color: 'text-blue-600 bg-blue-50' },
  staff: { label: 'Pracownik', icon: User, color: 'text-gray-600 bg-gray-100' },
}

export default async function PracownicyPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id, location_id')
    .eq('id', user!.id)
    .single()

  const { data: staff } = await supabase
    .from('profiles')
    .select('*')
    .eq('org_id', profile?.org_id ?? '')
    .order('role')

  return (
    <div className="max-w-lg space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/ustawienia" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ChevronLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pracownicy</h1>
          <p className="text-sm text-gray-500 mt-0.5">Zarządzaj dostępem do systemu</p>
        </div>
      </div>

      {staff && staff.length > 0 ? (
        <div className="card divide-y divide-gray-50">
          {staff.map((s) => {
            const role = (s.role as UserRole) ?? 'staff'
            const config = ROLE_CONFIG[role]
            const Icon = config.icon
            return (
              <div key={s.id} className="py-3 flex items-center gap-3">
                <div className={`p-2 rounded-lg ${config.color}`}>
                  <Icon size={16} />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm text-gray-900">{s.full_name}</p>
                  <p className="text-xs text-gray-500">{s.email}</p>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${config.color}`}>
                  {config.label}
                </span>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="card border-dashed border-2 border-gray-200 text-center py-12">
          <Users size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">Brak pracowników</p>
        </div>
      )}

      <div className="card bg-gray-50 border-dashed">
        <p className="text-sm font-medium text-gray-700 mb-1">Zaproś pracownika</p>
        <p className="text-xs text-gray-500">Funkcja zapraszania przez email — dostępna w Fazie 2 (Plan Pro+).</p>
      </div>
    </div>
  )
}
