'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Droplets, Plus, Paperclip, X, Check, Calendar,
  AlertCircle, Trash2, CheckCircle2, Circle, History,
} from 'lucide-react'
import { formatDateTime, getTodayStart } from '@/lib/utils'
import { buildSignedUrlMap } from '@/lib/storage'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { resolvePermissions } from '@/lib/permissions'
import type { AppPermissions } from '@/lib/permissions'

type Dept = 'kitchen_back' | 'service_hall'
type Frequency = 'daily' | 'weekly' | 'monthly'
type Tab = 'dzis' | 'obszary' | 'harmonogram' | 'historia'
type TaskStatus = 'done' | 'due' | 'overdue'

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

const FREQ_LABEL: Record<Frequency, string> = { daily: 'Codziennie', weekly: 'Tygodniowo', monthly: 'Miesięcznie' }
const DOW_SHORT = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nd']
const DOW_FULL  = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela']

interface CleaningTask {
  id: string; name: string; area: string; agent: string | null
  frequency: Frequency; day_of_week: number | null; day_of_month: number | null
  dept: Dept | null; is_active: boolean; created_at: string
}
interface Log {
  id: string; area: string; agent: string; cleaned_at: string
  notes: string | null; doc_url: string | null; recorded_by: string | null
  cleaning_task_id: string | null; performed_by: string | null
}
interface Profile { id: string; full_name: string | null }

function getTaskStatus(task: CleaningTask, logs: Log[], todayStart: Date): TaskStatus | null {
  const completedToday = logs.some(
    l => l.cleaning_task_id === task.id && new Date(l.cleaned_at) >= todayStart
  )
  if (completedToday) return 'done'

  const now = new Date()
  const dow = now.getDay() === 0 ? 6 : now.getDay() - 1
  const dom = now.getDate()

  if (task.frequency === 'daily') return 'due'

  if (task.frequency === 'weekly' && task.day_of_week !== null) {
    if (task.day_of_week === dow) return 'due'
    if (task.day_of_week < dow) {
      const scheduled = new Date(now)
      scheduled.setDate(now.getDate() - (dow - task.day_of_week))
      scheduled.setHours(0, 0, 0, 0)
      const done = logs.some(l => l.cleaning_task_id === task.id && new Date(l.cleaned_at) >= scheduled)
      if (!done) return 'overdue'
    }
    return null
  }

  if (task.frequency === 'monthly' && task.day_of_month !== null) {
    if (task.day_of_month === dom) return 'due'
    if (task.day_of_month < dom) {
      const scheduled = new Date(now.getFullYear(), now.getMonth(), task.day_of_month)
      scheduled.setHours(0, 0, 0, 0)
      const done = logs.some(l => l.cleaning_task_id === task.id && new Date(l.cleaned_at) >= scheduled)
      if (!done) return 'overdue'
    }
    return null
  }

  return null
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'dzis',        label: 'Dziś' },
  { id: 'obszary',     label: 'Obszary' },
  { id: 'harmonogram', label: 'Harmonogram' },
  { id: 'historia',    label: 'Historia' },
]

