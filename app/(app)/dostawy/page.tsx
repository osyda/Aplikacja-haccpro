import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Truck, Plus, Paperclip, Thermometer } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

const CAT_MAP: Record<string, { label: string; cls: string }> = {
  mieso:    { label: 'Mięso świeże',    cls: 'text-red-700 bg-red-50' },
  drob:     { label: 'Drób',            cls: 'text-orange-700 bg-orange-50' },
  ryby:     { label: 'Ryby',            cls: 'text-blue-700 bg-blue-50' },
  wedliny:  { label: 'Wędliny',         cls: 'text-rose-700 bg-rose-50' },
  nabiał:   { label: 'Nabiał',          cls: 'text-yellow-700 bg-yellow-50' },
  mrozonki: { label: 'Mrożonki',        cls: 'text-cyan-700 bg-cyan-50' },
  gotowe:   { label: 'Dania gotowe',    cls: 'text-purple-700 bg-purple-50' },
  warzywa:  { label: 'Warzywa i owoce', cls: 'text-green-700 bg-green-50' },
  suche:    { label: 'Produkty suche',  cls: 'text-amber-700 bg-amber-50' },
  pieczywo: { label: 'Pieczywo',        cls: 'text-amber-700 bg-amber-50' },
  napoje:   { label: 'Napoje',          cls: 'text-sky-700 bg-sky-50' },
  inne:     { label: 'Inne',            cls: 'text-gray-600 bg-gray-100' },
}

export default async function DostawyPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('location_id')
    .eq('id', user!.id)
    .single()

  const locationId = profile?.location_id ?? ''

  const [logsRes, suppliersRes] = await Promise.all([
    supabase
      .from('delivery_logs')
      .select('*')
      .eq('location_id', locationId)
      .order('received_at', { ascending: false })
      .limit(50),
    supabase
      .from('location_suppliers')
      .select('alias, full_name, nip')
      .eq('location_id', locationId),
  ])

  const logs = logsRes.data ?? []
  const suppMap = Object.fromEntries((suppliersRes.data ?? []).map(s => [s.alias, s]))

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

      {logs.length > 0 ? (
        <div className="card">
          <div className="divide-y divide-gray-50">
            {logs.map((log) => {
              const supp = suppMap[log.supplier]
              const cats: string[] = Array.isArray(log.categories) ? log.categories : (log.category ? [log.category] : [])
              return (
                <div key={log.id} className="py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Product + quality + categories */}
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-medium text-sm text-gray-900">{log.product}</p>
                        <Badge variant={log.quality_ok ? 'ok' : 'error'}>
                          {log.quality_ok ? 'OK' : 'Niezgodna'}
                        </Badge>
                      </div>
                      {cats.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-1">
                          {cats.map(c => {
                            const cat = CAT_MAP[c]
                            return cat ? (
                              <span key={c} className={`text-xs px-2 py-0.5 rounded-full font-medium ${cat.cls}`}>
                                {cat.label}
                              </span>
                            ) : null
                          })}
                        </div>
                      )}
                      {/* Supplier */}
                      <div className="mb-0.5">
                        <p className="text-xs text-gray-700 font-medium">{log.supplier}</p>
                        {supp?.full_name && (
                          <p className="text-xs text-gray-400">{supp.full_name}{supp.nip ? ` · NIP: ${supp.nip}` : ''}</p>
                        )}
                      </div>
                      {/* Details row */}
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                        {log.quantity && (
                          <p className="text-xs text-gray-500">Ilość: <span className="text-gray-700">{log.quantity}</span></p>
                        )}
                        {log.temp_at_delivery !== null && (
                          <p className="text-xs text-gray-500 flex items-center gap-0.5">
                            <Thermometer size={10} />
                            <span className="font-mono text-gray-700">{log.temp_at_delivery}°C</span>
                          </p>
                        )}
                        {log.expiry_date && (
                          <p className="text-xs text-gray-500">Termin: <span className="text-gray-700">{log.expiry_date}</span></p>
                        )}
                      </div>
                      {log.notes && <p className="text-xs text-gray-400 mt-0.5">{log.notes}</p>}
                      {log.photo_url && (
                        <a href={log.photo_url} target="_blank" rel="noreferrer"
                          className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-0.5">
                          <Paperclip size={10} /> Dokument
                        </a>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 whitespace-nowrap">{formatDateTime(log.received_at)}</p>
                  </div>
                </div>
              )
            })}
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
