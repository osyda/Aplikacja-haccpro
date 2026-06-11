import { PermissionGate } from '@/components/permission-gate'

export default function DostawyLayout({ children }: { children: React.ReactNode }) {
  return <PermissionGate permission="deliveries">{children}</PermissionGate>
}
