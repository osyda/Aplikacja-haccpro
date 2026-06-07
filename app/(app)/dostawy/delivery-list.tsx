'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Plus, Thermometer, Search, FileText, X,
  Calendar, CheckCircle2, XCircle, AlertTriangle,
  Fish, Snowflake, Leaf, Package, GlassWater, Beef,
  Milk, Wheat, Sandwich, UtensilsCrossed, Bird, Truck,
  ExternalLink,
} from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/ui/empty-state'

interface Supplier { alias: string; full_name: string | null; nip: string | null }

interface DeliveryLog {
  id: string
  product: string
  supplier: string
  categories: string[] | null
  category?: string | null
  quantity: string | null
  temp_at_delivery: number | null
  expiry_date: string | null
  quality_ok: boolean
  notes: string | null
  photo_url: string | null
  received_at: string
  recorded_by: string | null
}

interface Props {
  logs: DeliveryLog[]
  suppMap: Record<string, Supplier>
  usersMap: Record<string, string>
}

const CAT_META: Record<string, { label: string; color: string; bg: string; Icon: React.ElementType }> = {
  mieso:    { label: 'Mięso świeże',    color: 'text-red-700',    bg: 'bg-red-50',    Icon: Beef },
  drob:     { label: 'Drób i królik',   color: 'text-orange-700', bg: 'bg-orange-50', Icon: Bird },
  ryby:     { label: 'Ryby',            color: 'text-blue-700',   bg: 'bg-blue-50',   Icon: Fish },
  wedliny:  { label: 'Wędliny',         color: 'text-rose-700',   bg: 'bg-rose-50',   Icon: Sandwich },
  nabiał:   { label: 'Nabiał',          color: 'text-yellow-700', bg: 'bg-yellow-50', Icon: Milk },
  mrozonki: { label: 'Mrożonki',        color: 'text-cyan-700',   bg: 'bg-cyan-50',   Icon: Snowflake },
  gotowe:   { label: 'Dania gotowe',    color: 'text-purple-700', bg: 'bg-purple-50', Icon: UtensilsCrossed },
  warzywa:  { label: 'Warzywa i owoce', color: 'text-green-700',  bg: 'bg-green-50',  Icon: Leaf },
  suche:    { label: 'Produkty suche',  color: 'text-amber-700',  bg: 'bg-amber-50',  Icon: Package },
  pieczywo: { label: 'Pieczywo',        color: 'text-amber-800',  bg: 'bg-amber-50',  Icon: Wheat },
  napoje:   { label: 'Napoje',          color: 'text-sky-700',    bg: 'bg-sky-50',    Icon: GlassWater },
  inne:     { label: 'Inne',            color: 'text-gray-600',   bg: 'bg-gray-100',  Icon: FileText },
}

const TEMP_MAX: Record<string, number> = {
  mieso: 7, drob: 4, ryby: 4, wedliny: 7, nabiał: 8, gotowe: 4,
}

function getCats(log: DeliveryLog): string[] {
  if (Array.isArray(log.categories) && log.categories.length > 0) return log.categories
  if (log.category) return [log.category]
  return []
}

function isTempWarn(temp: number | null, cats: string[]): boolean {
  if (temp === null) return false
  if (cats.includes('mrozonki') && temp > -18) return true
  for (const cat of cats) {
    const max = TEMP_MAX[cat]
    if (max !== undefined && (temp < 0 || temp > max)) return true
  }
  return false
}

function needsAttention(log: DeliveryLog): boolean {
  if (!log.quality_ok) return true
  return isTempWarn(log.temp_at_delivery, getCats(log))
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr)
  const t = new Date()
  return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear()
}

type FilterType = 'all' | 'today' | 'ok' | 'nonconformant' | 'chilled' | 'frozen' | 'meat' | 'fish'

const FILTERS: { id: FilterType; label: string }[] = [
  { id: 'all', label: 'Wszystkie' },
  { id: 'today', label: 'Dzisiaj' },
  { id: 'ok', label: 'OK' },
  { id: 'nonconformant', label: 'Niezgodne' },
  { id: 'chilled', label: 'Chłodzone' },
  { id: 'frozen', label: 'Mrożonki' },
  { id: 'meat', label: 'Mięso' },
  { id: 'fish', label: 'Ryby' },
]

