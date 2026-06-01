'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Droplets, Plus, Paperclip, X, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react'
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

function getTodayStart() {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString()
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
  const [showHistory, setShowHistory] = useState(false)
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
      supabase.from('cleaning_logs').select('id,area,agent,cleaned_at,notes,doc_url')
        .eq('location_id', locationId).order('cleaned_at', { ascending: false }).limit(50),
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
    setCustomAreas(updated); setNewArea(''); setShowAddArea(false)
  }

  async function saveCustomAgent() {
    if (!newAgent.trim()) return
    const { locationId } = await getCtx()
    const updated = [...customAgents, newAgent.trim()]
    await supabase.from('locations').update({ cleaning_agents: updated }).eq('id', locationId)
    setCustomAgents(updated); setNewAgent(''); setShowAddAgent(false)
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
      const { data: upload, error: uploadError } = await supabase.storage.from('documents').upload(path, file, { upsert: false })
      if (uploadError) { toast.error('Błąd uploadu: ' + uploadError.message); setLoading(false); return }
      docUrl = supabase.storage.from('documents').getPublicUrl(upload.path).data.publicUrl
    }

    const { error } = await supabase.from('cleaning_logs').insert({
      location_id: locationId, area, agent, concentration: null,
      cleaned_at: new Date().toISOString(), recorded_by: userId,
      notes: notes || null, doc_url: docUrl,
    })
    setLoading(false)
    if (error) { toast.error('Błąd zapisu: ' + error.message); return }
    toast.success('Wpis mycia zapisany!')
    setArea(''); setAgent(''); setNotes(''); setFile(null)
    if (fileRef.current) fileRef.current.value = ''
    setExpanded(false)
    fetchData()
  }

  const allAreas = [...DEFAULT_AREAS, ...customAreas]
  const allAgents = [...DEFAULT_AGENTS, ...customAgents]

  const todayStart = getTodayStart()
  const todayLogs = logs.filter(l => new Date(l.cleaned_at) >= new Date(todayStart))
  const lastLog = logs[0] ?? null

  // Compute "frequently used" from recent logs
  const comboCounts = new Map<string, number>()
  logs.slice(0, 20).forEach(l => {
    const key = `${l.area}|||${l.agent}`
    comboCounts.set(key, (comboCounts.get(key) ?? 0) + 1)
  })
  const topCombos = Array.from(comboCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key]) => { const [a, ag] = key.split('|||'); return { area: a, agent: ag } })

  function applyCombo(a: string, ag: string) {
    setArea(a); setAgent(ag); setExpanded(true)
    setTimeout(() => document.getElementById('cleaning-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mycie i dezynfekcja</h1>
        <p className="text-sm text-gray-500 mt-0.5">Dzisiejsze wpisy: <span className="font-semibold text-gray-800">{todayLogs.length}</span></p>
      </div>

      {/* Frequently used */}
      {topCombos.length > 0 && !expanded && (
        <div className="card space-y-3">
          <p className="text-sm font-semibold text-gray-700">Najczęściej używane</p>
          <div className="space-y-2">
            {topCombos.map(({ area: a, agent: ag }) => (
              <button key={`${a}+${ag}`} type="button"
                onClick={() => applyCombo(a, ag)}
                className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl border-2 border-gray-100 bg-white hover:border-cyan-300 hover:bg-cyan-50 transition-all min-h-[52px] text-left">
                <div>
                  <span className="text-sm font-semibold text-gray-900">{a}</span>
                  <span className="text-gray-400 mx-2 text-xs">+</span>
                  <span className="text-sm text-gray-600">{ag}</span>
                </div>
                <Plus size={16} className="text-cyan-500 shrink-0" />
              </button>
            ))}
          </div>

          {lastLog && (
            <button type="button"
              onClick={() => applyCombo(lastLog.area, lastLog.agent)}
              className="w-full flex items-center gap-2 text-sm text-cyan-700 font-medium hover:underline">
              <RotateCcw size={14} />
              Powtórz ostatni: {lastLog.area} + {lastLog.agent}
            </button>
          )}
        </div>
      )}

      {/* Add entry button / form */}
      <div className="card" id="cleaning-form">
        <button type="button" onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between text-left min-h-[52px]">
          <div className="flex items-center gap-3">
            <div className="bg-cyan-500 p-2 rounded-xl">
              <Plus size={16} className="text-white" />
            </div>
            <span className="font-bold text-gray-900">Dodaj wpis mycia</span>
          </div>
          {expanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
        </button>

        {expanded && (
          <form onSubmit={handleSubmit} className="mt-5 space-y-6">

            {/* SECTION 1: Area */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-gray-800 text-sm">Co zostało umyte?</p>
                <button type="button" onClick={() => setShowAddArea(!showAddArea)}
                  className="text-xs text-cyan-600 hover:underline">+ Dodaj obszar</button>
              </div>
              {showAddArea && (
                <div className="flex gap-2 mb-3">
                  <input className="input flex-1 text-sm" placeholder="Nazwa obszaru" value={newArea}
                    onChange={e => setNewArea(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), saveCustomArea())} />
                  <button type="button" onClick={saveCustomArea}
                    className="px-3 py-2 bg-cyan-600 text-white text-sm rounded-lg hover:bg-cyan-700">Dodaj</button>
                  <button type="button" onClick={() => setShowAddArea(false)}
                    className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Anuluj</button>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                {allAreas.map(a => (
                  <button key={a} type="button" onClick={() => setArea(a)}
                    className={cn(
                      'px-3 py-3 rounded-xl border-2 text-sm font-medium transition-all min-h-[48px]',
                      area === a
                        ? 'border-cyan-500 bg-cyan-50 text-cyan-800'
                        : 'border-gray-100 bg-white text-gray-700 hover:border-cyan-200'
                    )}>
                    {a}
                  </button>
                ))}
              </div>
              <input className="input mt-3 text-sm" placeholder="Lub wpisz ręcznie..." value={area}
                onChange={e => setArea(e.target.value)} />
            </div>

            {/* SECTION 2: Agent */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-gray-800 text-sm">Czym wykonano mycie/dezynfekcję?</p>
                <button type="button" onClick={() => setShowAddAgent(!showAddAgent)}
                  className="text-xs text-cyan-600 hover:underline">+ Dodaj środek</button>
              </div>
              {showAddAgent && (
                <div className="flex gap-2 mb-3">
                  <input className="input flex-1 text-sm" placeholder="Nazwa środka" value={newAgent}
                    onChange={e => setNewAgent(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), saveCustomAgent())} />
                  <button type="button" onClick={saveCustomAgent}
                    className="px-3 py-2 bg-cyan-600 text-white text-sm rounded-lg hover:bg-cyan-700">Dodaj</button>
                  <button type="button" onClick={() => setShowAddAgent(false)}
                    className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Anuluj</button>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                {allAgents.map(a => (
                  <button key={a} type="button" onClick={() => setAgent(a)}
                    className={cn(
                      'px-3 py-3 rounded-xl border-2 text-sm font-medium transition-all min-h-[48px]',
                      agent === a
                        ? 'border-cyan-500 bg-cyan-50 text-cyan-800'
                        : 'border-gray-100 bg-white text-gray-700 hover:border-cyan-200'
                    )}>
                    {a}
                  </button>
                ))}
              </div>
              <input className="input mt-3 text-sm" placeholder="Lub wpisz ręcznie..." value={agent}
                onChange={e => setAgent(e.target.value)} />
            </div>

            {/* SECTION 3: Extra */}
            <div className="space-y-3">
              <p className="font-semibold text-gray-800 text-sm">Dodatkowe informacje</p>
              <div>
                <label className="label">Uwagi <span className="text-gray-400 font-normal">(opcjonalne)</span></label>
                <input className="input" placeholder="Dodatkowe informacje" value={notes}
                  onChange={e => setNotes(e.target.value)} />
              </div>
              <div>
                <label className="label">Karta produktu / zdjęcie <span className="text-gray-400 font-normal">(opcjonalne)</span></label>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-600 cursor-pointer hover:border-gray-300 transition-colors flex-1">
                    <Paperclip size={14} />
                    {file ? file.name : 'Wybierz plik (JPG, PNG, PDF)'}
                    <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden"
                      onChange={e => setFile(e.target.files?.[0] ?? null)} />
                  </label>
                  {file && (
                    <button type="button" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = '' }}>
                      <X size={16} className="text-gray-400 hover:text-gray-600" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={loading}
                className={cn(
                  'flex-1 py-4 rounded-xl text-sm font-bold transition-colors min-h-[56px]',
                  loading ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-cyan-600 hover:bg-cyan-700 text-white'
                )}>
                {loading ? 'Zapisywanie…' : 'Zapisz wpis mycia'}
              </button>
              <button type="button" onClick={() => setExpanded(false)}
                className="px-4 py-4 rounded-xl text-sm font-medium text-gray-600 border-2 border-gray-200 hover:bg-gray-50 min-h-[56px]">
                Anuluj
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Today's entries */}
      {todayLogs.length > 0 && (
        <div className="card">
          <p className="font-semibold text-gray-900 mb-3 text-sm">Dzisiaj ({todayLogs.length})</p>
          <div className="divide-y divide-gray-50">
            {todayLogs.map(log => (
              <div key={log.id} className="py-3 flex items-start justify-between">
                <div>
                  <p className="font-semibold text-sm text-gray-900">{log.area}</p>
                  <p className="text-xs text-cyan-700 font-medium mt-0.5">{log.agent}</p>
                  {log.notes && <p className="text-xs text-gray-400 mt-0.5">{log.notes}</p>}
                  {log.doc_url && (
                    <a href={log.doc_url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-0.5">
                      <Paperclip size={10} /> Załącznik
                    </a>
                  )}
                </div>
                <p className="text-xs text-gray-400 whitespace-nowrap ml-4 mt-0.5">{formatDateTime(log.cleaned_at)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History toggle */}
      {logs.length > todayLogs.length && (
        <div className="card">
          <button type="button" onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center justify-between text-sm font-medium text-gray-600">
            <span>Historia ({logs.length - todayLogs.length} wcześniejszych wpisów)</span>
            {showHistory ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {showHistory && (
            <div className="mt-3 divide-y divide-gray-50">
              {logs.filter(l => new Date(l.cleaned_at) < new Date(todayStart)).map(log => (
                <div key={log.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-800">{log.area} · <span className="text-gray-500">{log.agent}</span></p>
                    {log.notes && <p className="text-xs text-gray-400">{log.notes}</p>}
                  </div>
                  <p className="text-xs text-gray-400 whitespace-nowrap ml-4">{formatDateTime(log.cleaned_at)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {logs.length === 0 && !expanded && (
        <div className="card border-dashed border-2 border-gray-200 text-center py-12">
          <Droplets size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 mb-1">Brak wpisów mycia.</p>
          <p className="text-sm text-gray-400">Kliknij <strong>+ Dodaj wpis</strong> powyżej.</p>
        </div>
      )}
    </div>
  )
}
