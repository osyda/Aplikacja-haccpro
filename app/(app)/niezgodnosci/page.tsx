'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { AlertBox } from '@/components/ui/alert-box'
import { AlertTriangle, Plus, ChevronDown, ChevronUp, CheckCircle2, Thermometer, Loader2 } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface Nonconformity {
  id: string
  description: string
  corrective_action: string | null
  resolve_comment: string | null
  status: string
  source: string
  reported_by: string
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
  location_id: string
}

type ProfilesMap = Record<string, string>

function ResolveForm({ item, onResolved }: { item: Nonconformity; onResolved: () => void }) {
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  async function handleResolve() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('nonconformities').update({
      status: 'resolved',
      resolve_comment: comment.trim() || null,
      resolved_by: user!.id,
      resolved_at: new Date().toISOString(),
    }).eq('id', item.id)
    setSaving(false)
    if (error) { toast.error('Błąd zapisu: ' + error.message); return }
    onResolved()
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
      <textarea
        rows={2}
        placeholder="Co zostało zrobione? Zostaw puste, jeśli nie ma nic do dopisania."
        className="input resize-none text-sm"
        value={comment}
        onChange={e => setComment(e.target.value)}
      />
      <button
        onClick={handleResolve}
        disabled={saving}
        className="flex items-center gap-1.5 px-4 py-2 bg-brand-green hover:bg-brand-green-dark text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
      >
        {saving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
        {saving ? 'Zapisywanie…' : 'Zamknij niezgodność'}
      </button>
    </div>
  )
}

