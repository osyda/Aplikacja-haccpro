import { PermissionGate } from '@/components/permission-gate'

export default function TemperaturyLayout({ children }: { children: React.ReactNode }) {
  return <PermissionGate permission="temperatures">{children}</PermissionGate>
}
