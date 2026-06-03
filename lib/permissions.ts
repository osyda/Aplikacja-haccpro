export type PermissionKey =
  | 'temperatures'
  | 'deliveries'
  | 'cleaning'
  | 'nonconformities'
  | 'training'
  | 'certificates'
  | 'ddd'
  | 'allergens'
  | 'reports'
  | 'history'
  | 'settings'
  | 'temperatures_manage_devices'
  | 'cleaning_manage_areas'

export type AppPermissions = Record<PermissionKey, boolean>

export const OWNER_PERMISSIONS: AppPermissions = {
  temperatures: true,
  deliveries: true,
  cleaning: true,
  nonconformities: true,
  training: true,
  certificates: true,
  ddd: true,
  allergens: true,
  reports: true,
  history: true,
  settings: true,
  temperatures_manage_devices: true,
  cleaning_manage_areas: true,
}

export const DEFAULT_STAFF_PERMISSIONS: AppPermissions = {
  temperatures: true,
  deliveries: true,
  cleaning: true,
  nonconformities: true,
  training: false,
  certificates: false,
  ddd: false,
  allergens: false,
  reports: false,
  history: false,
  settings: false,
  temperatures_manage_devices: false,
  cleaning_manage_areas: false,
}

export function resolvePermissions(
  role: string | null | undefined,
  stored: Partial<AppPermissions> | null | undefined,
): AppPermissions {
  if (!role || role === 'owner' || role === 'manager') return OWNER_PERMISSIONS
  return { ...DEFAULT_STAFF_PERMISSIONS, ...(stored ?? {}) }
}

export function isOwnerRole(role: string | null | undefined): boolean {
  return role === 'owner' || role === 'manager'
}
