import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { MapPin, Users, ChevronRight } from 'lucide-react'
import { isOwnerRole } from '@/lib/permissions'
import { PushNotificationsToggle } from '@/components/settings/push-notifications-toggle'
import { ProfileForm } from '@/components/settings/profile-form'
import { getPlanDefinition } from '@/lib/plans'

export default async function UstawieniaPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, locations(name, address, city)')
    .eq('id', user!.id)
    .single()

  const isOwner = isOwnerRole(profile?.role)
  const location = (profile?.locations as { name: string; address: string; city: string } | null)

  const { data: org } = await supabase
    .from('organizations')
    .select('plan, grandfathered, trial_ends_at')
    .eq('id', profile?.org_id ?? '')
    .maybeSingle()

  const orgPlan = (org ?? {}) as { plan?: string | null; grandfathered?: boolean | null; trial_ends_at?: string | null }
  const planDef = getPlanDefinition(orgPlan.plan)
  const isTrial = (orgPlan.plan ?? 'trial') === 'trial'
  const trialDaysLeft = orgPlan.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(orgPlan.trial_ends_at).getTime() - Date.now()) / 86_400_000))
    : null
  const planSubtitle = orgPlan.grandfathered
    ? 'Pełny dostęp do wszystkich modułów'
    : isTrial && trialDaysLeft !== null
      ? `Trial — pozostało ${trialDaysLeft} ${trialDaysLeft === 1 ? 'dzień' : 'dni'}`
      : planDef.tagline

  const ownerSections = [
    { href: '/ustawienia/lokale', icon: MapPin, label: 'Lokale', desc: location ? `${location.name} — ${location.city}` : 'Dodaj lokal' },
    { href: '/ustawienia/pracownicy', icon: Users, label: 'Pracownicy', desc: 'Zarządzaj dostępem' },
  ]

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ustawienia</h1>
        <p className="text-sm text-gray-500 mt-0.5">Profil i zarządzanie kontem</p>
      </div>

      <div className="card space-y-1">
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
          <div className="w-10 h-10 bg-brand-navy rounded-full flex items-center justify-center text-white font-bold">
            {user?.email?.[0].toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-sm text-gray-900">{profile?.full_name ?? 'Użytkownik'}</p>
            <p className="text-xs text-gray-500">{user?.email}</p>
          </div>
          <div className="ml-auto">
            <span className="px-2 py-0.5 bg-brand-green text-white text-xs rounded-full font-medium capitalize">
              {profile?.role ?? 'staff'}
            </span>
          </div>
        </div>
      </div>

      <ProfileForm
        userId={user!.id}
        initialFullName={profile?.full_name ?? ''}
        initialPhone={profile?.phone ?? ''}
      />

      <PushNotificationsToggle />

      {isOwner && (
        <div className="card divide-y divide-gray-50">
          {ownerSections.map((s) => {
            const Icon = s.icon
            return (
              <Link key={s.href} href={s.href} className="flex items-center gap-3 py-3 hover:bg-gray-50 -mx-4 px-4 transition-colors first:rounded-t-xl last:rounded-b-xl">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Icon size={16} className="text-gray-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{s.label}</p>
                  <p className="text-xs text-gray-500">{s.desc}</p>
                </div>
                <ChevronRight size={14} className="text-gray-300" />
              </Link>
            )
          })}
        </div>
      )}

      {isOwner && (
        <div className="card bg-brand-navy text-white">
          <p className="text-sm font-semibold mb-1">Plan: {planDef.name}</p>
          <p className="text-xs text-white/60 mb-3">{planSubtitle}</p>
          <a href="#" className="inline-flex items-center gap-1.5 bg-brand-green hover:bg-brand-green-dark text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            {isTrial ? 'Wybierz plan' : 'Zmień plan'}
          </a>
        </div>
      )}
    </div>
  )
}
