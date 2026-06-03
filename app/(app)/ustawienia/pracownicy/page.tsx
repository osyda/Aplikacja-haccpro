'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft, Users, Crown, User, ChevronDown, ChevronUp, Check, Save, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  resolvePermissions, isOwnerRole,
  DEFAULT_STAFF_PERMISSIONS, OWNER_PERMISSIONS,
} from '@/lib/permissions'
import type { AppPermissions } from '@/lib/permissions'

interface StaffProfile {
  id: string
  full_name: string
  email: string
  role: string | null
  permissions: Partial<AppPermissions> | null
}

const PERMISSION_GROUPS: {
  label: string
  key: keyof AppPermissions
  children?: { label: string; key: keyof AppPermissions }[]
}[] = [
  {
    label: 'Temperatury',
    key: 'temperatures',
    children: [{ label: 'Zarządzanie urządzeniami', key: 'temperatures_manage_devices' }],
  },
  { label: 'Dostawy', key: 'deliveries' },
  {
    label: 'Mycie i dezynfekcja',
    key: 'cleaning',
    children: [{ label: 'Zarządzanie obszarami i środkami', key: 'cleaning_manage_areas' }],
  },
  { label: 'Niezgodności', key: 'nonconformities' },
  { label: 'Szkolenia', key: 'training' },
  { label: 'Orzeczenia lekarskie', key: 'certificates' },
  { label: 'Kontrola DDD', key: 'ddd' },
  { label: 'Alergeny', key: 'allergens' },
  { label: 'Raporty PDF', key: 'reports' },
  { label: 'Historia zmian', key: 'history' },
  { label: 'Ustawienia', key: 'settings' },
]

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
        checked ? 'bg-green-500' : 'bg-gray-200',
        disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'
      )}
    >
      <span className={cn(
        'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out',
        checked ? 'translate-x-5' : 'translate-x-0'
      )} />
    </button>
  )
}

