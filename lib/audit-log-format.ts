import type { AuditLog } from '@/types/database'

type AuditAction = AuditLog['action']
type AuditData = Record<string, unknown> | null

interface ModuleConfig {
  label: string
  verbs: Record<AuditAction, string>
  describe: (data: AuditData) => string | null
}

function strField(data: AuditData, key: string): string | undefined {
  const v = data?.[key]
  if (typeof v === 'string') return v.trim() || undefined
  if (typeof v === 'number') return String(v)
  return undefined
}

function joinParts(parts: (string | undefined)[]): string | null {
  const filtered = parts.filter((p): p is string => !!p)
  return filtered.length > 0 ? filtered.join(' · ') : null
}

const MODULES: Record<string, ModuleConfig> = {
  temperature_logs: {
    label: 'Temperatura',
    verbs: {
      INSERT: 'dodał(a) odczyt temperatury',
      UPDATE: 'poprawił(a) odczyt temperatury',
      DELETE: 'usunął(ęła) odczyt temperatury',
    },
    describe: d => {
      const name = strField(d, 'device_name')
      const temp = strField(d, 'temperature')
      if (!name && !temp) return null
      return `${name ?? '—'}${temp ? ` (${temp}°C)` : ''}`
    },
  },
  delivery_logs: {
    label: 'Dostawa',
    verbs: {
      INSERT: 'zarejestrował(a) dostawę',
      UPDATE: 'poprawił(a) wpis dostawy',
      DELETE: 'usunął(ęła) wpis dostawy',
    },
    describe: d => joinParts([strField(d, 'supplier'), strField(d, 'product')]),
  },
  cleaning_logs: {
    label: 'Mycie',
    verbs: {
      INSERT: 'dodał(a) wpis mycia',
      UPDATE: 'poprawił(a) wpis mycia',
      DELETE: 'usunął(ęła) wpis mycia',
    },
    describe: d => joinParts([strField(d, 'area'), strField(d, 'agent')]),
  },
  training_logs: {
    label: 'Szkolenie',
    verbs: {
      INSERT: 'dodał(a) wpis szkolenia',
      UPDATE: 'poprawił(a) wpis szkolenia',
      DELETE: 'usunął(ęła) wpis szkolenia',
    },
    describe: d => joinParts([strField(d, 'topic'), strField(d, 'trainer')]),
  },
  nonconformities: {
    label: 'Niezgodność',
    verbs: {
      INSERT: 'zgłosił(a) niezgodność',
      UPDATE: 'zaktualizował(a) niezgodność',
      DELETE: 'usunął(ęła) niezgodność',
    },
    describe: d => {
      const desc = strField(d, 'description')
      if (!desc) return null
      return desc.length > 80 ? `${desc.slice(0, 80)}…` : desc
    },
  },
  ddd_logs: {
    label: 'Kontrola DDD',
    verbs: {
      INSERT: 'dodał(a) wpis kontroli DDD',
      UPDATE: 'poprawił(a) wpis kontroli DDD',
      DELETE: 'usunął(ęła) wpis kontroli DDD',
    },
    describe: d => joinParts([strField(d, 'area'), strField(d, 'result')]),
  },
  locations: {
    label: 'Lokal',
    verbs: {
      INSERT: 'dodał(a) lokal',
      UPDATE: 'zmienił(a) dane lokalu',
      DELETE: 'usunął(ęła) lokal',
    },
    describe: d => strField(d, 'name') ?? null,
  },
  profiles: {
    label: 'Użytkownik',
    verbs: {
      INSERT: 'dodał(a) użytkownika',
      UPDATE: 'zmienił(a) dane użytkownika',
      DELETE: 'usunął(ęła) użytkownika',
    },
    describe: d => strField(d, 'full_name') ?? strField(d, 'email') ?? null,
  },
}

const DEFAULT_VERBS: Record<AuditAction, string> = {
  INSERT: 'dodał(a) wpis',
  UPDATE: 'zaktualizował(a) wpis',
  DELETE: 'usunął(ęła) wpis',
}

export const AUDIT_MODULE_OPTIONS: { value: string; label: string }[] = Object.entries(MODULES)
  .map(([value, cfg]) => ({ value, label: cfg.label }))

export function formatAuditEntry(
  log: Pick<AuditLog, 'table_name' | 'action' | 'old_data' | 'new_data'>,
  actorName: string
): { sentence: string; moduleLabel: string } {
  const config = MODULES[log.table_name]
  const moduleLabel = config?.label ?? log.table_name
  const verb = config?.verbs[log.action] ?? DEFAULT_VERBS[log.action]
  const referenceData = log.action === 'DELETE' ? log.old_data : log.new_data
  const subject = config?.describe(referenceData) ?? null

  const sentence = subject
    ? `${actorName} ${verb} — ${subject}`
    : `${actorName} ${verb} (${moduleLabel})`

  return { sentence, moduleLabel }
}
