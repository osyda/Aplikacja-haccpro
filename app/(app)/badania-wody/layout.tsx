import { PermissionGate } from '@/components/permission-gate'

export default function BadaniaWodyLayout({ children }: { children: React.ReactNode }) {
  return <PermissionGate permission="water_tests">{children}</PermissionGate>
}
