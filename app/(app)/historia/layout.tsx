import { PermissionGate } from '@/components/permission-gate'

export default function HistoriaLayout({ children }: { children: React.ReactNode }) {
  return <PermissionGate permission="history">{children}</PermissionGate>
}
