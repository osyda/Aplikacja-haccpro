import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { resolvePermissions, type AppPermissions } from '@/lib/permissions'

/** Current user's profile, memoized per request (deduplicates repeated calls across layouts/pages). */
export const getCurrentProfile = cache(async () => {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('location_id, org_id, role, permissions, full_name, locations(name)')
    .eq('id', user.id)
    .single()

  return { user, profile }
})

/** Current user's resolved module permissions, memoized per request. */
export const getCurrentPermissions = cache(async (): Promise<AppPermissions> => {
  const result = await getCurrentProfile()
  return resolvePermissions(
    result?.profile?.role,
    result?.profile?.permissions as Partial<AppPermissions> | null,
  )
})
