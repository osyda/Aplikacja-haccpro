import type { PermissionKey, AppPermissions } from './permissions'

// ============================================================
// Single source of truth for HACCPro pricing plans.
//
// A plan controls WHICH MODULES an organisation may use (on top of the
// per-user `permissions` set) plus soft limits (locations / staff / AI scans).
//
// IMPORTANT — existing accounts are never broken:
//   - `grandfathered` orgs always get full access (set true for every org that
//     existed before plan-gating was introduced — see migration 027).
//   - orgs on `trial` always get full access (the 14-day free trial shows the
//     whole product). Trial expiry is handled by the admin, not by a hard lock,
//     until the payment flow is wired in.
// Only an org explicitly placed on a paid tier (start/pro/multi) by the admin
// (or, later, by the payment webhook) is actually gated.
// ============================================================

export type PlanId = 'trial' | 'start' | 'pro' | 'multi' | 'enterprise'

// Full module list (mirrors PermissionKey union in lib/permissions.ts).
export const ALL_MODULES: PermissionKey[] = [
  'temperatures',
  'temperatures_manage_devices',
  'deliveries',
  'cleaning',
  'cleaning_manage_areas',
  'nonconformities',
  'allergens',
  'history',
  'settings',
  'oil_collection',
  'water_tests',
  'waste',
  'training',
  'certificates',
  'ddd',
  'reports',
]

// Core HACCP / GHP / GMP daily-record modules — legally required for every
// food business, so they are included in the cheapest paid plan.
const START_MODULES: PermissionKey[] = [
  'temperatures',
  'temperatures_manage_devices',
  'deliveries',
  'cleaning',
  'cleaning_manage_areas',
  'nonconformities',
  'allergens',
  'history',
  'settings',
]

export interface PlanDefinition {
  id: PlanId
  name: string
  /** Monthly price in PLN. null = indywidualna wycena. */
  priceMonthly: number | null
  priceUnit: 'flat' | 'per_location'
  tagline: string
  modules: PermissionKey[]
  maxLocations: number
  maxStaff: number
  aiScansPerMonth: number
  push: boolean
  highlights: string[]
  /** Whether the tier appears on the public pricing table. */
  isPublic: boolean
}

export const PLAN_DEFINITIONS: Record<PlanId, PlanDefinition> = {
  trial: {
    id: 'trial',
    name: 'Trial',
    priceMonthly: 0,
    priceUnit: 'flat',
    tagline: '14 dni pełnego dostępu, bez karty kredytowej',
    modules: ALL_MODULES,
    maxLocations: Infinity,
    maxStaff: Infinity,
    aiScansPerMonth: Infinity,
    push: true,
    highlights: ['Wszystkie moduły', 'Skanowanie AI', 'Raporty PDF', 'Bez zobowiązań'],
    isPublic: false,
  },
  start: {
    id: 'start',
    name: 'Start',
    priceMonthly: 89,
    priceUnit: 'flat',
    tagline: 'Cyfrowe rejestry HACCP, GHP i GMP dla jednego lokalu',
    modules: START_MODULES,
    maxLocations: 1,
    maxStaff: 5,
    aiScansPerMonth: 0,
    push: false,
    highlights: [
      'HACCP + GHP + GMP w komplecie',
      'Temperatury, dostawy, mycie, alergeny',
      'Niezgodności i historia zmian',
      '1 lokal, do 5 pracowników',
    ],
    isPublic: true,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceMonthly: 179,
    priceUnit: 'flat',
    tagline: 'Pełna zgodność z automatyzacją dla jednego lokalu',
    modules: ALL_MODULES,
    maxLocations: 1,
    maxStaff: Infinity,
    aiScansPerMonth: 30,
    push: true,
    highlights: [
      'Wszystko z planu Start',
      'Szkolenia, orzeczenia, DDD, olej, woda, odpady',
      'Raporty PDF i powiadomienia push',
      'Skanowanie dokumentów AI (30/mc)',
    ],
    isPublic: true,
  },
  multi: {
    id: 'multi',
    name: 'Multi',
    priceMonthly: 149,
    priceUnit: 'per_location',
    tagline: 'Dla sieci i franczyz — rozliczenie za każdy lokal',
    modules: ALL_MODULES,
    maxLocations: Infinity,
    maxStaff: Infinity,
    aiScansPerMonth: Infinity,
    push: true,
    highlights: [
      'Wszystko z planu Pro',
      'Wiele lokali z jednego konta',
      'Zbiorcze raporty dla wszystkich lokali',
      'Skanowanie AI bez limitu',
    ],
    isPublic: true,
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    priceMonthly: null,
    priceUnit: 'per_location',
    tagline: 'Duże sieci (10+ lokali) — wycena indywidualna',
    modules: ALL_MODULES,
    maxLocations: Infinity,
    maxStaff: Infinity,
    aiScansPerMonth: Infinity,
    push: true,
    highlights: [
      'Wszystko z planu Multi',
      'Dedykowany onboarding i wsparcie',
      'Integracje i indywidualne ustalenia',
    ],
    isPublic: true,
  },
}

export const PUBLIC_PLANS: PlanDefinition[] = (['start', 'pro', 'multi', 'enterprise'] as PlanId[])
  .map((id) => PLAN_DEFINITIONS[id])
  .filter((p) => p.isPublic)

// Maps WooCommerce product SKUs to plan IDs — used by
// /api/webhooks/woocommerce to translate a purchased product into a plan.
// Keep these in sync with the product SKUs configured in WooCommerce.
export const WOO_SKU_TO_PLAN: Partial<Record<string, PlanId>> = {
  'haccpro-app-start': 'start',
  'haccpro-app-pro': 'pro',
  'haccpro-app-multi': 'multi',
  'haccpro-app-enterprise': 'enterprise',
}

function normalizePlan(plan: string | null | undefined): PlanId {
  if (plan && plan in PLAN_DEFINITIONS) return plan as PlanId
  return 'trial'
}

export interface OrgPlanState {
  plan: string | null | undefined
  grandfathered: boolean | null | undefined
  trial_ends_at: string | null | undefined
}

export function getPlanDefinition(plan: string | null | undefined): PlanDefinition {
  return PLAN_DEFINITIONS[normalizePlan(plan)]
}

/**
 * Effective set of modules an organisation may use, taking grandfathering and
 * the trial period into account. Grandfathered orgs and trial orgs always get
 * the full module set.
 */
export function effectivePlanModules(org: OrgPlanState): Set<PermissionKey> {
  if (org.grandfathered) return new Set(ALL_MODULES)
  const planId = normalizePlan(org.plan)
  if (planId === 'trial') return new Set(ALL_MODULES)
  return new Set(PLAN_DEFINITIONS[planId].modules)
}

// Modules that must never be hidden — users always need to reach settings
// (e.g. to upgrade their plan).
const ALWAYS_ON: PermissionKey[] = ['settings']

/**
 * Intersect a user's resolved permissions with the modules unlocked by their
 * organisation's plan. A permission stays only if BOTH the user has it AND the
 * plan unlocks it.
 */
export function gatePermissionsByPlan(
  perms: AppPermissions,
  org: OrgPlanState,
): AppPermissions {
  const allowed = effectivePlanModules(org)
  const out = { ...perms }
  for (const key of ALL_MODULES) {
    if (ALWAYS_ON.includes(key)) continue
    if (!allowed.has(key)) out[key] = false
  }
  return out
}
