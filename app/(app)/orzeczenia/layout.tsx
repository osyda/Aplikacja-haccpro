import { PermissionGate } from '@/components/permission-gate'

export default function OrzeczeniaLayout({ children }: { children: React.ReactNode }) {
  return <PermissionGate permission="certificates">{children}</PermissionGate>
}