function matchesFilter(log: DeliveryLog, filter: FilterType): boolean {
  const cats = getCats(log)
  switch (filter) {
    case 'all': return true
    case 'today': return isToday(log.received_at)
    case 'ok': return log.quality_ok && !isTempWarn(log.temp_at_delivery, cats)
    case 'nonconformant': return !log.quality_ok
    case 'chilled': return cats.some(c => ['mieso', 'drob', 'ryby', 'nabiał', 'wedliny', 'gotowe'].includes(c))
    case 'frozen': return cats.includes('mrozonki')
    case 'meat': return cats.includes('mieso')
    case 'fish': return cats.includes('ryby')
  }
}

function matchesSearch(log: DeliveryLog, query: string, supp: Supplier | undefined): boolean {
  if (!query) return true
  const q = query.toLowerCase()
  const cats = getCats(log)
  const catLabels = cats.map(c => CAT_META[c]?.label ?? c).join(' ').toLowerCase()
  return (
    (log.product ?? '').toLowerCase().includes(q) ||
    (log.supplier ?? '').toLowerCase().includes(q) ||
    (supp?.full_name ?? '').toLowerCase().includes(q) ||
    catLabels.includes(q) ||
    (log.notes ?? '').toLowerCase().includes(q) ||
    log.received_at.includes(q)
  )
}

function CategoryIcon({ cats }: { cats: string[] }) {
  const primary = cats[0] ?? 'inne'
  const meta = CAT_META[primary] ?? CAT_META['inne']
  const { Icon, color, bg } = meta
  return (
    <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center shrink-0', bg)}>
      <Icon size={22} className={color} />
    </div>
  )
}

function StatusBadge({ log }: { log: DeliveryLog }) {
  const cats = getCats(log)
  const tempWarn = isTempWarn(log.temp_at_delivery, cats)
  if (!log.quality_ok) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 shrink-0">
        <XCircle size={11} />
        Niezgodna
      </span>
    )
  }
  if (tempWarn) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 shrink-0">
        <AlertTriangle size={11} />
        Uwaga
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 shrink-0">
      <CheckCircle2 size={11} />
      OK
    </span>
  )
}