export default function MyCiePage() {
  const supabase = createClient()
  const [tab, setTab] = useState<Tab>('dzis')

  // Shared
  const [locId, setLocId]         = useState('')
  const [userId, setUserId]       = useState('')
  const [canManage, setCanManage] = useState(false)
  const [logs, setLogs]           = useState<Log[]>([])
  const [tasks, setTasks]         = useState<CleaningTask[]>([])
  const [usersMap, setUsersMap]   = useState<Record<string, string>>({})
  const [allProfiles, setAllProfiles] = useState<Profile[]>([])
  const [customAreas, setCustomAreas]     = useState<string[]>([])
  const [customAgents, setCustomAgents]   = useState<string[]>([])
  const [medicalWorkers, setMedicalWorkers] = useState<string[]>([])

  // Dziś — ad-hoc form
  const [area, setArea]   = useState('')
  const [agent, setAgent] = useState('')
  const [notes, setNotes] = useState('')
  const [file, setFile]   = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [areaSearch, setAreaSearch]             = useState('')
  const [showAddArea, setShowAddArea]           = useState(false)
  const [customAreaInput, setCustomAreaInput]   = useState('')
  const [showAddAgent, setShowAddAgent]         = useState(false)
  const [customAgentInput, setCustomAgentInput] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // Dziś — dept filter + ad-hoc toggle
  const [deptFilter, setDeptFilter] = useState<'all' | Dept>('all')
  const [showAdHoc, setShowAdHoc]   = useState(false)

  // Quick-execute modal
  const [execTask, setExecTask]         = useState<CleaningTask | null>(null)
  const [execNotes, setExecNotes]       = useState('')
  const [execFile, setExecFile]         = useState<File | null>(null)
  const [execSaving, setExecSaving]     = useState(false)
  const [execWorker, setExecWorker]     = useState('')
  const [execWorkerManual, setExecWorkerManual] = useState(false)
  const execFileRef = useRef<HTMLInputElement>(null)

  // Bulk execute
  const [bulkMode, setBulkMode]                   = useState(false)
  const [selectedIds, setSelectedIds]             = useState<Set<string>>(new Set())
  const [bulkModal, setBulkModal]                 = useState(false)
  const [bulkNotes, setBulkNotes]                 = useState('')
  const [bulkWorker, setBulkWorker]               = useState('')
  const [bulkWorkerManual, setBulkWorkerManual]   = useState(false)
  const [bulkSaving, setBulkSaving]               = useState(false)

  // Obszary — task form
  const taskFormRef = useRef<HTMLDivElement>(null)
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [editTask, setEditTask]         = useState<CleaningTask | null>(null)
  const [tf, setTf] = useState({ name: '', area: '', agent: '', frequency: 'daily' as Frequency, day_of_week: 0, day_of_month: 1, dept: '' as Dept | '' })
  const [taskSaving, setTaskSaving] = useState(false)

  // Historia — filters
  const [histDateFrom, setHistDateFrom] = useState('')
  const [histDateTo, setHistDateTo]     = useState('')
  const [histArea, setHistArea]         = useState('')
  const [histWorker, setHistWorker]     = useState('')
  const [histDept, setHistDept]         = useState<'all' | Dept>('all')
  const [histLogs, setHistLogs]         = useState<Log[]>([])
  const [histLoading, setHistLoading]   = useState(false)
  const [histSearched, setHistSearched] = useState(false)

  async function getCtx() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles')
      .select('location_id, role, permissions').eq('id', user!.id).single()
    return { locationId: profile?.location_id ?? '', userId: user!.id, profile }
  }

  async function fetchData() {
    const { locationId, userId: uid, profile } = await getCtx()
    setLocId(locationId)
    setUserId(uid)
    const perms = resolvePermissions(profile?.role, profile?.permissions as Partial<AppPermissions> | null)
    setCanManage(perms.cleaning_manage_areas)

    const [logsRes, tasksRes, locRes, profsRes, medRes] = await Promise.all([
      supabase.from('cleaning_logs')
        .select('id,area,agent,cleaned_at,notes,doc_url,recorded_by,cleaning_task_id,performed_by')
        .eq('location_id', locationId).order('cleaned_at', { ascending: false }).limit(200),
      supabase.from('cleaning_tasks')
        .select('*').eq('location_id', locationId).eq('is_active', true).order('created_at'),
      supabase.from('locations').select('cleaning_areas,cleaning_agents').eq('id', locationId).single(),
      supabase.from('profiles').select('id, full_name'),
      supabase.from('medical_records').select('person_name').eq('location_id', locationId).order('person_name'),
    ])

    const rawLogs: Log[] = logsRes.data ?? []
    const signedMap = await buildSignedUrlMap(supabase, 'documents', rawLogs.map(r => r.doc_url))
    const rows = rawLogs.map(r => ({ ...r, doc_url: r.doc_url ? signedMap.get(r.doc_url) ?? r.doc_url : null }))
    setLogs(rows)
    setTasks(tasksRes.data ?? [])
    setCustomAreas(locRes.data?.cleaning_areas ?? [])
    setCustomAgents(locRes.data?.cleaning_agents ?? [])
    setAllProfiles(profsRes.data ?? [])
    const names = Array.from(new Set((medRes.data ?? []).map((r: { person_name: string }) => r.person_name).filter(Boolean))) as string[]
    setMedicalWorkers(names)

    const ids = Array.from(new Set(rows.map(r => r.recorded_by).filter(Boolean) as string[]))
    if (ids.length > 0) {
      const { data: pData } = await supabase.from('profiles').select('id, full_name').in('id', ids)
      setUsersMap(Object.fromEntries((pData ?? []).map((p: Profile) => [p.id, p.full_name ?? ''])))
    }
  }

  useEffect(() => { fetchData() }, [])

  useEffect(() => {
    const saved = localStorage.getItem('cleaning_last_worker')
    if (saved) setExecWorker(saved)
  }, [])

  useEffect(() => {
    if (showTaskForm && taskFormRef.current) {
      taskFormRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [showTaskForm])

  const todayStart = useMemo(() => new Date(getTodayStart()), [])
  const todayLogs  = useMemo(() => logs.filter(l => new Date(l.cleaned_at) >= todayStart), [logs, todayStart])

  const dueTasks = useMemo(() => {
    const STATUS_ORDER: Record<TaskStatus, number> = { overdue: 0, due: 1, done: 2 }
    return tasks
      .map(t => ({ task: t, status: getTaskStatus(t, logs, todayStart) }))
      .filter((x): x is { task: CleaningTask; status: TaskStatus } => x.status !== null)
      .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])
  }, [tasks, logs, todayStart])

  const filteredDueTasks = useMemo(() =>
    deptFilter === 'all' ? dueTasks : dueTasks.filter(x => x.task.dept === deptFilter),
  [dueTasks, deptFilter])

  // Ad-hoc form helpers
  async function handleSave() {
    if (!area.trim()) { toast.error('Wybierz obszar mycia.'); return }
    if (!agent.trim()) { toast.error('Wybierz środek czyszczący.'); return }
    setSaving(true)
    let docUrl: string | null = null
    if (file) {
      const ext = file.name.split('.').pop()
      const path = `cleaning/${locId}/${Date.now()}.${ext}`
      const { data: upload, error: uploadErr } = await supabase.storage
        .from('documents').upload(path, file, { upsert: false })
      if (uploadErr) { toast.error('Błąd uploadu: ' + uploadErr.message); setSaving(false); return }
      docUrl = supabase.storage.from('documents').getPublicUrl(upload.path).data.publicUrl
    }
    const { error } = await supabase.from('cleaning_logs').insert({
      location_id: locId, area: area.trim(), agent: agent.trim(),
      concentration: null, cleaned_at: new Date().toISOString(),
      recorded_by: userId, notes: notes.trim() || null, doc_url: docUrl,
    })
    setSaving(false)
    if (error) { toast.error('Błąd zapisu: ' + error.message); return }
    toast.success('Wpis mycia zapisany.')
    setArea(''); setAgent(''); setNotes(''); setFile(null)
    if (fileRef.current) fileRef.current.value = ''
    setShowAddArea(false); setShowAddAgent(false)
    fetchData()
  }

  // Quick-execute
  async function handleExec() {
    if (!execTask) return
    setExecSaving(true)
    let docUrl: string | null = null
    if (execFile) {
      const ext = execFile.name.split('.').pop()
      const path = `cleaning/${locId}/${Date.now()}.${ext}`
      const { data: upload, error: uploadErr } = await supabase.storage
        .from('documents').upload(path, execFile, { upsert: false })
      if (uploadErr) { toast.error('Błąd uploadu: ' + uploadErr.message); setExecSaving(false); return }
      docUrl = supabase.storage.from('documents').getPublicUrl(upload.path).data.publicUrl
    }
    const worker = execWorker.trim()
    if (worker) localStorage.setItem('cleaning_last_worker', worker)
    const { error } = await supabase.from('cleaning_logs').insert({
      location_id: locId, area: execTask.area, agent: execTask.agent ?? '',
      concentration: null, cleaned_at: new Date().toISOString(),
      recorded_by: userId, notes: execNotes.trim() || null,
      doc_url: docUrl, cleaning_task_id: execTask.id,
      performed_by: worker || null,
    })
    setExecSaving(false)
    if (error) { toast.error('Błąd zapisu: ' + error.message); return }
    toast.success(`Zadanie „${execTask.name}" wykonane!`)
    setExecTask(null); setExecNotes(''); setExecFile(null); setExecWorkerManual(false)
    if (execFileRef.current) execFileRef.current.value = ''
    fetchData()
  }

  // Bulk execute
  async function handleBulkExec() {
    const ids = Array.from(selectedIds)
    const tasksToExec = dueTasks.filter(x => ids.includes(x.task.id) && x.status !== 'done').map(x => x.task)
    if (tasksToExec.length === 0) return
    setBulkSaving(true)
    const worker = bulkWorker.trim()
    if (worker) localStorage.setItem('cleaning_last_worker', worker)
    const rows = tasksToExec.map(t => ({
      location_id: locId, area: t.area, agent: t.agent ?? '',
      concentration: null, cleaned_at: new Date().toISOString(),
      recorded_by: userId, notes: bulkNotes.trim() || null,
      doc_url: null, cleaning_task_id: t.id,
      performed_by: worker || null,
    }))
    const { error } = await supabase.from('cleaning_logs').insert(rows)
    setBulkSaving(false)
    if (error) { toast.error('Błąd zapisu: ' + error.message); return }
    toast.success(`Wykonano ${rows.length} ${rows.length === 1 ? 'zadanie' : 'zadania/zadań'}!`)
    setBulkModal(false); setBulkMode(false); setSelectedIds(new Set())
    setBulkNotes(''); setBulkWorkerManual(false)
    fetchData()
  }

  // Task management
  function openAddTask() {
    setEditTask(null)
    setTf({ name: '', area: '', agent: '', frequency: 'daily', day_of_week: 0, day_of_month: 1, dept: '' })
    setShowTaskForm(true)
  }
  function openEditTask(t: CleaningTask) {
    setEditTask(t)
    setTf({ name: t.name, area: t.area, agent: t.agent ?? '', frequency: t.frequency, day_of_week: t.day_of_week ?? 0, day_of_month: t.day_of_month ?? 1, dept: t.dept ?? '' })
    setShowTaskForm(true)
  }
  async function handleSaveTask() {
    if (!tf.name.trim() || !tf.area.trim()) { toast.error('Podaj nazwę i obszar zadania.'); return }
    setTaskSaving(true)
    const payload = {
      location_id: locId, name: tf.name.trim(), area: tf.area.trim(),
      agent: tf.agent.trim() || null, frequency: tf.frequency,
      day_of_week:  tf.frequency === 'weekly'  ? tf.day_of_week  : null,
      day_of_month: tf.frequency === 'monthly' ? tf.day_of_month : null,
      dept: tf.dept || null,
      is_active: true, created_by: userId,
    }
    const { error } = editTask
      ? await supabase.from('cleaning_tasks').update(payload).eq('id', editTask.id)
      : await supabase.from('cleaning_tasks').insert(payload)
    setTaskSaving(false)
    if (error) { toast.error('Błąd: ' + error.message); return }
    toast.success(editTask ? 'Zadanie zaktualizowane.' : 'Zadanie dodane.')
    setShowTaskForm(false); setEditTask(null)
    fetchData()
  }
  async function handleDeleteTask(id: string) {
    if (!confirm('Usunąć to zadanie z harmonogramu?')) return
    const { error } = await supabase.from('cleaning_tasks').update({ is_active: false }).eq('id', id)
    if (error) { toast.error('Błąd: ' + error.message); return }
    toast.success('Zadanie usunięte.')
    fetchData()
  }

  const [seedLoading, setSeedLoading] = useState(false)
  async function handleSeedDefaults() {
    if (!confirm('Dodać domyślne zadania mycia? Zostaną dodane do istniejących.')) return
    setSeedLoading(true)
    const defaults: { name: string; area: string; agent: string; frequency: string; dept: Dept | null; day_of_week?: number; day_of_month?: number }[] = [
      // Codziennie — kuchnia
      { name: 'Mycie blatów roboczych',       area: 'Blaty robocze',            agent: 'Suma Bac D10',         frequency: 'daily',   dept: 'kitchen_back' },
      { name: 'Mycie zlewów — kuchnia',       area: 'Zlewy',                    agent: 'Suma Bac D10',         frequency: 'daily',   dept: 'kitchen_back' },
      { name: 'Dezynfekcja desek i noży',     area: 'Deski i noże',             agent: 'Suma Bac D10',         frequency: 'daily',   dept: 'kitchen_back' },
      { name: 'Mycie podłogi kuchni',         area: 'Podłoga kuchnia',          agent: 'Środek do podłóg',     frequency: 'daily',   dept: 'kitchen_back' },
      { name: 'Mycie zmywaka',                area: 'Zmywak',                   agent: 'Fairy',                frequency: 'daily',   dept: 'kitchen_back' },
      // Codziennie — sala
      { name: 'Mycie stolików',               area: 'Stoliki',                  agent: 'Clinex',               frequency: 'daily',   dept: 'service_hall' },
      { name: 'Mycie baru',                   area: 'Bar',                      agent: 'Clinex',               frequency: 'daily',   dept: 'service_hall' },
      { name: 'Mycie ekspresu do kawy',       area: 'Ekspres do kawy',          agent: 'Clinex',               frequency: 'daily',   dept: 'service_hall' },
      { name: 'Mycie toalet',                 area: 'Toalety',                  agent: 'Domestos',             frequency: 'daily',   dept: 'service_hall' },
      { name: 'Mycie podłogi sali',           area: 'Podłoga sala',             agent: 'Środek do podłóg',     frequency: 'daily',   dept: 'service_hall' },
      { name: 'Mycie zlewów — sala',          area: 'Umywalki',                 agent: 'Clinex',               frequency: 'daily',   dept: 'service_hall' },
      // Tygodniowo — kuchnia
      { name: 'Mycie chłodni',                area: 'Chłodnia',                 agent: 'Incidin Plus',         frequency: 'weekly',  dept: 'kitchen_back', day_of_week: 0 },
      { name: 'Mycie lodówki kuchennej',      area: 'Lodówka kuchnia duża',     agent: 'Incidin Plus',         frequency: 'weekly',  dept: 'kitchen_back', day_of_week: 2 },
      { name: 'Mycie piekarnika',             area: 'Piekarnik',                agent: 'Środek do piekarnika', frequency: 'weekly',  dept: 'kitchen_back', day_of_week: 1 },
      { name: 'Mycie okapu',                  area: 'Okap',                     agent: 'Clinex',               frequency: 'weekly',  dept: 'kitchen_back', day_of_week: 4 },
      { name: 'Mycie pizzerki',               area: 'Pizzerka',                 agent: 'Fairy',                frequency: 'weekly',  dept: 'kitchen_back', day_of_week: 3 },
      // Tygodniowo — sala
      { name: 'Mycie witryny',                area: 'Witryna',                  agent: 'Płyn do szyb',         frequency: 'weekly',  dept: 'service_hall', day_of_week: 4 },
      { name: 'Mycie lodówek barowych',       area: 'Lodówki barowe',           agent: 'Incidin Plus',         frequency: 'weekly',  dept: 'service_hall', day_of_week: 0 },
      // Miesięcznie — kuchnia
      { name: 'Mycie regałów magazynowych',   area: 'Regały magazynowe',        agent: 'Clinex',               frequency: 'monthly', dept: 'kitchen_back', day_of_month: 1  },
      { name: 'Mycie ścian przy stanowisk.',  area: 'Ściany przy stanowiskach', agent: 'Clinex',               frequency: 'monthly', dept: 'kitchen_back', day_of_month: 15 },
      { name: 'Mycie zamrażarki',             area: 'Zamrażarka kuchnia',       agent: 'Incidin Plus',         frequency: 'monthly', dept: 'kitchen_back', day_of_month: 1  },
    ]
    const rows = defaults.map(d => ({
      location_id: locId, created_by: userId, is_active: true,
      name: d.name, area: d.area, agent: d.agent, frequency: d.frequency,
      dept: d.dept,
      day_of_week:  'day_of_week'  in d ? d.day_of_week  : null,
      day_of_month: 'day_of_month' in d ? d.day_of_month : null,
    }))
    const { error } = await supabase.from('cleaning_tasks').insert(rows)
    setSeedLoading(false)
    if (error) { toast.error('Błąd: ' + error.message); return }
    toast.success(`Dodano ${rows.length} domyślnych zadań.`)
    fetchData()
  }

  // Historia
  async function fetchHistory() {
    if (!locId) return
    setHistLoading(true); setHistSearched(true)
    let query = supabase.from('cleaning_logs')
      .select('id,area,agent,cleaned_at,notes,doc_url,recorded_by,cleaning_task_id,performed_by')
      .eq('location_id', locId).order('cleaned_at', { ascending: false }).limit(500)
    if (histDateFrom) query = query.gte('cleaned_at', histDateFrom + 'T00:00:00')
    if (histDateTo)   query = query.lte('cleaned_at', histDateTo   + 'T23:59:59')
    if (histArea.trim()) query = query.ilike('area', `%${histArea.trim()}%`)
    if (histWorker)   query = query.eq('recorded_by', histWorker)
    const { data } = await query
    let result: Log[] = data ?? []
    if (histDept !== 'all') result = result.filter(l => deriveDept(l.area) === histDept)
    const signedMap = await buildSignedUrlMap(supabase, 'documents', result.map(r => r.doc_url))
    result = result.map(r => ({ ...r, doc_url: r.doc_url ? signedMap.get(r.doc_url) ?? r.doc_url : null }))
    setHistLogs(result)
    setHistLoading(false)
  }

  // Derived: combined areas / agents from both depts
  const allAreas = useMemo(() => {
    const predefined = [...DEPT.kitchen_back.areas, ...DEPT.service_hall.areas]
    return Array.from(new Set([...predefined, ...customAreas]))
  }, [customAreas])
  const allAgents = useMemo(() => {
    const predefined = [...DEPT.kitchen_back.agents, ...DEPT.service_hall.agents]
    return Array.from(new Set([...predefined, ...customAgents]))
  }, [customAgents])
  const visibleAreas = useMemo(() => {
    const q = areaSearch.trim().toLowerCase()
    return q ? allAreas.filter(a => a.toLowerCase().includes(q)) : allAreas
  }, [allAreas, areaSearch])

  function DeptBadge({ area: a }: { area: string }) {
    const d = deriveDept(a)
    if (!d) return null
    return <span className={cn('inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-full', DEPT[d].badgeCls)}>{DEPT[d].badge}</span>
  }

  // ─── RENDER ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <PageHeader title="Higiena i czystość" subtitle={`Dziś: ${todayLogs.length} wpisów`} />

      {/* Tab bar */}
      <div className="flex border-b border-gray-200 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => { setTab(t.id); if (t.id === 'historia' && !histSearched) fetchHistory() }}
            className={cn(
              'px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors shrink-0',
              tab === t.id ? 'border-brand-green text-brand-green' : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            {t.label}
            {t.id === 'dzis' && dueTasks.some(x => x.status === 'overdue') && (
              <span className="ml-1.5 inline-flex items-center justify-center w-2 h-2 rounded-full bg-red-500" />
            )}
          </button>
        ))}
      </div>

      {/* ─── DZIŚ ─────────────────────────────────────────────────── */}
      {tab === 'dzis' && (
        <div className="space-y-5">
          {/* Dept filter pills */}
          {dueTasks.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {([
                { key: 'all',          label: 'Wszystkie' },
                { key: 'kitchen_back', label: 'Kuchnia / Zaplecze' },
                { key: 'service_hall', label: 'Sala' },
              ] as const).map(({ key, label }) => (
                <button key={key} type="button" onClick={() => setDeptFilter(key)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
                    deptFilter === key
                      ? key === 'kitchen_back' ? 'bg-orange-500 text-white border-orange-500'
                        : key === 'service_hall' ? 'bg-blue-500 text-white border-blue-500'
                        : 'bg-brand-navy text-white border-brand-navy'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                  )}>
                  {label}
                  {key !== 'all' && (
                    <span className="ml-1 opacity-70">
                      ({dueTasks.filter(x => x.task.dept === key).length})
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Scheduled task list */}
          {filteredDueTasks.length > 0 && (
            <div className="card space-y-2">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Harmonogram na dziś</p>
                {filteredDueTasks.some(x => x.status !== 'done') && (
                  bulkMode ? (
                    <button type="button" onClick={() => { setBulkMode(false); setSelectedIds(new Set()) }}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-50 text-red-500 border border-red-200 hover:bg-red-100 transition-colors">
                      Anuluj
                    </button>
                  ) : (
                    <button type="button" onClick={() => { setBulkMode(true); setSelectedIds(new Set()) }}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200 transition-colors">
                      Zaznacz kilka
                    </button>
                  )
                )}
              </div>
              {filteredDueTasks.map(({ task, status }) => {
                const isSelectable = bulkMode && status !== 'done'
                const isSelected   = selectedIds.has(task.id)
                return (
                  <div
                    key={task.id}
                    onClick={isSelectable ? () => setSelectedIds(prev => {
                      const next = new Set(prev)
                      next.has(task.id) ? next.delete(task.id) : next.add(task.id)
                      return next
                    }) : undefined}
                    className={cn(
                      'flex items-center gap-3 px-3 py-3 rounded-xl border transition-all',
                      isSelectable ? 'cursor-pointer' : '',
                      isSelected   ? 'bg-green-50 border-brand-green ring-1 ring-brand-green' :
                      status === 'done'    ? 'bg-gray-50 border-gray-100' :
                      status === 'overdue' ? 'bg-red-50 border-red-200'   : 'bg-white border-gray-200'
                    )}
                  >
                    <div className="shrink-0">
                      {bulkMode && status !== 'done' ? (
                        <div className={cn(
                          'w-5 h-5 rounded-md border-2 flex items-center justify-center',
                          isSelected ? 'bg-brand-green border-brand-green' : 'border-gray-300 bg-white'
                        )}>
                          {isSelected && <Check size={12} className="text-white" />}
                        </div>
                      ) : (
                        status === 'done'    ? <CheckCircle2 size={18} className="text-green-500" />
                        : status === 'overdue' ? <AlertCircle  size={18} className="text-red-500"   />
                        : <Circle size={18} className="text-gray-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm font-semibold truncate', status === 'done' ? 'text-gray-400 line-through' : 'text-gray-900')}>
                        {task.name}
                      </p>
                      <p className="text-xs text-gray-400 truncate">{task.area}{task.agent ? ` · ${task.agent}` : ''}</p>
                      {task.dept && (
                        <span className={cn('inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-full mt-0.5', DEPT[task.dept].badgeCls)}>
                          {DEPT[task.dept].badge}
                        </span>
                      )}
                    </div>
                    {!bulkMode && (
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={cn(
                          'hidden sm:inline text-[10px] font-bold px-2 py-0.5 rounded-full',
                          status === 'done'    ? 'bg-green-100 text-green-700' :
                          status === 'overdue' ? 'bg-red-100 text-red-700'     : 'bg-blue-100 text-blue-700'
                        )}>
                          {status === 'done' ? 'Wykonane' : status === 'overdue' ? 'Zaległe' : 'Do zrobienia'}
                        </span>
                        {status !== 'done' && (
                          <button
                            type="button"
                            onClick={() => {
                              setExecTask(task); setExecNotes(''); setExecFile(null)
                              const saved = localStorage.getItem('cleaning_last_worker') ?? ''
                              setExecWorker(saved)
                              setExecWorkerManual(saved !== '' && medicalWorkers.length > 0 && !medicalWorkers.includes(saved))
                            }}
                            className="px-3 py-1.5 bg-brand-green text-white text-xs font-semibold rounded-lg hover:bg-brand-green-dark transition-colors"
                          >
                            Wykonaj
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Bulk floating bar */}
          {bulkMode && selectedIds.size > 0 && (
            <div className="fixed bottom-20 inset-x-0 flex justify-center z-40 px-4 pointer-events-none">
              <div className="bg-brand-navy text-white rounded-2xl shadow-2xl px-5 py-3 flex items-center gap-4 w-full max-w-md pointer-events-auto">
                <p className="flex-1 text-sm font-medium">Zaznaczono: {selectedIds.size}</p>
                <button type="button"
                  onClick={() => {
                    const saved = localStorage.getItem('cleaning_last_worker') ?? ''
                    setBulkWorker(saved)
                    setBulkWorkerManual(saved !== '' && medicalWorkers.length > 0 && !medicalWorkers.includes(saved))
                    setBulkNotes('')
                    setBulkModal(true)
                  }}
                  className="px-4 py-2 bg-brand-green text-white text-sm font-bold rounded-xl hover:bg-brand-green-dark transition-colors">
                  Wykonaj zaznaczone
                </button>
              </div>
            </div>
          )}

          {/* Ad-hoc entry — collapsible */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdHoc(v => !v)}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-brand-navy transition-colors"
            >
              <Plus size={13} />
              {showAdHoc ? 'Ukryj formularz' : 'Dodaj wpis poza harmonogramem'}
            </button>

            {showAdHoc && (
              <div className="card space-y-5 mt-3">
                <p className="font-bold text-gray-900">Wpis poza harmonogramem</p>

                {/* Areas */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-gray-700">Obszar mycia</p>
                    {canManage && (
                      <button type="button" onClick={() => { setShowAddArea(!showAddArea); setCustomAreaInput('') }}
                        className="text-xs text-brand-navy hover:underline">
                        {showAddArea ? 'Anuluj' : '+ Inny obszar'}
                      </button>
                    )}
                  </div>
                  {showAddArea && (
                    <div className="flex gap-2 mb-3">
                      <input className="input flex-1 text-sm" autoFocus placeholder="Wpisz nazwę obszaru"
                        value={customAreaInput} onChange={e => setCustomAreaInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); setArea(customAreaInput.trim()); setShowAddArea(false) } }} />
                      <button type="button" onClick={() => { setArea(customAreaInput.trim()); setShowAddArea(false) }}
                        className="px-3 py-2 bg-brand-navy text-white text-sm rounded-lg">Użyj</button>
                    </div>
                  )}
                  {allAreas.length > 8 && (
                    <input className="input text-sm mb-2" placeholder="Szukaj obszaru…"
                      value={areaSearch} onChange={e => setAreaSearch(e.target.value)} />
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-52 overflow-y-auto pr-0.5">
                    {visibleAreas.map(a => (
                      <button key={a} type="button" onClick={() => setArea(a)}
                        className={cn('px-3 py-2.5 rounded-xl border-2 text-xs font-medium transition-all min-h-[44px] text-left',
                          area === a ? 'border-green-500 bg-green-50 text-green-800' : 'border-gray-100 bg-white text-gray-700 hover:border-green-200')}>
                        {a}
                      </button>
                    ))}
                    {visibleAreas.length === 0 && (
                      <p className="col-span-full text-xs text-gray-400 text-center py-3">Brak obszarów pasujących do &bdquo;{areaSearch}&rdquo;</p>
                    )}
                  </div>
                  {area && !allAreas.includes(area) && (
                    <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700">
                      <Check size={13} className="text-blue-500" /> Wybrany: <strong>{area}</strong>
                    </div>
                  )}
                </div>

                {/* Agents */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-gray-700">Środek czyszczący / dezynfekcyjny</p>
                    {canManage && (
                      <button type="button" onClick={() => { setShowAddAgent(!showAddAgent); setCustomAgentInput('') }}
                        className="text-xs text-brand-navy hover:underline">
                        {showAddAgent ? 'Anuluj' : '+ Inny środek'}
                      </button>
                    )}
                  </div>
                  {showAddAgent && (
                    <div className="flex gap-2 mb-3">
                      <input className="input flex-1 text-sm" autoFocus placeholder="Wpisz nazwę środka"
                        value={customAgentInput} onChange={e => setCustomAgentInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); setAgent(customAgentInput.trim()); setShowAddAgent(false) } }} />
                      <button type="button" onClick={() => { setAgent(customAgentInput.trim()); setShowAddAgent(false) }}
                        className="px-3 py-2 bg-brand-navy text-white text-sm rounded-lg">Użyj</button>
                    </div>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {allAgents.map(ag => (
                      <button key={ag} type="button" onClick={() => setAgent(ag)}
                        className={cn('px-3 py-2.5 rounded-xl border-2 text-xs font-medium transition-all min-h-[44px] text-left',
                          agent === ag ? 'border-green-500 bg-green-50 text-green-800' : 'border-gray-100 bg-white text-gray-700 hover:border-green-200')}>
                        {ag}
                      </button>
                    ))}
                  </div>
                  {agent && !allAgents.includes(agent) && (
                    <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700">
                      <Check size={13} className="text-blue-500" /> Wybrany: <strong>{agent}</strong>
                    </div>
                  )}
                </div>

                {/* Notes + file */}
                <div className="space-y-3">
                  <div>
                    <label className="label">Uwagi <span className="text-gray-400 font-normal">(opcjonalne)</span></label>
                    <input className="input" placeholder="Dodatkowe informacje" value={notes} onChange={e => setNotes(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Załącznik <span className="text-gray-400 font-normal">(opcjonalne)</span></label>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-600 cursor-pointer hover:border-gray-300 flex-1">
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

                <button type="button" onClick={handleSave} disabled={saving}
                  className={cn('w-full py-4 rounded-xl text-sm font-bold transition-colors min-h-[56px]',
                    saving ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-brand-green hover:bg-brand-green-dark text-white')}>
                  {saving ? 'Zapisywanie…' : 'Zapisz wpis mycia'}
                </button>
              </div>
            )}
          </div>

          {tasks.length === 0 && logs.length === 0 && (
            <EmptyState icon={Droplets} title="Brak wpisów mycia." description="Kliknij &bdquo;Dodaj wpis poza harmonogramem&rdquo; aby dodać pierwszy wpis." />
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
                      {(log.performed_by || (log.recorded_by && usersMap[log.recorded_by])) && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          Wykonał/a: <span className="font-medium">{log.performed_by || usersMap[log.recorded_by!]}</span>
                        </p>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 whitespace-nowrap mt-1">{formatDateTime(log.cleaned_at)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── OBSZARY ──────────────────────────────────────────────── */}
      {tab === 'obszary' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm text-gray-500">{tasks.length} {tasks.length === 1 ? 'zadanie' : 'zadań'} w harmonogramie</p>
            {canManage && (
              <div className="flex gap-2">
                {tasks.length === 0 && (
                  <button type="button" onClick={handleSeedDefaults} disabled={seedLoading}
                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50">
                    {seedLoading ? 'Dodawanie…' : '⚡ Załaduj domyślne'}
                  </button>
                )}
                <button type="button" onClick={openAddTask}
                  className="flex items-center gap-1.5 px-4 py-2 bg-brand-green text-white text-sm font-semibold rounded-xl hover:bg-brand-green-dark transition-colors">
                  <Plus size={15} /> Dodaj zadanie
                </button>
              </div>
            )}
          </div>

          {showTaskForm && (
            <div ref={taskFormRef} className="card space-y-4 border-2 border-brand-green/20">
              <p className="font-bold text-gray-900">{editTask ? 'Edytuj zadanie' : 'Nowe zadanie'}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Nazwa zadania *</label>
                  <input className="input" placeholder="np. Mycie podłóg kuchnia"
                    value={tf.name} onChange={e => setTf(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Obszar *</label>
                  <input className="input" placeholder="np. Podłoga kuchnia"
                    value={tf.area} onChange={e => setTf(p => ({ ...p, area: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Środek czyszczący</label>
                  <input className="input" placeholder="np. Środek do podłóg"
                    value={tf.agent} onChange={e => setTf(p => ({ ...p, agent: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Dział</label>
                  <select className="input" value={tf.dept} onChange={e => setTf(p => ({ ...p, dept: e.target.value as Dept | '' }))}>
                    <option value="">Bez przypisania</option>
                    <option value="kitchen_back">Kuchnia / Zaplecze</option>
                    <option value="service_hall">Sala</option>
                  </select>
                </div>
                <div>
                  <label className="label">Częstotliwość *</label>
                  <select className="input" value={tf.frequency} onChange={e => setTf(p => ({ ...p, frequency: e.target.value as Frequency }))}>
                    <option value="daily">Codziennie</option>
                    <option value="weekly">Tygodniowo</option>
                    <option value="monthly">Miesięcznie</option>
                  </select>
                </div>
                {tf.frequency === 'weekly' && (
                  <div>
                    <label className="label">Dzień tygodnia</label>
                    <select className="input" value={tf.day_of_week} onChange={e => setTf(p => ({ ...p, day_of_week: +e.target.value }))}>
                      {DOW_FULL.map((d, i) => <option key={i} value={i}>{d}</option>)}
                    </select>
                  </div>
                )}
                {tf.frequency === 'monthly' && (
                  <div>
                    <label className="label">Dzień miesiąca (1–28)</label>
                    <input type="number" className="input" min={1} max={28} value={tf.day_of_month}
                      onChange={e => setTf(p => ({ ...p, day_of_month: Math.max(1, Math.min(28, +e.target.value)) }))} />
                  </div>
                )}
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => { setShowTaskForm(false); setEditTask(null) }}
                  className="px-4 py-2 rounded-xl text-sm text-gray-600 border border-gray-200 hover:bg-gray-50">Anuluj</button>
                <button type="button" onClick={handleSaveTask} disabled={taskSaving}
                  className="px-4 py-2 rounded-xl text-sm font-semibold bg-brand-green text-white hover:bg-brand-green-dark disabled:opacity-50">
                  {taskSaving ? 'Zapisywanie…' : editTask ? 'Zapisz zmiany' : 'Dodaj zadanie'}
                </button>
              </div>
            </div>
          )}

          {tasks.length === 0 ? (
            <EmptyState icon={Calendar} title="Brak zaplanowanych zadań."
              description={canManage ? 'Kliknij „Dodaj zadanie" aby zaplanować harmonogram mycia.' : 'Administrator nie dodał jeszcze zadań do harmonogramu.'} />
          ) : (
            <div className="card divide-y divide-gray-50">
              {tasks.map(t => (
                <div key={t.id} className="py-3.5 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{t.area}{t.agent ? ` · ${t.agent}` : ''}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                        {FREQ_LABEL[t.frequency]}
                        {t.frequency === 'weekly'  && t.day_of_week  !== null ? ` — ${DOW_FULL[t.day_of_week]}`  : ''}
                        {t.frequency === 'monthly' && t.day_of_month !== null ? ` — ${t.day_of_month}. dnia mies.` : ''}
                      </span>
                      {t.dept && (
                        <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', DEPT[t.dept].badgeCls)}>
                          {DEPT[t.dept].badge}
                        </span>
                      )}
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex gap-1 shrink-0">
                      <button type="button" onClick={() => openEditTask(t)}
                        className="p-2 rounded-lg text-gray-400 hover:text-brand-navy hover:bg-gray-100 transition-colors text-sm">✏️</button>
                      <button type="button" onClick={() => handleDeleteTask(t.id)}
                        className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── HARMONOGRAM ──────────────────────────────────────────── */}
      {tab === 'harmonogram' && (
        <div className="space-y-4">
          {tasks.length === 0 ? (
            <EmptyState icon={Calendar} title="Brak harmonogramu."
              description="Dodaj zadania w zakładce Obszary, aby zobaczyć harmonogram." />
          ) : (
            <>
              {/* Daily */}
              {tasks.some(t => t.frequency === 'daily') && (
                <div className="card">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Codziennie</p>
                  <div className="space-y-2">
                    {tasks.filter(t => t.frequency === 'daily').map(t => (
                      <div key={t.id} className="flex items-center gap-3 px-3 py-2.5 bg-orange-50 rounded-xl">
                        <div className="w-2 h-2 rounded-full bg-orange-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900">{t.name}</p>
                          <p className="text-xs text-gray-500">{t.area}{t.agent ? ` · ${t.agent}` : ''}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Weekly — group by day */}
              {tasks.some(t => t.frequency === 'weekly') && (
                <div className="card">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Tygodniowo</p>
                  <div className="space-y-3">
                    {DOW_FULL.map((dayName, dow) => {
                      const dayTasks = tasks.filter(t => t.frequency === 'weekly' && t.day_of_week === dow)
                      if (dayTasks.length === 0) return null
                      const todayDow = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1
                      const isToday = dow === todayDow
                      return (
                        <div key={dow}>
                          <p className={cn('text-xs font-semibold mb-1.5', isToday ? 'text-brand-green' : 'text-gray-500')}>
                            {dayName}{isToday ? ' — dziś' : ''}
                          </p>
                          <div className="space-y-1.5 pl-2 border-l-2 border-gray-100">
                            {dayTasks.map(t => (
                              <div key={t.id} className={cn('flex items-center gap-3 px-3 py-2 rounded-xl', isToday ? 'bg-green-50' : 'bg-gray-50')}>
                                <div className={cn('w-2 h-2 rounded-full shrink-0', isToday ? 'bg-green-400' : 'bg-gray-300')} />
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-gray-900">{t.name}</p>
                                  <p className="text-xs text-gray-500">{t.area}{t.agent ? ` · ${t.agent}` : ''}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Monthly */}
              {tasks.some(t => t.frequency === 'monthly') && (
                <div className="card">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Miesięcznie</p>
                  <div className="space-y-2">
                    {tasks.filter(t => t.frequency === 'monthly')
                      .sort((a, b) => (a.day_of_month ?? 1) - (b.day_of_month ?? 1))
                      .map(t => {
                        const isToday = t.day_of_month === new Date().getDate()
                        return (
                          <div key={t.id} className={cn('flex items-center gap-3 px-3 py-2.5 rounded-xl', isToday ? 'bg-green-50' : 'bg-purple-50')}>
                            <span className={cn('text-xs font-bold w-8 shrink-0', isToday ? 'text-green-600' : 'text-purple-600')}>
                              {t.day_of_month}.
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900">{t.name}</p>
                              <p className="text-xs text-gray-500">{t.area}{t.agent ? ` · ${t.agent}` : ''}</p>
                            </div>
                            {isToday && <span className="ml-auto text-[10px] font-bold text-green-600 shrink-0">dziś</span>}
                          </div>
                        )
                      })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ─── HISTORIA ─────────────────────────────────────────────── */}
      {tab === 'historia' && (
        <div className="space-y-4">
          <div className="card space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Filtry</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Data od</label>
                <input type="date" className="input" value={histDateFrom} onChange={e => setHistDateFrom(e.target.value)} />
              </div>
              <div>
                <label className="label">Data do</label>
                <input type="date" className="input" value={histDateTo} onChange={e => setHistDateTo(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Obszar</label>
                <input className="input" placeholder="Szukaj obszaru…" value={histArea} onChange={e => setHistArea(e.target.value)} />
              </div>
              <div>
                <label className="label">Pracownik</label>
                <select className="input" value={histWorker} onChange={e => setHistWorker(e.target.value)}>
                  <option value="">Wszyscy</option>
                  {allProfiles.map(p => (
                    <option key={p.id} value={p.id}>{p.full_name || p.id.slice(0, 8)}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="label">Dział</label>
              <div className="flex gap-2 flex-wrap">
                {(['all', 'kitchen_back', 'service_hall'] as const).map(d => (
                  <button key={d} type="button" onClick={() => setHistDept(d)}
                    className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                      histDept === d ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300')}>
                    {d === 'all' ? 'Wszystkie' : d === 'kitchen_back' ? 'Kuchnia / Zaplecze' : 'Sala'}
                  </button>
                ))}
              </div>
            </div>
            <button type="button" onClick={fetchHistory} disabled={histLoading}
              className="w-full py-2.5 bg-brand-navy text-white text-sm font-semibold rounded-xl hover:bg-brand-navy-light disabled:opacity-50">
              {histLoading ? 'Wczytywanie…' : 'Szukaj'}
            </button>
          </div>

          {histSearched && !histLoading && (
            histLogs.length === 0 ? (
              <EmptyState icon={History} title="Brak wyników." description="Zmień filtry i kliknij Szukaj." />
            ) : (
              <div className="card">
                <p className="text-xs font-semibold text-gray-500 mb-3">{histLogs.length} wpisów</p>
                <div className="divide-y divide-gray-50">
                  {histLogs.map(log => (
                    <div key={log.id} className="py-2.5 flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <DeptBadge area={log.area} />
                        <p className="text-sm text-gray-800 font-medium">{log.area}</p>
                        <p className="text-xs text-gray-500">{log.agent}</p>
                        {log.notes && <p className="text-xs text-gray-400">{log.notes}</p>}
                        {log.doc_url && (
                          <a href={log.doc_url} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-0.5">
                            <Paperclip size={10} /> Załącznik
                          </a>
                        )}
                        {(log.performed_by || (log.recorded_by && usersMap[log.recorded_by])) && (
                          <p className="text-xs text-gray-400">
                            Wykonał/a: <span className="font-medium">{log.performed_by || usersMap[log.recorded_by!]}</span>
                          </p>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 whitespace-nowrap mt-1">{formatDateTime(log.cleaned_at)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      )}

      {/* ─── QUICK-EXECUTE MODAL ──────────────────────────────────── */}
      {execTask && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setExecTask(null) }}
        >
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold text-gray-900">{execTask.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {execTask.area}{execTask.agent ? ` · ${execTask.agent}` : ''}
                </p>
              </div>
              <button type="button" onClick={() => setExecTask(null)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <X size={18} />
              </button>
            </div>

            {/* Worker picker */}
            <div>
              <label className="label">Kto wykonał? <span className="text-gray-400 font-normal">(opcjonalne)</span></label>
              {medicalWorkers.length > 0 && !execWorkerManual ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    {medicalWorkers.map(w => (
                      <button key={w} type="button" onClick={() => setExecWorker(w)}
                        className={cn(
                          'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                          execWorker === w
                            ? 'bg-brand-green text-white border-brand-green'
                            : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                        )}>
                        {w}
                      </button>
                    ))}
                  </div>
                  <button type="button"
                    onClick={() => { setExecWorkerManual(true); setExecWorker('') }}
                    className="mt-2 text-xs text-gray-400 hover:text-brand-navy transition-colors">
                    + Wpisz inną osobę
                  </button>
                </>
              ) : (
                <div className="flex gap-2">
                  <input className="input flex-1 text-sm" placeholder="Imię i nazwisko pracownika"
                    value={execWorker} onChange={e => setExecWorker(e.target.value)}
                    autoFocus={execWorkerManual} />
                  {medicalWorkers.length > 0 && (
                    <button type="button"
                      onClick={() => {
                        setExecWorkerManual(false)
                        const saved = localStorage.getItem('cleaning_last_worker') ?? ''
                        setExecWorker(medicalWorkers.includes(saved) ? saved : '')
                      }}
                      className="px-3 py-2 border border-gray-200 rounded-xl text-xs text-gray-600 hover:bg-gray-50 whitespace-nowrap">
                      Wybierz z listy
                    </button>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="label">Uwagi <span className="text-gray-400 font-normal">(opcjonalne)</span></label>
              <textarea className="input resize-none" rows={2} placeholder="Dodatkowe informacje…"
                value={execNotes} onChange={e => setExecNotes(e.target.value)} />
            </div>

            <div>
              <label className="label">Zdjęcie / załącznik <span className="text-gray-400 font-normal">(opcjonalne)</span></label>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-600 cursor-pointer hover:border-gray-300 flex-1">
                  <Paperclip size={14} />
                  {execFile ? execFile.name : 'Wybierz plik'}
                  <input ref={execFileRef} type="file" accept="image/*,.pdf" className="hidden"
                    onChange={e => setExecFile(e.target.files?.[0] ?? null)} />
                </label>
                {execFile && (
                  <button type="button" onClick={() => { setExecFile(null); if (execFileRef.current) execFileRef.current.value = '' }}>
                    <X size={16} className="text-gray-400 hover:text-gray-600" />
                  </button>
                )}
              </div>
            </div>

            <button type="button" onClick={handleExec} disabled={execSaving}
              className={cn('w-full py-4 rounded-xl text-sm font-bold transition-colors',
                execSaving ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-brand-green hover:bg-brand-green-dark text-white')}>
              {execSaving ? 'Zapisywanie…' : '✓ Wykonaj zadanie'}
            </button>
          </div>
        </div>
      )}

      {/* ─── BULK CONFIRM MODAL ──────────────────────────────────── */}
      {bulkModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setBulkModal(false) }}
        >
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold text-gray-900">Zbiorcze wykonanie</p>
                <p className="text-xs text-gray-500 mt-0.5">{selectedIds.size} {selectedIds.size === 1 ? 'zadanie' : 'zadania/zadań'} zostanie oznaczonych jako wykonane</p>
              </div>
              <button type="button" onClick={() => setBulkModal(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <X size={18} />
              </button>
            </div>

            {/* Worker picker */}
            <div>
              <label className="label">Kto wykonał? <span className="text-gray-400 font-normal">(opcjonalne)</span></label>
              {medicalWorkers.length > 0 && !bulkWorkerManual ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    {medicalWorkers.map(w => (
                      <button key={w} type="button" onClick={() => setBulkWorker(w)}
                        className={cn(
                          'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                          bulkWorker === w
                            ? 'bg-brand-green text-white border-brand-green'
                            : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                        )}>
                        {w}
                      </button>
                    ))}
                  </div>
                  <button type="button"
                    onClick={() => { setBulkWorkerManual(true); setBulkWorker('') }}
                    className="mt-2 text-xs text-gray-400 hover:text-brand-navy transition-colors">
                    + Wpisz inną osobę
                  </button>
                </>
              ) : (
                <div className="flex gap-2">
                  <input className="input flex-1 text-sm" placeholder="Imię i nazwisko pracownika"
                    value={bulkWorker} onChange={e => setBulkWorker(e.target.value)}
                    autoFocus={bulkWorkerManual} />
                  {medicalWorkers.length > 0 && (
                    <button type="button"
                      onClick={() => {
                        setBulkWorkerManual(false)
                        const saved = localStorage.getItem('cleaning_last_worker') ?? ''
                        setBulkWorker(medicalWorkers.includes(saved) ? saved : '')
                      }}
                      className="px-3 py-2 border border-gray-200 rounded-xl text-xs text-gray-600 hover:bg-gray-50 whitespace-nowrap">
                      Wybierz z listy
                    </button>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="label">Uwagi <span className="text-gray-400 font-normal">(opcjonalne — wspólne dla wszystkich)</span></label>
              <input className="input text-sm" placeholder="Dodatkowe informacje…"
                value={bulkNotes} onChange={e => setBulkNotes(e.target.value)} />
            </div>

            <button type="button" onClick={handleBulkExec} disabled={bulkSaving}
              className={cn('w-full py-4 rounded-xl text-sm font-bold transition-colors',
                bulkSaving ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-brand-green hover:bg-brand-green-dark text-white')}>
              {bulkSaving ? 'Zapisywanie…' : `✓ Wykonaj ${selectedIds.size} zadania/zadań`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