function NonconformityCard({ item, profilesMap, onChanged }: { item: Nonconformity; profilesMap: ProfilesMap; onChanged: () => void }) {
  const isAlarm = item.source === 'temperature_alarm'
  const isOpen = item.status === 'open'
  const reporterName = profilesMap[item.reported_by] ?? ''
  const resolverName = item.resolved_by ? (profilesMap[item.resolved_by] ?? '') : ''

  return (
    <div className={cn(
      'p-4 rounded-xl border-2 space-y-2 transition-all',
      isOpen
        ? isAlarm ? 'border-red-200 bg-red-50' : 'border-orange-200 bg-orange-50'
        : 'border-gray-100 bg-white'
    )}>
      <div className="flex items-start gap-2">
        <div className={cn(
          'p-1.5 rounded-lg shrink-0 mt-0.5',
          isOpen
            ? isAlarm ? 'bg-red-100' : 'bg-orange-100'
            : 'bg-gray-100'
        )}>
          {isAlarm
            ? <Thermometer size={13} className={isOpen ? 'text-red-600' : 'text-gray-400'} />
            : <AlertTriangle size={13} className={isOpen ? 'text-orange-600' : 'text-gray-400'} />
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {isAlarm && (
              <span className={cn(
                'text-xs font-bold px-2 py-0.5 rounded-full',
                isOpen ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
              )}>
                Alarm temperatury
              </span>
            )}
            {!isOpen && <Badge variant="ok">Zamknięta</Badge>}
          </div>
          <p className={cn('text-sm mt-1', isOpen ? 'text-gray-900' : 'text-gray-600')}>{item.description}</p>

          {item.corrective_action && (
            <p className="text-xs text-gray-500 mt-1">
              <span className="font-medium">Uwagi pracownika:</span> {item.corrective_action}
            </p>
          )}
          {item.resolve_comment && (
            <p className="text-xs text-green-700 mt-1 bg-green-50 px-2 py-1 rounded-lg border border-green-100">
              <span className="font-medium">Działanie korygujące:</span> {item.resolve_comment}
              {resolverName && <span className="text-green-600"> — {resolverName}</span>}
            </p>
          )}
          <p className="text-xs text-gray-400 mt-1.5">
            {formatDateTime(item.created_at)}
            {reporterName && <span className="ml-2 font-medium text-gray-500">· {reporterName}</span>}
          </p>
        </div>
      </div>

      {isOpen && (
        <div className="pl-7">
          <ResolveForm item={item} onResolved={onChanged} />
        </div>
      )}
    </div>
  )
}

export default function NiezgodnosciPage() {
  const [items, setItems] = useState<Nonconformity[]>([])
  const [profilesMap, setProfilesMap] = useState<ProfilesMap>({})
  const [expandedForm, setExpandedForm] = useState(false)
  const [form, setForm] = useState({ description: '', corrective_action: '' })
  const [loading, setLoading] = useState(false)
  const [showResolved, setShowResolved] = useState(false)
  const supabase = createClient()

  async function fetchItems() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('location_id').eq('id', user!.id).single()
    const { data } = await supabase
      .from('nonconformities')
      .select('*')
      .eq('location_id', profile?.location_id ?? '')
      .order('created_at', { ascending: false })
    const rows = data ?? []
    setItems(rows)

    const ids = Array.from(new Set([
      ...rows.map((r: Nonconformity) => r.reported_by),
      ...(rows.map((r: Nonconformity) => r.resolved_by).filter(Boolean) as string[]),
    ]))
    if (ids.length > 0) {
      const { data: pData } = await supabase.from('profiles').select('id, full_name').in('id', ids)
      setProfilesMap(Object.fromEntries((pData ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name ?? ''])))
    }
  }

  useEffect(() => { fetchItems() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('location_id').eq('id', user!.id).single()
    const { error } = await supabase.from('nonconformities').insert({
      location_id: profile?.location_id ?? '',
      source: 'manual',
      description: form.description,
      corrective_action: form.corrective_action || null,
      status: 'open',
      reported_by: user!.id,
    })
    setLoading(false)
    if (error) { toast.error('Błąd zapisu: ' + error.message); return }
    setForm({ description: '', corrective_action: '' })
    setExpandedForm(false)
    fetchItems()
  }

  const open = items.filter(i => i.status === 'open')
  const resolved = items.filter(i => i.status === 'resolved')
  const alarmCount = open.filter(i => i.source === 'temperature_alarm').length

  return (
    <div className="space-y-6">
      <PageHeader title="Niezgodności" subtitle="Rejestr niezgodności i działań korygujących" />

      {alarmCount > 0 && (
        <AlertBox
          variant="error"
          title={alarmCount === 1 ? '1 alarm temperatury wymaga działania' : `${alarmCount} alarmy temperatur wymagają działania`}
          description="Opisz, co zostało zrobione, i zamknij niezgodność poniżej."
        />
      )}

      {/* Manual form */}
      <div className="card">
        <button type="button" onClick={() => setExpandedForm(!expandedForm)}
          className="w-full flex items-center justify-between text-left">
          <div className="flex items-center gap-2">
            <div className="bg-orange-500 p-1.5 rounded-lg"><Plus size={14} className="text-white" /></div>
            <span className="font-semibold text-gray-900">Zgłoś niezgodność ręcznie</span>
          </div>
          {expandedForm ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </button>

        {expandedForm && (
          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            <div>
              <label className="label">Opis niezgodności</label>
              <textarea rows={3} placeholder="Opisz stwierdzoną niezgodność..."
                value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                className="input resize-none" required />
            </div>
            <div>
              <label className="label">Działanie korygujące <span className="text-gray-400 font-normal">(opcjonalne)</span></label>
              <textarea rows={2} placeholder="Jakie działanie zostało lub zostanie podjęte?"
                value={form.corrective_action} onChange={e => setForm(p => ({ ...p, corrective_action: e.target.value }))}
                className="input resize-none" />
            </div>
            <button type="submit" disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60">
              {loading && <Loader2 size={14} className="animate-spin" />}
              Zgłoś niezgodność
            </button>
          </form>
        )}
      </div>

      {/* Open */}
      {open.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <AlertTriangle size={15} className="text-orange-500" />
            Otwarte ({open.length})
          </h2>
          {open.map(item => (
            <NonconformityCard key={item.id} item={item} profilesMap={profilesMap} onChanged={fetchItems} />
          ))}
        </div>
      )}

      {/* Resolved toggle */}
      {resolved.length > 0 && (
        <div className="space-y-3">
          <button
            onClick={() => setShowResolved(!showResolved)}
            className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-700"
          >
            <CheckCircle2 size={15} className="text-green-500" />
            Zamknięte ({resolved.length})
            {showResolved ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          {showResolved && resolved.map(item => (
            <NonconformityCard key={item.id} item={item} profilesMap={profilesMap} onChanged={fetchItems} />
          ))}
        </div>
      )}

      {items.length === 0 && (
        <EmptyState icon={AlertTriangle} title="Brak niezgodności. Dobrze!" />
      )}
    </div>
  )
}
