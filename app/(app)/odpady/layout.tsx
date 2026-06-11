import { PermissionGate } from '@/components/permission-gate'

export default function OdpadyLayout({ children }: { children: React.ReactNode }) {
  return <PermissionGate permission="waste">{children}</PermissionGate>
}
