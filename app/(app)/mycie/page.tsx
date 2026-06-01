'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Droplets, Plus, ChevronDown, ChevronUp, Paperclip, X } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const DEFAULT_AREAS = ['Kuchnia', 'Sala', 'Toalety', 'Magazyn', 'Witryna', 'Sprzęt kuchenny', 'Lodówki', 'Podłogi']
const DEFAULT_AGENTS = ['Fairy', 'Domestos', 'Clinex', 'Suma Bac D10', 'Incidin Plus']

interface Log {
  id: string
  area: string
  agent: string
  cleaned_at: string
  notes: string | null
  doc_url: string | null
}

export default function MyCiePage() {
  const [logs, setLogs] = useState<Log[]>([])
  const [expanded, setExpanded] = useState(false)
  const [area, setArea] = useState('')
  const [agent, setAgent] = useState('')
  const [notes, setNotes] = useState('')
  const [customAreas, setCustomAreas] = useState<string[]>([])
  const [customAgents, setCustomAgents] = useState<string[]>([])
  const [newArea, setNewArea] = useState('')
  const [newAgent, setNewAgent] = useState('')
  const [showAddArea, setShowAddArea] = useState(false)
  const [showAddAgent, setShowAddAgent] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  async function getCtx() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('location_id').eq('id', user!.id).single()
    return { locationId: profile?.location_id ?? '', userId: user!.id }
  }

  async function fetchData() {
    const { locationId } = await getCtx()
    const [logsRes, locRes] = await Promise.all([
      supabase.from('cleaning_logs').select('id,area,agent,cleaned_at,notes,doc_url').eq('location_id', locationId).order('cleaned_at', { ascending: false }).limit(50),
      supabase.from('locations').select('cleaning_areas,cleaning_agents').eq('id', locationId).single(),
    ])
    setLogs(logsRes.data ?? [])
    setCustomAreas(locRes.data?.cleaning_areas ?? [])
    setCustomAgents(locRes.data?.cleaning_agents ?? [])
  }

  useEffect(() => { fetchData() }, [])

  async function saveCustomArea() {
    if (!newArea.trim()) return
    const { locationId } = await getCtx()
    const updated = [...customAreas, newArea.trim()]
    await supabase.from('locations').update({ cleaning_areas: updated }).eq('id', locationId)
    setCustomAreas(updated)
    setNewArea('')
    setShowAddArea(false)
  }

  async function saveCustomAgent() {
    if (!newAgent.trim()) return
    const { locationId } = await getCtx()
    const updated = [...customAgents, newAgent.trim()]
    await supabase.from('locations').update({ cleaning_agents: updated }).eq('id', locationId)
    setCustomAgents(updated)
    setNewAgent('')
    setShowAddAgent(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!area) { toast.error('Wybierz lub wpisz obszar'); return }
    if (!agent) { toast.error('Wybierz lub wpisz środek czyszczący'); return }
    setLoading(true)

    const { locationId, userId } = await getCtx()

    let docUrl: string | null = null
    if (file) {
      const ext = file.name.split('.').pop()
      const path = `cleaning/${locationId}/${Date.now()}.${ext}`
      const { data: upload, error: uploadError } = await supabase.storage
        .from('documents').upload(path, file, { upsert: false })
      if (uploadError) { toast.error('Błąd uploadu: ' + uploadError.message); setLoading(false); return }
      docUrl = supabase.storage.from('documents').getPublicUrl(upload.path).data.publicUrl
    }

    const { error } = await supabase.from('cleaning_logs').insert({
      location_id: locationId,
      area,
      agent,
      concentration: null,
      cleaned_at: new Date().toISOString(),
      recorded_by: userId,
      notes: notes || null,
      doc_url: docUrl,
    })

    setLoading(false)
    if (error) { toast.error('Błąd zapisu: ' + error.message); return }
    toast.success('Wpis mycia zapisany!')
    setArea('')
    setAgent('')
    setNotes('')
    setFile(null)
    if (fileRef.current) fileRef.current.value = ''
    setExpanded(false)
    fetchData()
  }

  const allAreas = [...DEFAULT_AREAS, ...customAreas]
  const allAgents = [...DEFAULT_AGENTS, ...customAgents]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mycie i dezynfekcja</h1>
        <p className="text-sm text-gray-500 mt-0.5">Rejestr czynności mycia i dezynfekcji</p>
      </div>

      <div className="card">
        <button type="button" onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between text-left">
          <div className="flex items-center gap-2">
            <div className="bg-cyan-500 p-1.5 rounded-lg"><Plus size={14} className="text-white" /></div>
            <span className="font-semibold text-gray-900">Dodaj wpis mycia</span>
          </div>
          {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </button>

        {expanded && (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="label mb-0">Obszar / miejsce</p>
                <button type="button" onClick={() => setShowAddArea(!showAddArea)} className="text-xs text-cyan-600 hover:underline">
                  + Dodaj nowy obszar
                </button>
              </div>
              {showAddArea && (
                <div className="flex gap-2 mb-2">
                  <input className="input flex-1 text-sm" placeholder="Nazwa obszaru" value={newArea}
                    onChange={(e) => setNewArea(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), saveCustomArea())} />
                  <Button type="button" size="sm" onClick={saveCustomArea}>Dodaj</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setShowAddArea(false)}>Anuluj</Button>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {allAreas.map((a) => (
                  <button key={a} type="button" onClick={() => setArea(a)}
                    className={cn('px-3 py-1.5 rounded-lg text-sm border transition-colors',
                      area === a ? 'border-cyan-500 bg-cyan-50 text-cyan-700 font-medium' : 'border-gray-200 hover:border-gray-300')}>
                    {a}
                  </button>
                ))}
              </div>
              <input className="input mt-2 text-sm" placeholder="Lub wpisz ręcznie..." value={area}
                onChange={(e) => setArea(e.target.value)} />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="label mb-0">Środek czyszczący</p>
                <button type="button" onClick={() => setShowAddAgent(!showAddAgent)} className="text-xs text-cyan-600 hover:underline">
                  + Dodaj nowy środek
                </button>
              </div>
              {showAddAgent && (
                <div className="flex gap-2 mb-2">
                  <input className="input flex-1 text-sm" placeholder="Nazwa środka" value={newAgent}
                    onChange={(e) => setNewAgent(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), saveCustomAgent())} />
                  <Button type="button" size="sm" onClick={saveCustomAgent}>Dodaj</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setShowAddAgent(false)}>Anuluj</Button>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {allAgents.map((a) => (
                  <button key={a} type="button" onClick={() => setAgent(a)}
                    className={cn('px-3 py-1.5 rounded-lg text-sm border transition-colors',
                      agent === a ? 'border-cyan-500 bg-cyan-50 text-cyan-700 font-medium' : 'border-gray-200 hover:border-gray-300')}>
                    {a}
                  </button>
                ))}
              </div>
              <input className="input mt-2 text-sm" placeholder="Lub wpisz ręcznie..." value={agent}
                onChange={(e) => setAgent(e.target.value)} />
            </div>

            <div>
              <label className="label">Uwagi (opcjonalnie)</label>
              <input className="input" placeholder="Dodatkowe informacje" value={notes}
                onChange={(e) => setNotes(e.target.value)} />
            </div>

            <div>
              <label className="label">Karta produktu / zdjęcie (opcjonalnie)</label>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 cursor-pointer hover:border-gray-300 transition-colors">
                  <Paperclip size={14} />
                  {file ? file.name : 'Wybierz plik (JPG, PNG, PDF)'}
                  <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                </label>
                {file && (
                  <button type="button" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = '' }}>
                    <X size={16} className="text-gray-400 hover:text-gray-600" />
                  </button>
                )}
              </div>
            </div>

            <Button type="submit" loading={loading}>Zapisz wpis</Button>
          </form>
        )}
      </div>

      {logs.length > 0 ? (
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-3">Historia ({logs.length})</h2>
          <div className="divide-y divide-gray-50">
            {logs.map((log) => (
              <div key={log.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm text-gray-900">{log.area}</p>
                  <p className="text-xs text-gray-500">{log.agent}</p>
                  {log.notes && <p className="text-xs text-gray-400 mt-0.5">{log.notes}</p>}
                  {log.doc_url && (
                    <a href={log.doc_url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-0.5">
                      <Paperclip size={10} /> Załącznik
                    </a>
                  )}
                </div>
                <p className="text-xs text-gray-400 whitespace-nowrap ml-4">{formatDateTime(log.cleaned_at)}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="card border-dashed border-2 border-gray-200 text-center py-12">
          <Droplets size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">Brak wpisów mycia. Dodaj pierwszy wpis powyżej.</p>
        </div>
      )}
    </div>
  )
}
