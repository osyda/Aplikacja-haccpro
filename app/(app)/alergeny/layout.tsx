import { PermissionGate } from '@/components/permission-gate'

export default function AlergenyLayout({ children }: { children: React.ReactNode }) {
  return <PermissionGate permission="allergens">{children}</PermissionGate>
}
