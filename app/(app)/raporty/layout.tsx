import { PermissionGate } from '@/components/permission-gate'

export default function RaportyLayout({ children }: { children: React.ReactNode }) {
  return <PermissionGate permission="reports">{children}</PermissionGate>
}
