import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Truck, Plus, CheckCircle2, XCircle } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

export default async function DostawyPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('location_id')
    .eq('id', user!.id)
    .single()

  const { data: logs } = await supabase
    .from('delivery_logs')
    .select('*')
    .eq('location_id', profile?.location_id ?? '')
    .order('received_at', { ascending: false })
    .limit(50)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Przyjęcie dostaw</h1>
          <p className="text-sm text-gray-500 mt-0.5">Rejestr przyjętych produktów i surowców</p>
        </div>
        <Link href="/dostawy/nowa" className="btn-primary flex items-center gap-2">
          <Plus size={16} />
          Nowa dostawa
        </Link>
      </div>

      {logs && logs.length > 0 ? (
        <div className="card">
          <div className="divide-y divide-gray-50">
            {logs.map((log) => (
              <div key={log.id} className="py-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm text-gray-900">{log.product}</p>
                      <Badge variant={log.quality_ok ? 'ok' : 'error'}>
                        {log.quality_ok ? 'OK' : 'Niezgodna'}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                      <p className="text-xs text-gray-500">Dostawca: <span className="text-gray-700">{log.supplier}</span></p>
                      <p className="text-xs text-gray-500">Ilość: <span className="text-gray-700">{log.quantity}</span></p>
                      {log.temp_at_delivery !== null && (
                        <p className="text-xs text-gray-500">Temp.: <span className="text-gray-700 font-mono">{log.temp_at_delivery}°C</span></p>
                      )}
                      {log.expiry_date && (
                        <p className="text-xs text-gray-500">Termin: <span className="text-gray-700">{log.expiry_date}</span></p>
                      )}
                    </div>
                    {log.notes && <p className="text-xs text-gray-400 mt-1">{log.notes}</p>}
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {log.photo_url && (
                      <a href={log.photo_url} target="_blank" rel="noreferrer" className="text-xs text-brand-green hover:underline">
                        Zdjęcie
                      </a>
                    )}
                    <p className="text-xs text-gray-400 whitespace-nowrap">{formatDateTime(log.received_at)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="card border-dashed border-2 border-gray-200 text-center py-12">
          <Truck size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 mb-4">Brak wpisów dostaw</p>
          <Link href="/dostawy/nowa" className="btn-primary inline-flex items-center gap-2">
            <Plus size={14} />
            Dodaj pierwszą dostawę
          </Link>
        </div>
      )}
    </div>
  )
}
