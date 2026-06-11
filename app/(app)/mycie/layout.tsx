import { PermissionGate } from '@/components/permission-gate'

export default function MycieLayout({ children }: { children: React.ReactNode }) {
  return <PermissionGate permission="cleaning">{children}</PermissionGate>
}
