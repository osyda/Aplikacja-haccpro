import { ShieldAlert } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { getCurrentPermissions } from '@/lib/get-profile'
import type { PermissionKey } from '@/lib/permissions'

/** Server-side guard: renders children only if the current user has the given permission. */
export async function PermissionGate({ permission, children }: { permission: PermissionKey; children: React.ReactNode }) {
  const permissions = await getCurrentPermissions()

  if (!permissions[permission]) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Brak uprawnień"
        description="Skontaktuj się z przełożonym, aby uzyskać dostęp do tego modułu."
      />
    )
  }

  return <>{children}</>
}
