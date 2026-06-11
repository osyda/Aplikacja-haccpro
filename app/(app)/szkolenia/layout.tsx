import { PermissionGate } from '@/components/permission-gate'

export default function SzkoleniaLayout({ children }: { children: React.ReactNode }) {
  return <PermissionGate permission="training">{children}</PermissionGate>
}
