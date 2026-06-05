'use client'

import { useState, useMemo, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Search, X, MessageSquare, ShieldOff, ShieldCheck,
  Building2, Users, MapPin, Loader2, Eye,
  CheckCircle2, AlertTriangle, ChevronDown, Mail,
  UserCircle, Crown, Shield, User, Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface OrgRow {
  id: string
  name: string
  plan: string
  is_active: boolean
  trial_ends_at: string | null
  admin_notes: string | null
  created_at: string
  owner_name: string
  owner_email: string
  location_count: number
  user_count: number
}

interface OrgProfile {
  id: string
  full_name: string | null
  email: string | null
  role: string | null
  location_id: string | null
  locations: { name: string } | null
}

interface OrgLocation {
  id: string
  name: string
  created_at: string
}

const PLANS = ['trial', 'start', 'pro', 'multi', 'enterprise'] as const
const PLAN_LABEL: Record<string, string> = {
  trial: 'Trial', start: 'Start', pro: 'Pro', multi: 'Multi', enterprise: 'Enterprise',
}
const PLAN_CLS: Record<string, string> = {
  trial:      'bg-blue-100 text-blue-700 border-blue-200',
  start:      'bg-green-100 text-green-700 border-green-200',
  pro:        'bg-purple-100 text-purple-700 border-purple-200',
  multi:      'bg-orange-100 text-orange-700 border-orange-200',
  enterprise: 'bg-slate-100 text-slate-700 border-slate-200',
}
const ROLE_LABEL: Record<string, string> = {
  owner: 'Właściciel', manager: 'Manager', staff: 'Pracownik',
}
const ROLE_ICON: Record<string, React.ReactNode> = {
  owner:   <Crown size={12} className="text-amber-500" />,
  manager: <Shield size={12} className="text-blue-500" />,
  staff:   <User size={12} className="text-gray-400" />,
}

type FilterType = 'all' | 'trial' | 'paying' | 'expired' | 'suspended'
const FILTERS: { id: FilterType; label: string }[] = [
  { id: 'all', label: 'Wszystkie' },
  { id: 'trial', label: 'W trialu' },
  { id: 'paying', label: 'Płatne' },
  { id: 'expired', label: 'Wygasłe' },
  { id: 'suspended', label: 'Zawieszone' },
]

function trialExpired(o: OrgRow) {
  return o.plan === 'trial' && !!o.trial_ends_at && new Date(o.trial_ends_at) < new Date()
}

function orgStatus(o: OrgRow): 'suspended' | 'expired' | 'active' {
  if (!o.is_active) return 'suspended'
  if (trialExpired(o)) return 'expired'
  return 'active'
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d))
}

function daysLeft(d: string | null): number | null {
  if (!d) return null
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000)
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-1 shadow-sm">
      <p className={cn('text-3xl font-bold', color)}>{value}</p>
      <p className="text-xs text-gray-500 font-medium">{label}</p>
    </div>
  )
}

