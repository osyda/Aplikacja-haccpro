import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { isOwnerRole } from '@/lib/permissions'
import { buildSignedUrlMap } from '@/lib/storage'
import { DeliveryList, type DeliveryLog } from './delivery-list'

export default async function DostawyPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('location_id, role')
    .eq('id', user!.id)
    .single()

  const locationId = profile?.location_id ?? ''
  const isOwner = isOwnerRole(profile?.role)

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

  const rawLogs: DeliveryLog[] = logsRes.data ?? []
  const photoRefs = rawLogs.flatMap((l) => [l.photo_url, ...(l.photo_urls ?? [])])
  const signedMap = await buildSignedUrlMap(supabase, 'delivery-photos', photoRefs)
  const logs = rawLogs.map((l) => ({
    ...l,
    photo_url: l.photo_url ? signedMap.get(l.photo_url) ?? l.photo_url : null,
    photo_urls: l.photo_urls ? l.photo_urls.map((u) => signedMap.get(u) ?? u) : null,
  }))
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

      <DeliveryList logs={logs} suppMap={suppMap} usersMap={usersMap} isOwner={isOwner} />
    </div>
  )
}
