import { PermissionGate } from '@/components/permission-gate'

export default function NiezgodnosciLayout({ children }: { children: React.ReactNode }) {
  return <PermissionGate permission="nonconformities">{children}</PermissionGate>
}