function DetailModal({ log, supp, author, onClose }: { log: DeliveryLog; supp: Supplier | undefined; author?: string; onClose: () => void }) {
  const cats = getCats(log)
  const tempWarn = isTempWarn(log.temp_at_delivery, cats)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-3xl max-h-[92vh] overflow-y-auto shadow-2xl">
        {/* drag handle on mobile */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-gray-100 px-5 pt-3 pb-4 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-gray-900 text-base leading-tight">{log.product}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(log.received_at)}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <StatusBadge log={log} />
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Supplier */}
          <section>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Dostawca</p>
            <p className="text-sm font-semibold text-gray-900">{log.supplier}</p>
            {supp?.full_name && <p className="text-sm text-gray-600 mt-0.5">{supp.full_name}</p>}
            {supp?.nip && <p className="text-xs text-gray-400 mt-0.5">NIP: {supp.nip}</p>}
          </section>

          {/* Categories */}
          {cats.length > 0 && (
            <section>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Kategorie</p>
              <div className="flex flex-wrap gap-1.5">
                {cats.map(c => {
                  const m = CAT_META[c]
                  return m ? (
                    <span key={c} className={cn('text-xs px-2.5 py-1 rounded-full font-medium', m.color, m.bg)}>
                      {m.label}
                    </span>
                  ) : null
                })}
              </div>
            </section>
          )}

          {/* Details grid */}
          <section>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Szczegóły</p>
            <div className="grid grid-cols-2 gap-2.5">
              {log.quantity && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-[11px] text-gray-400 mb-1">Ilość</p>
                  <p className="text-sm font-semibold text-gray-900">{log.quantity}</p>
                </div>
              )}
              {log.temp_at_delivery !== null && (
                <div className={cn('rounded-xl p-3', tempWarn ? 'bg-orange-50' : 'bg-blue-50')}>
                  <p className={cn('text-[11px] mb-1', tempWarn ? 'text-orange-500' : 'text-blue-400')}>Temperatura</p>
                  <p className={cn('text-sm font-semibold font-mono flex items-center gap-1', tempWarn ? 'text-orange-700' : 'text-blue-700')}>
                    {log.temp_at_delivery}°C
                    {tempWarn && <AlertTriangle size={13} />}
                  </p>
                </div>
              )}
              {log.expiry_date && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-[11px] text-gray-400 mb-1">Data ważności</p>
                  <p className="text-sm font-semibold text-gray-900">{log.expiry_date}</p>
                </div>
              )}
              <div className={cn('rounded-xl p-3', log.quality_ok ? 'bg-green-50' : 'bg-red-50')}>
                <p className={cn('text-[11px] mb-1', log.quality_ok ? 'text-green-500' : 'text-red-400')}>Jakość</p>
                <p className={cn('text-sm font-semibold', log.quality_ok ? 'text-green-700' : 'text-red-700')}>
                  {log.quality_ok ? 'Zgodna' : 'Niezgodna'}
                </p>
              </div>
            </div>
          </section>

          {/* Author */}
          {author && (
            <section>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Zapisał/a</p>
              <p className="text-sm font-semibold text-gray-900">{author}</p>
            </section>
          )}

          {/* Notes */}
          {log.notes && (
            <section>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Uwagi / Dokument</p>
              <p className="text-sm text-gray-700 bg-gray-50 rounded-xl p-3 whitespace-pre-line leading-relaxed">
                {log.notes}
              </p>
            </section>
          )}

          {/* Attachment */}
          {log.photo_url && (
            <section>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Załącznik</p>
              <a
                href={log.photo_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-3 rounded-xl border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-colors text-sm text-gray-700 hover:text-purple-700 group"
              >
                <div className="p-1.5 rounded-lg bg-purple-100 group-hover:bg-purple-200 transition-colors">
                  <FileText size={14} className="text-purple-600" />
                </div>
                <span className="flex-1 font-medium">Podgląd dokumentu / zdjęcia</span>
                <ExternalLink size={14} className="text-gray-400 shrink-0" />
              </a>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

function DeliveryCard({ log, supp, author, onClick }: { log: DeliveryLog; supp: Supplier | undefined; author?: string; onClick: () => void }) {
  const cats = getCats(log)
  const tempWarn = isTempWarn(log.temp_at_delivery, cats)

  return (
    <div
      className="bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md hover:border-gray-200 transition-all cursor-pointer active:scale-[0.99] active:shadow-sm"
      onClick={onClick}
    >
      <div className="p-4">
        {/* Top: icon + name + status */}
        <div className="flex items-start gap-3">
          <CategoryIcon cats={cats} />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-0.5">
              <p className="font-semibold text-sm text-gray-900 leading-snug">{log.product}</p>
              <StatusBadge log={log} />
            </div>
            <p className="text-xs font-medium text-gray-600">{log.supplier}</p>
            {supp?.full_name && (
              <p className="text-xs text-gray-400 truncate">{supp.full_name}</p>
            )}
            {log.notes && (
              <p className="text-xs text-gray-400 truncate mt-0.5 italic">{log.notes.split('\n')[0]}</p>
            )}
          </div>
        </div>

        {/* Category badges */}
        {cats.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {cats.map(c => {
              const m = CAT_META[c]
              return m ? (
                <span key={c} className={cn('text-[11px] px-2 py-0.5 rounded-full font-medium', m.color, m.bg)}>
                  {m.label}
                </span>
              ) : null
            })}
          </div>
        )}

        {/* Details row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2.5 pt-2.5 border-t border-gray-50">
          {log.quantity && (
            <p className="text-xs text-gray-500">
              Ilość: <span className="text-gray-800 font-medium">{log.quantity}</span>
            </p>
          )}
          {log.temp_at_delivery !== null && (
            <p className={cn(
              'text-xs flex items-center gap-1 font-medium',
              tempWarn ? 'text-orange-600' : 'text-blue-600'
            )}>
              <Thermometer size={12} />
              <span className="font-mono">{log.temp_at_delivery}°C</span>
              {tempWarn && <AlertTriangle size={11} />}
            </p>
          )}
          {log.expiry_date && (
            <p className="text-xs text-gray-500">
              Termin: <span className="text-gray-800">{log.expiry_date}</span>
            </p>
          )}

          <div className="flex items-center gap-2 ml-auto">
            {author && <p className="text-xs text-gray-500 hidden sm:block">{author}</p>}
            <p className="text-xs text-gray-400">{formatDateTime(log.received_at)}</p>
            {log.photo_url && (
              <a
                href={log.photo_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                title="Podgląd dokumentu"
                className="p-1.5 rounded-lg border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-colors text-gray-400 hover:text-purple-600"
              >
                <Search size={14} />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export function DeliveryList({ logs, suppMap, usersMap }: Props) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [detail, setDetail] = useState<DeliveryLog | null>(null)

  const todayLogs = useMemo(() => logs.filter(l => isToday(l.received_at)), [logs])
  const todayOk = useMemo(() => todayLogs.filter(l => l.quality_ok && !isTempWarn(l.temp_at_delivery, getCats(l))).length, [todayLogs])
  const todayNonconf = useMemo(() => todayLogs.filter(l => !l.quality_ok).length, [todayLogs])
  const todayAttention = useMemo(() => todayLogs.filter(needsAttention).length, [todayLogs])

  const filtered = useMemo(() =>
    logs.filter(l => matchesFilter(l, filter) && matchesSearch(l, query, suppMap[l.supplier])),
    [logs, filter, query, suppMap]
  )

  const stats = [
    {
      label: 'Dzisiaj', value: todayLogs.length, Icon: Calendar,
      color: 'text-brand-navy', bg: 'bg-brand-navy/5', border: 'border-brand-navy/10',
    },
    {
      label: 'OK', value: todayOk, Icon: CheckCircle2,
      color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-100',
    },
    {
      label: 'Niezgodne', value: todayNonconf, Icon: XCircle,
      color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100',
    },
    {
      label: 'Uwaga', value: todayAttention, Icon: AlertTriangle,
      color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100',
    },
  ]

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map(({ label, value, Icon, color, bg, border }) => (
          <div key={label} className={cn('rounded-xl border p-3.5 flex items-center gap-3', bg, border)}>
            <div className={cn('p-2 rounded-lg bg-white/70 shadow-sm', color)}>
              <Icon size={17} />
            </div>
            <div>
              <p className="text-[11px] text-gray-500 font-medium leading-none">{label}</p>
              <p className={cn('text-2xl font-bold leading-tight mt-0.5', color)}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="space-y-2.5">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Szukaj produktu, dostawcy, faktury..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green transition-colors"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Filter chips */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                'shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                filter === f.id
                  ? 'bg-brand-navy text-white border-brand-navy shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map(log => (
            <DeliveryCard
              key={log.id}
              log={log}
              supp={suppMap[log.supplier]}
              author={log.recorded_by ? usersMap[log.recorded_by] : undefined}
              onClick={() => setDetail(log)}
            />
          ))}
          <p className="text-center text-xs text-gray-400 py-2">
            Wyświetlono {filtered.length} {filtered.length === 1 ? 'wpis' : filtered.length < 5 ? 'wpisy' : 'wpisów'}
          </p>
        </div>
      ) : (
        <EmptyState
          icon={Truck}
          title="Brak dostaw"
          description={query || filter !== 'all'
            ? 'Nie znaleziono dostaw spełniających kryteria.'
            : 'Nie dodano jeszcze żadnej dostawy dla tego lokalu.'}
          action={!query && filter === 'all' && (
            <Link href="/dostawy/nowa" className="btn-primary inline-flex items-center gap-2">
              <Plus size={14} />
              Dodaj pierwszą dostawę
            </Link>
          )}
        />
      )}

      {/* Detail modal */}
      {detail && (
        <DetailModal
          log={detail}
          supp={suppMap[detail.supplier]}
          author={detail.recorded_by ? usersMap[detail.recorded_by] : undefined}
          onClose={() => setDetail(null)}
        />
      )}
    </>
  )
}
