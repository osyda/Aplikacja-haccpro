import { PermissionGate } from '@/components/permission-gate'

export default function OlejLayout({ children }: { children: React.ReactNode }) {
  return <PermissionGate permission="oil_collection">{children}</PermissionGate>
}
