'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Droplets, Plus, Paperclip, X, ChevronDown, ChevronUp, Check } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { resolvePermissions } from '@/lib/permissions'
import type { AppPermissions } from '@/lib/permissions'

type Dept = 'kitchen_back' | 'service_hall'
type HistFilter = 'all' | Dept

const DEPT = {
  kitchen_back: {
    label: 'KUCHNIA / ZAPLECZE',
    badge: 'KUCHNIA',
    description: 'Obszary kuchni, lodówki, magazyn, pizzerka',
    badgeCls: 'bg-orange-100 text-orange-700',
    areas: [
      'Kuchnia', 'Pizzerka', 'Blaty robocze', 'Stoły produkcyjne', 'Zlewy', 'Zmywak',
      'Piekarnik', 'Płyta / kuchnia gazowa', 'Okap', 'Sprzęt kuchenny', 'Deski i noże',
      'Pojemniki GN', 'Podłoga kuchnia', 'Ściany przy stanowiskach', 'Kosze na odpady',
      'Magazyn suchy', 'Regały magazynowe', 'Podłoga magazyn', 'Strefa dostaw',
      'Zaplecze socjalne', 'Chłodnia', 'Lodówka kuchnia duża', 'Lodówka kuchnia mała',
      'Lodówka obierak', 'Stół chłodniczy pizza', 'Zamrażarka kuchnia', 'Zamrażarka przejście',
    ],
    agents: [
      'Suma Bac D10', 'Fairy', 'Clinex', 'Incidin Plus', 'Clovin Multi',
      'Hyperin', 'Środek do podłóg', 'Środek do piekarnika', 'Środek do grilla / tłuszczu',
    ],
    combos: [
      { area: 'Pizzerka', agent: 'Fairy' },
      { area: 'Blaty robocze', agent: 'Suma Bac D10' },
      { area: 'Zlewy', agent: 'Suma Bac D10' },
      { area: 'Podłoga kuchnia', agent: 'Środek do podłóg' },
      { area: 'Chłodnia', agent: 'Incidin Plus' },
    ],
  },
  service_hall: {
    label: 'SALA',
    badge: 'SALA',
    description: 'Sala, bar, toalety, ogródek',
    badgeCls: 'bg-blue-100 text-blue-700',
    areas: [
      'Sala konsumpcyjna', 'Stoliki', 'Krzesła', 'Bar', 'Ekspres do kawy', 'Witryna',
      'Lodówki barowe', 'Lodówka bar sala 1', 'Lodówka bar sala 2', 'Lodówka bar sala 3',
      'Lodówka ekspres', 'Lodówka bar sala - PEPSI', 'Lodówka ogród PEPSI 1',
      'Lodówka ogród PEPSI 2', 'Lodówka ogród ŻYWIEC', 'Terminal / kasa', 'Klamki',
      'Menu / karty menu', 'Podłoga sala', 'Ogródek', 'Stoliki ogródek', 'Krzesła ogródek',
      'Toalety', 'Toaleta damska', 'Toaleta męska', 'Umywalki', 'Lustra',
      'Muszle WC', 'Pisuar', 'Dozowniki', 'Podłoga toalety', 'Kosze toalety',
    ],
    agents: [
      'Clinex', 'Fairy', 'Domestos', 'Incidin Plus', 'Płyn do szyb',
      'Środek do blatów', 'Środek do podłóg', 'Środek do WC',
    ],
    combos: [
      { area: 'Stoliki', agent: 'Clinex' },
      { area: 'Bar', agent: 'Clinex' },
      { area: 'Ekspres do kawy', agent: 'Clinex' },
      { area: 'Toalety', agent: 'Domestos' },
      { area: 'Podłoga sala', agent: 'Środek do podłóg' },
    ],
  },
} as const

const KITCHEN_SET = new Set<string>(DEPT.kitchen_back.areas)
const HALL_SET = new Set<string>(DEPT.service_hall.areas)
const LEGACY: Record<string, Dept> = {
  Kuchnia: 'kitchen_back', Magazyn: 'kitchen_back', Lodówki: 'kitchen_back',
  'Sprzęt kuchenny': 'kitchen_back', Podłogi: 'kitchen_back',
  Sala: 'service_hall', Toalety: 'service_hall', Witryna: 'service_hall',
}

