import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { DeliveryList } from './delivery-list'

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
      .limit(100),
    supabase
      .from('location_suppliers')
      .select('alias, full_name, nip')
      .eq('location_id', locationId),
  ])

  const logs = logsRes.data ?? []
  const suppMap = Object.fromEntries((suppliersRes.data ?? []).map((s: { alias: string; full_name: string | null; nip: string | null }) => [s.alias, s]))

  const authorIds = Array.from(new Set(logs.map((l: { recorded_by: string | null }) => l.recorded_by).filter(Boolean) as string[]))
  const { data: authors } = authorIds.length > 0
    ? await supabase.from('profiles').select('id, full_name').in('id', authorIds)
    : { data: [] }
  const usersMap: Record<string, string> = Object.fromEntries((authors ?? []).map((a: { id: string; full_name: string | null }) => [a.id, a.full_name ?? '']))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Przyjęcie dostaw"
        subtitle="Rejestr przyjętych produktów i surowców"
        action={
          <Link href="/dostawy/nowa" className="btn-primary flex items-center gap-2">
            <Plus size={16} />
            Nowa dostawa
          </Link>
        }
      />

      <DeliveryList logs={logs} suppMap={suppMap} usersMap={usersMap} />
    </div>
  )
}
