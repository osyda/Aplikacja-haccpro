'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Plus, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import type { Nonconformity } from '@/types/database'

export default function NiezgodnosciPage() {
  const [items, setItems] = useState<Nonconformity[]>([])
  const [expanded, setExpanded] = useState(false)
  const [form, setForm] = useState({ description: '', corrective_action: '' })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const supabase = createClient()

  async function fetchItems() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('location_id').eq('id', user!.id).single()
    const { data } = await supabase.from('nonconformities').select('*').eq('location_id', profile?.location_id ?? '').order('created_at', { ascending: false })
    setItems(data ?? [])
  }

  useEffect(() => { fetchItems() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('location_id').eq('id', user!.id).single()

    const { error } = await supabase.from('nonconformities').insert({
      location_id: profile?.location_id ?? '',
      description: form.description,
      corrective_action: form.corrective_action || null,
      status: 'open',
      reported_by: user!.id,
      created_at: new Date().toISOString(),
    })

    setLoading(false)
    if (!error) {
      setSuccess(true)
      setForm({ description: '', corrective_action: '' })
      fetchItems()
      setTimeout(() => { setSuccess(false); setExpanded(false) }, 2000)
    }
  }

  async function handleResolve(id: string) {
    await supabase.from('nonconformities').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', id)
    fetchItems()
  }

  const open = items.filter((i) => i.status === 'open')
  const resolved = items.filter((i) => i.status === 'resolved')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Niezgodności</h1>
        <p className="text-sm text-gray-500 mt-0.5">Rejestr niezgodności i działań korygujących</p>
      </div>

      <div className="card">
        <button type="button" onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between text-left">
          <div className="flex items-center gap-2">
            <div className="bg-orange-500 p-1.5 rounded-lg"><Plus size={14} className="text-white" /></div>
            <span className="font-semibold text-gray-900">Zgłoś niezgodność</span>
          </div>
          {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </button>

        {expanded && (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label className="label">Opis niezgodności</label>
              <textarea
                rows={3}
                placeholder="Opisz stwierdzoną niezgodność..."
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                className="input resize-none"
                required
              />
            </div>
            <div>
              <label className="label">Działanie korygujące</label>
              <textarea
                rows={2}
                placeholder="Jakie działanie zostało lub zostanie podjęte?"
                value={form.corrective_action}
                onChange={(e) => setForm((p) => ({ ...p, corrective_action: e.target.value }))}
                className="input resize-none"
              />
            </div>
            <Button type="submit" loading={loading} className={success ? 'bg-green-600' : ''}>
              {success ? 'Zapisano!' : 'Zgłoś niezgodność'}
            </Button>
          </form>
        )}
      </div>

      {open.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <AlertTriangle size={16} className="text-orange-500" />
            Otwarte ({open.length})
          </h2>
          <div className="space-y-3">
            {open.map((item) => (
              <div key={item.id} className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="text-sm text-gray-900">{item.description}</p>
                {item.corrective_action && (
                  <p className="text-xs text-gray-600 mt-1">Działanie: {item.corrective_action}</p>
                )}
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-gray-400">{formatDateTime(item.created_at)}</p>
                  <Button size="sm" variant="secondary" onClick={() => handleResolve(item.id)}>
                    <CheckCircle2 size={12} />
                    Zamknij
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {resolved.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-brand-green" />
            Zamknięte ({resolved.length})
          </h2>
          <div className="divide-y divide-gray-50">
            {resolved.map((item) => (
              <div key={item.id} className="py-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-700">{item.description}</p>
                    {item.corrective_action && (
                      <p className="text-xs text-gray-500 mt-0.5">Działanie: {item.corrective_action}</p>
                    )}
                  </div>
                  <Badge variant="ok" className="ml-3 shrink-0">Zamknięta</Badge>
                </div>
                <p className="text-xs text-gray-400 mt-1">{formatDateTime(item.created_at)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {items.length === 0 && (
        <div className="card border-dashed border-2 border-gray-200 text-center py-12">
          <AlertTriangle size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">Brak niezgodności. Dobrze!</p>
        </div>
      )}
    </div>
  )
}
