import { createClient } from '@/lib/supabase/server'
import { Clock } from 'lucide-react'
import { formatDateTime, cn } from '@/lib/utils'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { Badge } from '@/components/ui/badge'
import { formatAuditEntry, AUDIT_MODULE_OPTIONS } from '@/lib/audit-log-format'
import { HistoryFilters } from './history-filters'
import type { AuditLog } from '@/types/database'

interface PageProps {
  searchParams: { action?: string; table?: string }
}

const ACTION_BADGE_VARIANT: Record<AuditLog['action'], 'ok' | 'warn' | 'error'> = {
  INSERT: 'ok',
  UPDATE: 'warn',
  DELETE: 'error',
}

const ACTION_LABEL: Record<AuditLog['action'], string> = {
  INSERT: 'Dodano',
  UPDATE: 'Zmieniono',
  DELETE: 'Usunięto',
}

export default async function HistoriaPage({ searchParams }: PageProps) {
  const supabase = createClient()

  let query = supabase.from('audit_log').select('*').order('changed_at', { ascending: false }).limit(100)
  if (searchParams.action && ['INSERT', 'UPDATE', 'DELETE'].includes(searchParams.action)) {
    query = query.eq('action', searchParams.action)
  }
  if (searchParams.table) {
    query = query.eq('table_name', searchParams.table)
  }
  const { data: logs } = await query

  const actorIds = Array.from(new Set((logs ?? []).map(l => l.changed_by).filter(Boolean) as string[]))
  const { data: actors } = actorIds.length > 0
    ? await supabase.from('profiles').select('id, full_name').in('id', actorIds)
    : { data: [] }
  const actorMap: Record<string, string> = Object.fromEntries(
    (actors ?? []).map((a: { id: string; full_name: string | null }) => [a.id, a.full_name ?? 'Nieznany użytkownik'])
  )

  return (
    <div className="space-y-5">
      <PageHeader title="Historia zmian" subtitle="Kompletny rejestr operacji w systemie" />

      <HistoryFilters moduleOptions={AUDIT_MODULE_OPTIONS} />

      {logs && logs.length > 0 ? (
        <div className="card">
          <div className="divide-y divide-gray-50">
            {logs.map(log => {
              const action = log.action as AuditLog['action']
              const actorName = log.changed_by ? actorMap[log.changed_by] ?? 'Nieznany użytkownik' : 'System'
              const { sentence } = formatAuditEntry({ ...log, action }, actorName)
              const hasDiff = action === 'UPDATE' && log.old_data && log.new_data
              return (
                <div key={log.id} className="py-3">
                  <div className="flex items-start gap-3">
                    <Badge variant={ACTION_BADGE_VARIANT[action]} className="shrink-0 mt-0.5 font-semibold">
                      {ACTION_LABEL[action]}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">{sentence}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(log.changed_at)}</p>
                    </div>
                  </div>

                  {(log.old_data || log.new_data) && (
                    <details className="mt-2 ml-[3.25rem] group">
                      <summary className="text-xs text-gray-400 hover:text-brand-navy cursor-pointer select-none transition-colors">
                        Szczegóły techniczne
                      </summary>
                      <div className="mt-2 space-y-1.5 text-xs font-mono">
                        {hasDiff ? (
                          <>
                            <p className={cn('rounded-lg px-2.5 py-1.5 bg-red-50 text-red-700 break-all')}>
                              {JSON.stringify(log.old_data)}
                            </p>
                            <p className={cn('rounded-lg px-2.5 py-1.5 bg-green-50 text-green-700 break-all')}>
                              {JSON.stringify(log.new_data)}
                            </p>
                          </>
                        ) : (
                          <p className="rounded-lg px-2.5 py-1.5 bg-gray-50 text-gray-600 break-all">
                            {JSON.stringify(action === 'DELETE' ? log.old_data : log.new_data)}
                          </p>
                        )}
                        <p className="text-gray-400">#{log.record_id.slice(0, 8)} · {log.table_name}</p>
                      </div>
                    </details>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <EmptyState
          icon={Clock}
          title="Brak wpisów w historii zmian"
          description="Wpisy pojawiają się automatycznie po dodaniu danych."
        />
      )}
    </div>
  )
}