function deriveDept(area: string): Dept | null {
  if (KITCHEN_SET.has(area)) return 'kitchen_back'
  if (HALL_SET.has(area)) return 'service_hall'
  return LEGACY[area] ?? null
}

function getTodayStart() {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString()
}

interface Log { id: string; area: string; agent: string; cleaned_at: string; notes: string | null; doc_url: string | null; recorded_by: string | null }

export default function MyCiePage() {
  const [logs, setLogs] = useState<Log[]>([])
  const [customAreas, setCustomAreas] = useState<string[]>([])
  const [customAgents, setCustomAgents] = useState<string[]>([])
  const [usersMap, setUsersMap] = useState<Record<string, string>>({})

  const [dept, setDept] = useState<Dept | null>(null)
  const [area, setArea] = useState('')
  const [agent, setAgent] = useState('')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)

  const [showAddArea, setShowAddArea] = useState(false)
  const [customAreaInput, setCustomAreaInput] = useState('')
  const [showAddAgent, setShowAddAgent] = useState(false)
  const [customAgentInput, setCustomAgentInput] = useState('')

  const [histFilter, setHistFilter] = useState<HistFilter>('all')
  const [showHistory, setShowHistory] = useState(false)
  const [canManageAreas, setCanManageAreas] = useState(true)

  const fileRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  async function getCtx() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('location_id, role, permissions').eq('id', user!.id).single()
    return { locationId: profile?.location_id ?? '', userId: user!.id, profile }
  }

  async function fetchData() {
    const { locationId, profile } = await getCtx()
    const perms = resolvePermissions(profile?.role, profile?.permissions as Partial<AppPermissions> | null)
    setCanManageAreas(perms.cleaning_manage_areas)
    const [logsRes, locRes] = await Promise.all([
      supabase.from('cleaning_logs').select('id,area,agent,cleaned_at,notes,doc_url,recorded_by')
        .eq('location_id', locationId).order('cleaned_at', { ascending: false }).limit(100),
      supabase.from('locations').select('cleaning_areas,cleaning_agents').eq('id', locationId).single(),
    ])
    const rows = logsRes.data ?? []
    setLogs(rows)
    setCustomAreas(locRes.data?.cleaning_areas ?? [])
    setCustomAgents(locRes.data?.cleaning_agents ?? [])

    const ids = Array.from(new Set(rows.map((r: Log) => r.recorded_by).filter(Boolean) as string[]))
    if (ids.length > 0) {
      const { data: pData } = await supabase.from('profiles').select('id, full_name').in('id', ids)
      setUsersMap(Object.fromEntries((pData ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name ?? ''])))
    }
  }

  useEffect(() => { fetchData() }, [])

  function selectDept(d: Dept) {
    setDept(d); setArea(''); setAgent('')
    setShowAddArea(false); setShowAddAgent(false)
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
  }

  function applyCombo(a: string, ag: string, d: Dept) {
    setDept(d); setArea(a); setAgent(ag)
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80)
  }

  async function handleSave() {
    if (!dept) { toast.error('Wybierz dział: Kuchnia / zaplecze albo Sala.'); return }
    if (!area.trim()) { toast.error('Wybierz obszar mycia.'); return }
    if (!agent.trim()) { toast.error('Wybierz środek czyszczący.'); return }
    setLoading(true)
    const { locationId, userId } = await getCtx()

    let docUrl: string | null = null
    if (file) {
      const ext = file.name.split('.').pop()
      const path = `cleaning/${locationId}/${Date.now()}.${ext}`
      const { data: upload, error: uploadErr } = await supabase.storage
        .from('documents').upload(path, file, { upsert: false })
      if (uploadErr) { toast.error('Błąd uploadu: ' + uploadErr.message); setLoading(false); return }
      docUrl = supabase.storage.from('documents').getPublicUrl(upload.path).data.publicUrl
    }

    const { error } = await supabase.from('cleaning_logs').insert({
      location_id: locationId, area: area.trim(), agent: agent.trim(),
      concentration: null, cleaned_at: new Date().toISOString(),
      recorded_by: userId, notes: notes.trim() || null, doc_url: docUrl,
    })
    setLoading(false)
    if (error) { toast.error('Błąd zapisu: ' + error.message); return }
    toast.success('Wpis mycia zapisany.')
    setArea(''); setAgent(''); setNotes(''); setFile(null)
    if (fileRef.current) fileRef.current.value = ''
    setShowAddArea(false); setShowAddAgent(false)
    fetchData()
  }

  const todayStart = getTodayStart()
  const todayLogs = useMemo(() => logs.filter(l => new Date(l.cleaned_at) >= new Date(todayStart)), [logs])

  const quickCombos = useMemo(() => {
    if (!dept) return []
    const relevant = logs.filter(l => deriveDept(l.area) === dept).slice(0, 30)
    const counts = new Map<string, number>()
    relevant.forEach(l => {
      const k = `${l.area}|||${l.agent}`
      counts.set(k, (counts.get(k) ?? 0) + 1)
    })
    const fromHistory = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([k]) => { const [a, ag] = k.split('|||'); return { area: a, agent: ag } })
    if (fromHistory.length >= 3) return fromHistory
    const seen = new Set(fromHistory.map(c => `${c.area}|||${c.agent}`))
    const extras = (DEPT[dept].combos as readonly { area: string; agent: string }[])
      .filter(c => !seen.has(`${c.area}|||${c.agent}`))
    return [...fromHistory, ...extras].slice(0, 5)
  }, [logs, dept])

  const deptAreas = useMemo(() =>
    dept ? [...(DEPT[dept].areas as readonly string[]), ...customAreas] : [],
    [dept, customAreas]
  )
  const deptAgents = useMemo(() =>
    dept ? [...(DEPT[dept].agents as readonly string[]), ...customAgents] : [],
    [dept, customAgents]
  )

  const filteredHistory = useMemo(() => {
    const past = logs.filter(l => new Date(l.cleaned_at) < new Date(todayStart))
    if (histFilter === 'all') return past
    return past.filter(l => deriveDept(l.area) === histFilter)
  }, [logs, histFilter])

  function DeptBadge({ area }: { area: string }) {
    const d = deriveDept(area)
    if (!d) return null
    return (
      <span className={cn('inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-full mb-0.5', DEPT[d].badgeCls)}>
        {DEPT[d].badge}
      </span>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mycie i dezynfekcja</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Dzisiaj: <span className="font-semibold text-gray-800">{todayLogs.length} wpisów</span>
        </p>
      </div>

      {/* Department tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {(Object.keys(DEPT) as Dept[]).map(key => {
          const cfg = DEPT[key]
          const isActive = dept === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => selectDept(key)}
              className={cn(
                'relative text-left p-4 rounded-2xl border-2 transition-all',
                isActive
                  ? 'border-green-500 bg-green-50 shadow-sm'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
              )}
            >
              {isActive && (
                <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                  <Check size={13} className="text-white" />
                </div>
              )}
              <p className={cn('font-bold text-base pr-8', isActive ? 'text-green-800' : 'text-gray-900')}>
                {cfg.label}
              </p>
              <p className={cn('text-xs mt-1', isActive ? 'text-green-600' : 'text-gray-400')}>
                {cfg.description}
              </p>
            </button>
          )
        })}
      </div>

      {/* Quick combos */}
      {dept && quickCombos.length > 0 && (
        <div className="card space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Najczęściej używane — {DEPT[dept].badge}
          </p>
          <div className="space-y-1.5">
            {quickCombos.map(({ area: a, agent: ag }) => {
              const isChosen = area === a && agent === ag
              return (
                <button
                  key={`${a}+${ag}`}
                  type="button"
                  onClick={() => applyCombo(a, ag, dept)}
                  className={cn(
                    'w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all text-left',
                    isChosen ? 'border-green-400 bg-green-50' : 'border-gray-100 bg-white hover:border-brand-navy/20 hover:bg-brand-navy/5'
                  )}
                >
                  <span className="text-sm">
                    <span className="font-semibold text-gray-900">{a}</span>
                    <span className="text-gray-400 mx-2 text-xs">+</span>
                    <span className="text-gray-600">{ag}</span>
                  </span>
                  {isChosen
                    ? <Check size={15} className="text-green-500 shrink-0" />
                    : <Plus size={15} className="text-gray-400 shrink-0" />
                  }
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Form */}
      {dept && (
        <div className="card space-y-5" ref={formRef}>
          <p className="font-bold text-gray-900">
            Nowy wpis — <span className={cn('text-sm font-semibold px-2 py-0.5 rounded-full', DEPT[dept].badgeCls)}>{DEPT[dept].badge}</span>
          </p>

          {/* Areas */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-gray-700">Obszar mycia</p>
              {canManageAreas && (
                <button type="button"
                  onClick={() => { setShowAddArea(!showAddArea); setCustomAreaInput('') }}
                  className="text-xs text-brand-navy hover:underline">
                  {showAddArea ? 'Anuluj' : '+ Inny obszar'}
                </button>
              )}
            </div>
            {showAddArea && (
              <div className="flex gap-2 mb-3">
                <input
                  className="input flex-1 text-sm" autoFocus
                  placeholder="Wpisz nazwę obszaru"
                  value={customAreaInput}
                  onChange={e => setCustomAreaInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); setArea(customAreaInput.trim()); setShowAddArea(false) }
                  }}
                />
                <button type="button"
                  onClick={() => { setArea(customAreaInput.trim()); setShowAddArea(false) }}
                  className="px-3 py-2 bg-brand-navy text-white text-sm rounded-lg hover:bg-brand-navy-light">
                  Użyj
                </button>
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-52 overflow-y-auto pr-0.5">
              {deptAreas.map(a => (
                <button key={a} type="button" onClick={() => setArea(a)}
                  className={cn(
                    'px-3 py-2.5 rounded-xl border-2 text-xs font-medium transition-all min-h-[44px] text-left',
                    area === a
                      ? 'border-green-500 bg-green-50 text-green-800'
                      : 'border-gray-100 bg-white text-gray-700 hover:border-green-200'
                  )}>
                  {a}
                </button>
              ))}
            </div>
            {area && !deptAreas.includes(area) && (
              <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700">
                <Check size={13} className="text-blue-500" />
                Wybrany: <strong>{area}</strong>
              </div>
            )}
          </div>

          {/* Agents */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-gray-700">Środek czyszczący / dezynfekcyjny</p>
              {canManageAreas && (
                <button type="button"
                  onClick={() => { setShowAddAgent(!showAddAgent); setCustomAgentInput('') }}
                  className="text-xs text-brand-navy hover:underline">
                  {showAddAgent ? 'Anuluj' : '+ Inny środek'}
                </button>
              )}
            </div>
            {showAddAgent && (
              <div className="flex gap-2 mb-3">
                <input
                  className="input flex-1 text-sm" autoFocus
                  placeholder="Wpisz nazwę środka"
                  value={customAgentInput}
                  onChange={e => setCustomAgentInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); setAgent(customAgentInput.trim()); setShowAddAgent(false) }
                  }}
                />
                <button type="button"
                  onClick={() => { setAgent(customAgentInput.trim()); setShowAddAgent(false) }}
                  className="px-3 py-2 bg-brand-navy text-white text-sm rounded-lg hover:bg-brand-navy-light">
                  Użyj
                </button>
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {deptAgents.map(ag => (
                <button key={ag} type="button" onClick={() => setAgent(ag)}
                  className={cn(
                    'px-3 py-2.5 rounded-xl border-2 text-xs font-medium transition-all min-h-[44px] text-left',
                    agent === ag
                      ? 'border-green-500 bg-green-50 text-green-800'
                      : 'border-gray-100 bg-white text-gray-700 hover:border-green-200'
                  )}>
                  {ag}
                </button>
              ))}
            </div>
            {agent && !deptAgents.includes(agent) && (
              <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700">
                <Check size={13} className="text-blue-500" />
                Wybrany: <strong>{agent}</strong>
              </div>
            )}
          </div>

          {/* Notes + file */}
          <div className="space-y-3">
            <div>
              <label className="label">Uwagi <span className="text-gray-400 font-normal">(opcjonalne)</span></label>
              <input className="input" placeholder="Dodatkowe informacje" value={notes}
                onChange={e => setNotes(e.target.value)} />
            </div>
            <div>
              <label className="label">Załącznik <span className="text-gray-400 font-normal">(opcjonalne)</span></label>
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

          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className={cn(
              'w-full py-4 rounded-xl text-sm font-bold transition-colors min-h-[56px]',
              loading ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-brand-green hover:bg-brand-green-dark text-white'
            )}
          >
            {loading ? 'Zapisywanie…' : 'Zapisz wpis mycia'}
          </button>
        </div>
      )}

      {/* Empty state */}
      {!dept && logs.length === 0 && (
        <div className="card border-dashed border-2 border-gray-200 text-center py-12">
          <Droplets size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 mb-1">Brak wpisów mycia.</p>
          <p className="text-sm text-gray-400">Wybierz dział powyżej, aby dodać wpis.</p>
        </div>
      )}

      {/* Today's entries */}
      {todayLogs.length > 0 && (
        <div className="card">
          <p className="font-semibold text-gray-900 mb-3 text-sm">Dzisiaj ({todayLogs.length})</p>
          <div className="divide-y divide-gray-50">
            {todayLogs.map(log => (
              <div key={log.id} className="py-3 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <DeptBadge area={log.area} />
                  <p className="font-semibold text-sm text-gray-900">{log.area}</p>
                  <p className="text-xs text-cyan-700 font-medium mt-0.5">{log.agent}</p>
                  {log.notes && <p className="text-xs text-gray-400 mt-0.5">{log.notes}</p>}
                  {log.doc_url && (
                    <a href={log.doc_url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-0.5">
                      <Paperclip size={10} /> Załącznik
                    </a>
                  )}
                  {log.recorded_by && usersMap[log.recorded_by] && (
                    <p className="text-xs text-gray-500 mt-0.5">Zapisał/a: <span className="font-medium">{usersMap[log.recorded_by]}</span></p>
                  )}
                </div>
                <p className="text-xs text-gray-400 whitespace-nowrap mt-1">{formatDateTime(log.cleaned_at)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History */}
      {logs.length > todayLogs.length && (
        <div className="card">
          <button type="button" onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center justify-between text-sm font-semibold text-gray-700">
            <span>Historia ({logs.length - todayLogs.length} wcześniejszych wpisów)</span>
            {showHistory ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
          </button>

          {showHistory && (
            <>
              <div className="flex gap-2 mt-3 mb-3">
                {(['all', 'kitchen_back', 'service_hall'] as HistFilter[]).map(f => (
                  <button key={f} type="button" onClick={() => setHistFilter(f)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                      histFilter === f
                        ? 'bg-green-600 text-white border-green-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                    )}>
                    {f === 'all' ? 'Wszystkie' : f === 'kitchen_back' ? 'Kuchnia / zaplecze' : 'Sala'}
                  </button>
                ))}
              </div>

              {filteredHistory.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">Brak wpisów dla wybranego filtra.</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {filteredHistory.map(log => (
                    <div key={log.id} className="py-2.5 flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <DeptBadge area={log.area} />
                        <p className="text-sm text-gray-800 font-medium">{log.area}</p>
                        <p className="text-xs text-gray-500">{log.agent}</p>
                        {log.notes && <p className="text-xs text-gray-400">{log.notes}</p>}
                        {log.recorded_by && usersMap[log.recorded_by] && (
                          <p className="text-xs text-gray-400">Zapisał/a: <span className="font-medium">{usersMap[log.recorded_by]}</span></p>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 whitespace-nowrap mt-1">{formatDateTime(log.cleaned_at)}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
