import { createClient } from '@/lib/supabase/server'
import { Clock, ArrowRight } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'

const TABLE_LABELS: Record<string, string> = {
  temperature_logs: 'Temperatura',
  delivery_logs: 'Dostawa',
  cleaning_logs: 'Mycie',
  training_logs: 'Szkolenie',
  nonconformities: 'Niezgodność',
  ddd_logs: 'Kontrola DDD',
  locations: 'Lokal',
  profiles: 'Użytkownik',
}

const ACTION_STYLES: Record<string, string> = {
  INSERT: 'bg-green-100 text-green-700',
  UPDATE: 'bg-blue-100 text-blue-700',
  DELETE: 'bg-red-100 text-red-700',
}

export default async function HistoriaPage() {
  const supabase = createClient()

  const { data: logs } = await supabase
    .from('audit_log')
    .select('*')
    .order('changed_at', { ascending: false })
    .limit(100)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Historia zmian</h1>
        <p className="text-sm text-gray-500 mt-0.5">Kompletny audit log wszystkich operacji w systemie</p>
      </div>

      {logs && logs.length > 0 ? (
        <div className="card">
          <div className="divide-y divide-gray-50">
            {logs.map((log) => (
              <div key={log.id} className="py-3 flex items-start gap-3">
                <div className={`shrink-0 px-2 py-0.5 rounded text-xs font-medium font-mono ${ACTION_STYLES[log.action] ?? 'bg-gray-100 text-gray-600'}`}>
                  {log.action}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">
                    <span className="font-medium">{TABLE_LABELS[log.table_name] ?? log.table_name}</span>
                    <span className="text-gray-400 text-xs ml-2">#{log.record_id.slice(0, 8)}</span>
                  </p>
                  {log.action === 'UPDATE' && log.old_data && log.new_data && (
                    <div className="mt-1 text-xs text-gray-500 flex items-center gap-1">
                      <span className="text-red-500 truncate max-w-xs">
                        {JSON.stringify(log.old_data).slice(0, 60)}
                      </span>
                      <ArrowRight size={10} className="shrink-0" />
                      <span className="text-green-600 truncate max-w-xs">
                        {JSON.stringify(log.new_data).slice(0, 60)}
                      </span>
                    </div>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(log.changed_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="card border-dashed border-2 border-gray-200 text-center py-12">
          <Clock size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">Brak wpisów w historii zmian.</p>
          <p className="text-xs text-gray-400 mt-1">Wpisy pojawiają się automatycznie po dodaniu danych.</p>
        </div>
      )}
    </div>
  )
}
