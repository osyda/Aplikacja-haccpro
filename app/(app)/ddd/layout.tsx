import { PermissionGate } from '@/components/permission-gate'

export default function DddLayout({ children }: { children: React.ReactNode }) {
  return <PermissionGate permission="ddd">{children}</PermissionGate>
}
