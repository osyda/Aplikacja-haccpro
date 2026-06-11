import { PermissionGate } from '@/components/permission-gate'

export default function UstawieniaLayout({ children }: { children: React.ReactNode }) {
  return <PermissionGate permission="settings">{children}</PermissionGate>
}
