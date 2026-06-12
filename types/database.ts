export type UserRole = 'owner' | 'manager' | 'staff'
export type NonconformityStatus = 'open' | 'resolved'
export type PlanType = 'trial' | 'start' | 'pro' | 'multi' | 'enterprise'

export interface Organization {
  id: string
  name: string
  plan: PlanType
  nip: string
  address_street: string
  address_building_no: string
  address_unit_no: string
  address_postal_code: string
  address_city: string
  created_at: string
}

export interface Location {
  id: string
  org_id: string
  name: string
  address: string
  postal_code: string
  type: string
  city: string
  created_at: string
}

export interface Profile {
  id: string
  org_id: string
  location_id: string | null
  email: string
  full_name: string
  role: UserRole
  created_at: string
}

export interface TemperatureLog {
  id: string
  location_id: string
  device_name: string
  temperature: number
  min_ok: number
  max_ok: number
  measured_at: string
  recorded_by: string
  notes: string | null
}

export interface DeliveryLog {
  id: string
  location_id: string
  supplier: string
  product: string
  quantity: string
  temp_at_delivery: number | null
  expiry_date: string | null
  quality_ok: boolean
  photo_url: string | null
  received_at: string
  recorded_by: string
  notes: string | null
}

export interface CleaningLog {
  id: string
  location_id: string
  area: string
  agent: string
  concentration: string | null
  cleaned_at: string
  recorded_by: string
  notes: string | null
}

export interface TrainingLog {
  id: string
  location_id: string
  topic: string
  trainer: string
  trained_at: string
  attendees: string[]
  notes: string | null
}

export interface Nonconformity {
  id: string
  location_id: string
  description: string
  corrective_action: string | null
  status: NonconformityStatus
  reported_by: string
  resolved_at: string | null
  created_at: string
}

export interface DddLog {
  id: string
  location_id: string
  area: string
  result: string
  action_taken: string | null
  inspected_at: string
  inspector: string
  notes: string | null
}

export interface AuditLog {
  id: string
  table_name: string
  record_id: string
  action: 'INSERT' | 'UPDATE' | 'DELETE'
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  changed_by: string | null
  changed_at: string
  location_id: string | null
}

export interface GeneratedReport {
  id: string
  location_id: string
  modules: string[]
  period_month: number
  period_year: number
  file_path: string
  generated_by: string | null
  generated_at: string
}

type TableDef<R, I = Partial<R>, U = Partial<R>> = {
  Row: R
  Insert: I
  Update: U
  Relationships: []
}

export type Database = {
  public: {
    Tables: {
      organizations: TableDef<Organization>
      locations: TableDef<Location>
      profiles: TableDef<Profile>
      temperature_logs: TableDef<TemperatureLog>
      delivery_logs: TableDef<DeliveryLog>
      cleaning_logs: TableDef<CleaningLog>
      training_logs: TableDef<TrainingLog>
      nonconformities: TableDef<Nonconformity>
      ddd_logs: TableDef<DddLog>
      audit_log: TableDef<AuditLog>
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