function EmployeeEditor({
  member,
  currentUserId,
  onSaved,
  onRemoved,
}: {
  member: StaffProfile
  currentUserId: string
  onSaved: (updated: StaffProfile) => void
  onRemoved: () => void
}) {
  const isCurrentUser = member.id === currentUserId
  const [role, setRole] = useState(member.role ?? 'staff')
  const [perms, setPerms] = useState<AppPermissions>(() =>
    resolvePermissions(member.role, member.permissions)
  )
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const isOwner = isOwnerRole(role)

  function toggle(key: keyof AppPermissions, value: boolean) {
    setPerms(p => {
      const next = { ...p, [key]: value }
      if (!value) {
        if (key === 'temperatures') next.temperatures_manage_devices = false
        if (key === 'cleaning') next.cleaning_manage_areas = false
      }
      return next
    })
  }

  async function handleSave() {
    setSaving(true)
    const res = await fetch('/api/set-permissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId: member.id, role, permissions: isOwner ? null : perms }),
    })
    setSaving(false)
    if (!res.ok) {
      const err = await res.json()
      toast.error('Błąd: ' + (err.error ?? 'Nieznany błąd'))
      return
    }
    toast.success('Uprawnienia zapisane')
    onSaved({ ...member, role, permissions: isOwner ? null : perms })
  }

  async function handleDelete() {
    setDeleting(true)
    const res = await fetch('/api/remove-staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId: member.id }),
    })
    setDeleting(false)
    if (!res.ok) {
      const err = await res.json()
      toast.error('Błąd: ' + (err.error ?? 'Nieznany błąd'))
      return
    }
    toast.success(`${member.full_name || member.email} został usunięty`)
    onRemoved()
  }

  return (
    <div className="border-t border-gray-100 pt-4 mt-2 space-y-4">
      {/* Role */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Rola</p>
        <div className="flex gap-2">
          {[
            { value: 'owner', label: 'Właściciel', icon: Crown, active: 'border-yellow-400 bg-yellow-50 text-yellow-800' },
            { value: 'staff',  label: 'Pracownik',  icon: User,  active: 'border-green-400 bg-green-50 text-green-800' },
          ].map(({ value, label, icon: Icon, active }) => (
            <button
              key={value}
              type="button"
              disabled={isCurrentUser && value !== role}
              onClick={() => {
                setRole(value)
                setPerms(isOwnerRole(value) ? OWNER_PERMISSIONS : resolvePermissions('staff', member.permissions))
              }}
              className={cn(
                'flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all',
                role === value ? active : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300',
                isCurrentUser && value !== role && 'opacity-30 cursor-not-allowed'
              )}
            >
              <Icon size={14} />
              {label}
              {role === value && <Check size={13} className="ml-auto" />}
            </button>
          ))}
        </div>
        {isCurrentUser && (
          <p className="text-xs text-gray-400 mt-1.5">Nie możesz zmienić własnej roli.</p>
        )}
      </div>

      {/* Permissions */}
      {!isOwner && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Dostęp do modułów</p>
          <div className="rounded-xl border border-gray-100 divide-y divide-gray-100 overflow-hidden">
            {PERMISSION_GROUPS.map(group => (
              <div key={group.key} className="bg-white">
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-gray-800">{group.label}</span>
                  <Toggle checked={perms[group.key]} onChange={v => toggle(group.key, v)} />
                </div>
                {group.children && perms[group.key] && (
                  <div className="border-t border-gray-50 bg-gray-50/60">
                    {group.children.map(child => (
                      <div key={child.key} className="flex items-center justify-between px-4 py-2.5 pl-7">
                        <span className="text-xs text-gray-500">{child.label}</span>
                        <Toggle checked={perms[child.key]} onChange={v => toggle(child.key, v)} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {isOwner && (
        <div className="px-4 py-3 bg-yellow-50 border border-yellow-200 rounded-xl text-sm text-yellow-800">
          Właściciel ma dostęp do wszystkich modułów i funkcji.
        </div>
      )}

      {/* Save */}
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold text-sm transition-colors disabled:opacity-60"
      >
        {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
        {saving ? 'Zapisywanie…' : 'Zapisz uprawnienia'}
      </button>

      {/* Delete */}
      {!isCurrentUser && (
        confirmDelete ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Anuluj
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors disabled:opacity-60"
            >
              {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              {deleting ? 'Usuwanie…' : 'Tak, usuń'}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium transition-colors"
          >
            <Trash2 size={14} />
            Usuń pracownika
          </button>
        )
      )}
    </div>
  )
}

function InviteForm() {
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setSending(true)
    const res = await fetch('/api/invite-staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim() }),
    })
    setSending(false)
    if (!res.ok) {
      const err = await res.json()
      toast.error('Błąd: ' + (err.error ?? 'Nieznany błąd'))
      return
    }
    toast.success('Zaproszenie wysłane na ' + email.trim())
    setEmail('')
  }

  return (
    <div className="card space-y-3">
      <div>
        <p className="text-sm font-semibold text-gray-800">Zaproś pracownika</p>
        <p className="text-xs text-gray-500 mt-0.5">
          Pracownik otrzyma email z linkiem do ustawienia hasła.
          Link musi być otwarty w przeglądarce gdzie pracownik <strong>nie jest zalogowany</strong> (np. tryb incognito).
        </p>
      </div>
      <form onSubmit={handleInvite} className="flex gap-2">
        <input
          type="email"
          className="input flex-1 text-sm"
          placeholder="email@pracownika.pl"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />
        <button
          type="submit"
          disabled={sending}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors disabled:opacity-60 shrink-0"
        >
          {sending && <Loader2 size={14} className="animate-spin" />}
          {sending ? 'Wysyłanie…' : 'Wyślij zaproszenie'}
        </button>
      </form>
    </div>
  )
}

export default function PracownicyPage() {
  const [staff, setStaff] = useState<StaffProfile[]>([])
  const [currentUserId, setCurrentUserId] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [currentUserRole, setCurrentUserRole] = useState<string>('staff')
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCurrentUserId(user.id)
      const { data: profile } = await supabase.from('profiles').select('org_id, role').eq('id', user.id).single()
      setCurrentUserRole(profile?.role ?? 'staff')
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, permissions')
        .eq('org_id', profile?.org_id ?? '')
        .order('role')
      setStaff(data ?? [])
    }
    load()
  }, [])

  const isCurrentOwner = isOwnerRole(currentUserRole)

  const ROLE_CONFIG: Record<string, { label: string; cls: string }> = {
    owner:   { label: 'Właściciel', cls: 'text-yellow-700 bg-yellow-50' },
    manager: { label: 'Kierownik',  cls: 'text-blue-700 bg-blue-50' },
    staff:   { label: 'Pracownik',  cls: 'text-gray-600 bg-gray-100' },
  }

  return (
    <div className="max-w-lg space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/ustawienia" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ChevronLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pracownicy</h1>
          <p className="text-sm text-gray-500 mt-0.5">Zarządzaj rolami i dostępem do systemu</p>
        </div>
      </div>

      {staff.length > 0 ? (
        <div className="card divide-y divide-gray-50">
          {staff.map(member => {
            const role = member.role ?? 'staff'
            const config = ROLE_CONFIG[role] ?? ROLE_CONFIG.staff
            const isExpanded = expandedId === member.id

            return (
              <div key={member.id} className="py-3">
                <div className="flex items-center gap-3">
                  <div className={cn('p-2 rounded-lg shrink-0', config.cls)}>
                    {isOwnerRole(role) ? <Crown size={15} /> : <User size={15} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 truncate">{member.full_name || '(bez nazwy)'}</p>
                    <p className="text-xs text-gray-400 truncate">{member.email}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full hidden sm:block', config.cls)}>
                      {config.label}
                    </span>
                    {isCurrentOwner && (
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : member.id)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-gray-600"
                      >
                        Edytuj
                        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                    )}
                  </div>
                </div>

                {isExpanded && isCurrentOwner && (
                  <EmployeeEditor
                    member={member}
                    currentUserId={currentUserId}
                    onSaved={(updated) => {
                      setStaff(prev => prev.map(m => m.id === updated.id ? updated : m))
                      setExpandedId(null)
                    }}
                    onRemoved={() => {
                      setStaff(prev => prev.filter(m => m.id !== member.id))
                      setExpandedId(null)
                    }}
                  />
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="card border-dashed border-2 border-gray-200 text-center py-12">
          <Users size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">Brak pracowników w organizacji</p>
        </div>
      )}

      {isCurrentOwner && <InviteForm />}
    </div>
  )
}