function PlanSelect({ orgId, current, onChanged }: { orgId: string; current: string; onChanged: (plan: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold border transition-colors',
          PLAN_CLS[current] ?? PLAN_CLS.trial
        )}
      >
        {PLAN_LABEL[current] ?? current}
        <ChevronDown size={11} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full mt-1 left-0 z-20 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden min-w-[130px]">
            {PLANS.map(p => (
              <button
                key={p}
                onClick={() => { onChanged(p); setOpen(false) }}
                className={cn(
                  'w-full text-left px-3 py-2 text-xs font-medium hover:bg-gray-50 transition-colors',
                  p === current ? 'bg-gray-50 font-bold' : ''
                )}
              >
                {PLAN_LABEL[p]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function OrgDetailModal({ org, onClose, onDeleted }: { org: OrgRow; onClose: () => void; onDeleted: (id: string) => void }) {
  const [profiles, setProfiles] = useState<OrgProfile[] | null>(null)
  const [locations, setLocations] = useState<OrgLocation[] | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetch(`/api/admin/orgs/${org.id}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); return }
        setProfiles(data.profiles)
        setLocations(data.locations)
      })
      .catch(() => setError('Błąd pobierania danych'))
      .finally(() => setLoadingDetail(false))
  }, [org.id])

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/orgs/${org.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Błąd')
      toast.success(`Organizacja "${org.name}" została trwale usunięta`)
      onDeleted(org.id)
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Błąd usuwania')
      setDeleting(false)
    }
  }

  const status = orgStatus(org)
  const days = daysLeft(org.trial_ends_at)

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-xl h-full overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[#1B2E4B] text-white px-6 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center font-bold text-lg shrink-0">
            {org.name.slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-base truncate">{org.name}</h2>
            <p className="text-xs text-white/60">{org.owner_email}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Status overview */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl p-3 space-y-1">
              <p className="text-xs text-gray-500 font-medium">Status</p>
              {status === 'active' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                  <CheckCircle2 size={10} /> Aktywne
                </span>
              )}
              {status === 'expired' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
                  <AlertTriangle size={10} /> Wygasłe
                </span>
              )}
              {status === 'suspended' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                  <ShieldOff size={10} /> Zawieszone
                </span>
              )}
            </div>
            <div className="bg-gray-50 rounded-xl p-3 space-y-1">
              <p className="text-xs text-gray-500 font-medium">Plan</p>
              <span className={cn('inline-block px-2 py-0.5 rounded-lg text-xs font-semibold border', PLAN_CLS[org.plan] ?? PLAN_CLS.trial)}>
                {PLAN_LABEL[org.plan] ?? org.plan}
              </span>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 space-y-1">
              <p className="text-xs text-gray-500 font-medium">Rejestracja</p>
              <p className="text-sm font-semibold text-gray-800">{fmtDate(org.created_at)}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 space-y-1">
              <p className="text-xs text-gray-500 font-medium">Trial do</p>
              {org.trial_ends_at ? (
                <div>
                  <p className={cn('text-sm font-semibold', days !== null && days < 0 ? 'text-red-600' : 'text-gray-800')}>
                    {fmtDate(org.trial_ends_at)}
                  </p>
                  {days !== null && (
                    <p className="text-xs text-gray-400">
                      {days < 0 ? `${Math.abs(days)} dni temu` : days === 0 ? 'Dzisiaj' : `za ${days} dni`}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-400">—</p>
              )}
            </div>
          </div>

          {/* Owner */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Właściciel</h3>
            <div className="bg-gray-50 rounded-xl p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center">
                <Crown size={16} className="text-amber-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{org.owner_name || '—'}</p>
                <a href={`mailto:${org.owner_email}`} className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                  <Mail size={11} />{org.owner_email}
                </a>
              </div>
            </div>
          </div>

          {/* Admin notes */}
          {org.admin_notes && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Notatka adminа</h3>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800 whitespace-pre-wrap">
                {org.admin_notes}
              </div>
            </div>
          )}

          {loadingDetail ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-gray-400" />
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600">{error}</div>
          ) : (
            <>
              {/* Locations */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <MapPin size={12} /> Lokale ({locations?.length ?? 0})
                </h3>
                {locations && locations.length > 0 ? (
                  <div className="space-y-1.5">
                    {locations.map(loc => (
                      <div key={loc.id} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
                        <MapPin size={13} className="text-[#22C55E] shrink-0" />
                        <p className="text-sm font-medium text-gray-800">{loc.name}</p>
                        <p className="text-xs text-gray-400 ml-auto">{fmtDate(loc.created_at)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">Brak lokali</p>
                )}
              </div>

              {/* Employees */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Users size={12} /> Pracownicy ({profiles?.length ?? 0})
                </h3>
                {profiles && profiles.length > 0 ? (
                  <div className="space-y-1.5">
                    {profiles.map(p => (
                      <div key={p.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                          <UserCircle size={18} className="text-gray-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            {ROLE_ICON[p.role ?? 'staff']}
                            <p className="text-sm font-semibold text-gray-900 truncate">
                              {p.full_name || '(brak imienia)'}
                            </p>
                            <span className="text-xs text-gray-400 shrink-0">
                              {ROLE_LABEL[p.role ?? ''] ?? p.role}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 truncate">{p.email}</p>
                          {p.locations && (
                            <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                              <MapPin size={10} />
                              {(p.locations as { name: string }).name}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">Brak pracowników</p>
                )}
              </div>
            </>
          )}

          {/* Delete zone */}
          <div className="border-t border-red-100 pt-5">
            {!deleteConfirm ? (
              <button
                onClick={() => setDeleteConfirm(true)}
                className="flex items-center gap-2 text-sm text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-2 rounded-xl transition-colors w-full"
              >
                <Trash2 size={14} />
                Usuń tę organizację trwale
              </button>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
                <div>
                  <p className="text-sm font-bold text-red-700">Trwałe usunięcie organizacji</p>
                  <p className="text-xs text-red-600 mt-1">
                    Spowoduje usunięcie wszystkich danych: lokali, pracowników, rejestrów temperatur, dostaw, niezgodności i kont użytkowników. <strong>Tej operacji nie można cofnąć.</strong>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-red-700 mb-1.5">Wpisz nazwę organizacji aby potwierdzić: <strong>{org.name}</strong></p>
                  <input
                    type="text"
                    value={deleteInput}
                    onChange={e => setDeleteInput(e.target.value)}
                    placeholder={org.name}
                    className="w-full border border-red-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400/30"
                    autoFocus
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleDelete}
                    disabled={deleteInput !== org.name || deleting}
                    className="flex-1 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                  >
                    {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    {deleting ? 'Usuwanie…' : 'Usuń trwale'}
                  </button>
                  <button
                    onClick={() => { setDeleteConfirm(false); setDeleteInput('') }}
                    className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Anuluj
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export function OrgDashboard({ initialOrgs }: { initialOrgs: OrgRow[] }) {
  const [orgs, setOrgs] = useState<OrgRow[]>(initialOrgs)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [loading, setLoading] = useState<string | null>(null)
  const [notesOrg, setNotesOrg] = useState<OrgRow | null>(null)
  const [notesText, setNotesText] = useState('')
  const [detailOrg, setDetailOrg] = useState<OrgRow | null>(null)

  const stats = useMemo(() => ({
    total: orgs.length,
    trialing: orgs.filter(o => o.plan === 'trial' && o.is_active && !trialExpired(o)).length,
    paying: orgs.filter(o => o.plan !== 'trial' && o.is_active).length,
    expired: orgs.filter(o => trialExpired(o) && o.is_active).length,
    suspended: orgs.filter(o => !o.is_active).length,
  }), [orgs])

  const filtered = useMemo(() =>
    orgs.filter(o => {
      const q = search.toLowerCase()
      const matchQ = !q || o.name.toLowerCase().includes(q) || o.owner_email.toLowerCase().includes(q) || o.owner_name.toLowerCase().includes(q)
      const matchF =
        filter === 'all' ||
        (filter === 'trial' && o.plan === 'trial' && o.is_active && !trialExpired(o)) ||
        (filter === 'paying' && o.plan !== 'trial' && o.is_active) ||
        (filter === 'expired' && trialExpired(o) && o.is_active) ||
        (filter === 'suspended' && !o.is_active)
      return matchQ && matchF
    }),
    [orgs, search, filter]
  )

  function updateOrg(id: string, patch: Partial<OrgRow>) {
    setOrgs(prev => prev.map(o => o.id === id ? { ...o, ...patch } : o))
  }

  async function callApi(orgId: string, body: Record<string, unknown>, patch: Partial<OrgRow>, successMsg: string) {
    setLoading(orgId)
    try {
      const res = await fetch(`/api/admin/orgs/${orgId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Błąd')
      updateOrg(orgId, patch)
      toast.success(successMsg)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Błąd')
    } finally {
      setLoading(null)
    }
  }

  function suspend(id: string) {
    callApi(id, { action: 'suspend' }, { is_active: false }, 'Konto zawieszone')
  }

  function activate(id: string) {
    callApi(id, { action: 'activate' }, { is_active: true }, 'Konto aktywowane')
  }

  function extendTrial(org: OrgRow, days = 14) {
    const base = org.trial_ends_at && new Date(org.trial_ends_at) > new Date()
      ? new Date(org.trial_ends_at)
      : new Date()
    const newDate = new Date(base)
    newDate.setDate(newDate.getDate() + days)
    callApi(org.id, { action: 'extend_trial', days }, { trial_ends_at: newDate.toISOString(), plan: 'trial' }, `Trial przedłużony o ${days} dni`)
  }

  function changePlan(org: OrgRow, plan: string) {
    callApi(org.id, { action: 'change_plan', plan }, { plan }, `Plan zmieniony na ${PLAN_LABEL[plan]}`)
  }

  function openNotes(org: OrgRow) {
    setNotesOrg(org)
    setNotesText(org.admin_notes ?? '')
  }

  async function saveNotes() {
    if (!notesOrg) return
    await callApi(notesOrg.id, { action: 'update_notes', notes: notesText }, { admin_notes: notesText }, 'Notatka zapisana')
    setNotesOrg(null)
  }

  const isLoading = (id: string) => loading === id

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Panel właściciela</h1>
        <p className="text-sm text-gray-500 mt-0.5">Zarządzaj organizacjami korzystającymi z HACCPro</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard label="Wszystkie organizacje" value={stats.total} color="text-gray-900" />
        <StatCard label="W trialu" value={stats.trialing} color="text-blue-600" />
        <StatCard label="Płatne" value={stats.paying} color="text-green-600" />
        <StatCard label="Wygasłe trialy" value={stats.expired} color="text-orange-600" />
        <StatCard label="Zawieszone" value={stats.suspended} color="text-red-600" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Szukaj po nazwie, emailu właściciela…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#22C55E]/20 focus:border-[#22C55E] transition-colors"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>
        <div className="flex gap-1.5 overflow-x-auto">
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                'shrink-0 px-3 py-2 rounded-xl text-xs font-semibold border transition-all',
                filter === f.id
                  ? 'bg-[#1B2E4B] text-white border-[#1B2E4B]'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              )}
            >
              {f.label}
              {f.id === 'all' && <span className="ml-1.5 opacity-60">{stats.total}</span>}
              {f.id === 'trial' && stats.trialing > 0 && <span className="ml-1.5 opacity-60">{stats.trialing}</span>}
              {f.id === 'paying' && stats.paying > 0 && <span className="ml-1.5 opacity-60">{stats.paying}</span>}
              {f.id === 'expired' && stats.expired > 0 && <span className="ml-1.5 text-orange-400">{stats.expired}</span>}
              {f.id === 'suspended' && stats.suspended > 0 && <span className="ml-1.5 text-red-400">{stats.suspended}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Building2 size={36} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">Brak organizacji</p>
            <p className="text-sm text-gray-400 mt-1">
              {search || filter !== 'all' ? 'Zmień filtry lub szukaj inaczej.' : 'Żaden użytkownik nie zarejestrował się jeszcze.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Organizacja</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Właściciel</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Plan</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Trial do</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Lokale</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Użytkownicy</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Rejestracja</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(org => {
                  const status = orgStatus(org)
                  const days = daysLeft(org.trial_ends_at)
                  const busy = isLoading(org.id)
                  return (
                    <tr
                      key={org.id}
                      className={cn('hover:bg-gray-50 transition-colors cursor-pointer', !org.is_active && 'opacity-60')}
                      onClick={() => setDetailOrg(org)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-[#1B2E4B] flex items-center justify-center text-white font-bold text-xs shrink-0">
                            {org.name.slice(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 text-sm">{org.name}</p>
                            {org.admin_notes && (
                              <p className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
                                <MessageSquare size={10} />
                                {org.admin_notes.slice(0, 40)}{org.admin_notes.length > 40 ? '…' : ''}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <p className="text-sm text-gray-800 font-medium">{org.owner_name || '—'}</p>
                        <p className="text-xs text-gray-400">{org.owner_email}</p>
                      </td>

                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <PlanSelect orgId={org.id} current={org.plan} onChanged={plan => changePlan(org, plan)} />
                      </td>

                      <td className="px-4 py-3">
                        {status === 'active' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                            <CheckCircle2 size={11} /> Aktywne
                          </span>
                        )}
                        {status === 'expired' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
                            <AlertTriangle size={11} /> Wygasłe
                          </span>
                        )}
                        {status === 'suspended' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                            <ShieldOff size={11} /> Zawieszone
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {org.plan === 'trial' && org.trial_ends_at ? (
                          <div>
                            <p className={cn('text-xs font-semibold', days !== null && days < 0 ? 'text-red-600' : days !== null && days <= 3 ? 'text-orange-600' : 'text-gray-700')}>
                              {fmtDate(org.trial_ends_at)}
                            </p>
                            {days !== null && (
                              <p className={cn('text-xs', days < 0 ? 'text-red-400' : 'text-gray-400')}>
                                {days < 0 ? `${Math.abs(days)} dni temu` : days === 0 ? 'Dzisiaj!' : `za ${days} dni`}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 text-sm font-semibold text-gray-700">
                          <MapPin size={12} className="text-gray-400" />
                          {org.location_count}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 text-sm font-semibold text-gray-700">
                          <Users size={12} className="text-gray-400" />
                          {org.user_count}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <p className="text-xs text-gray-500">{fmtDate(org.created_at)}</p>
                      </td>

                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {busy ? (
                            <Loader2 size={16} className="animate-spin text-gray-400" />
                          ) : (
                            <>
                              <button
                                onClick={() => setDetailOrg(org)}
                                title="Szczegóły organizacji"
                                className="p-1.5 rounded-lg text-gray-400 hover:text-[#1B2E4B] hover:bg-gray-100 transition-colors"
                              >
                                <Eye size={15} />
                              </button>

                              {org.is_active ? (
                                <button
                                  onClick={() => suspend(org.id)}
                                  title="Zawieś konto"
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                >
                                  <ShieldOff size={15} />
                                </button>
                              ) : (
                                <button
                                  onClick={() => activate(org.id)}
                                  title="Aktywuj konto"
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors"
                                >
                                  <ShieldCheck size={15} />
                                </button>
                              )}

                              {org.plan === 'trial' && (
                                <button
                                  onClick={() => extendTrial(org, 14)}
                                  title="Przedłuż trial o 14 dni"
                                  className="px-2 py-1 rounded-lg text-xs font-semibold text-blue-600 hover:bg-blue-50 border border-blue-200 transition-colors"
                                >
                                  +14 dni
                                </button>
                              )}

                              <button
                                onClick={() => openNotes(org)}
                                title={org.admin_notes ? 'Edytuj notatkę' : 'Dodaj notatkę'}
                                className={cn(
                                  'p-1.5 rounded-lg transition-colors',
                                  org.admin_notes
                                    ? 'text-amber-500 hover:bg-amber-50'
                                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                                )}
                              >
                                <MessageSquare size={15} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 text-center">
        Wyświetlono {filtered.length} z {orgs.length} organizacji
      </p>

      {/* Notes modal */}
      {notesOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setNotesOrg(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md space-y-4">
            <div>
              <h2 className="font-bold text-gray-900">Notatka — {notesOrg.name}</h2>
              <p className="text-xs text-gray-400 mt-0.5">Widoczna tylko dla Ciebie</p>
            </div>
            <textarea
              rows={5}
              value={notesText}
              onChange={e => setNotesText(e.target.value)}
              placeholder="Wpisz notatkę o tej organizacji… (kontakt, status płatności, uwagi)"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#22C55E]/20 focus:border-[#22C55E] resize-none transition-colors"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={saveNotes}
                disabled={loading === notesOrg.id}
                className="flex-1 py-2.5 rounded-xl bg-[#1B2E4B] text-white text-sm font-semibold hover:bg-[#243d63] transition-colors disabled:opacity-60"
              >
                {loading === notesOrg.id ? 'Zapisuję…' : 'Zapisz notatkę'}
              </button>
              <button
                onClick={() => setNotesOrg(null)}
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Anuluj
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail side panel */}
      {detailOrg && (
        <OrgDetailModal
          org={detailOrg}
          onClose={() => setDetailOrg(null)}
          onDeleted={id => setOrgs(prev => prev.filter(o => o.id !== id))}
        />
      )}
    </div>
  )
}
