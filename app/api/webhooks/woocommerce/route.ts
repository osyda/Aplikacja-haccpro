import { createHmac, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyOrgToken } from '@/lib/billing'
import { WOO_SKU_TO_PLAN, type PlanId } from '@/lib/plans'

const PLAN_RANK: Record<PlanId, number> = { trial: 0, start: 1, pro: 2, multi: 3, enterprise: 4 }

// Order/subscription statuses that should not (yet) grant or refresh a plan —
// recorded for visibility, but downgrade/enforcement is handled separately.
const INACTIVE_STATUSES = new Set([
  'cancelled', 'expired', 'on-hold', 'pending-cancel', 'trash', 'refunded', 'failed',
])

interface WooLineItem { sku?: string }
interface WooMeta { key?: string; value?: unknown }
interface WooPayload {
  id?: number
  status?: string
  customer_id?: number
  billing?: { email?: string }
  line_items?: WooLineItem[]
  meta_data?: WooMeta[]
}

function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.WOOCOMMERCE_WEBHOOK_SECRET
  if (!secret || !signature) return false
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64')
  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * Receives order/subscription webhooks from WooCommerce on haccpro.pl and
 * applies the purchased HACCPro plan to the matching organization.
 *
 * Resolution order:
 *  1. `_haccpro_ref` order meta — a signed token identifying the org
 *     directly (set when an already-registered owner clicks "Zmień plan").
 *  2. billing e-mail — matched against an owner/manager profile.
 *  3. neither matches (brand-new customer) — recorded in
 *     pending_plan_grants and applied by fn_handle_new_user at registration.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-wc-webhook-signature')
  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: WooPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // WooCommerce sends a test ping with no `id` when the webhook is activated.
  if (!payload.id) return NextResponse.json({ ok: true })

  const plans = (payload.line_items ?? [])
    .map((item) => WOO_SKU_TO_PLAN[item.sku ?? ''])
    .filter((p): p is PlanId => !!p)
  if (plans.length === 0) return NextResponse.json({ ok: true, ignored: 'no matching SKU' })

  // If an order contains several HACCPro plan products, apply the highest tier.
  const plan = plans.reduce((best, p) => (PLAN_RANK[p] > PLAN_RANK[best] ? p : best))

  const email = String(payload.billing?.email ?? '').toLowerCase().trim()
  const wooCustomerId = payload.customer_id ? String(payload.customer_id) : null
  // NOTE: must NOT be prefixed with `_` — WooCommerce's REST API/webhook
  // payload hides underscore-prefixed ("protected") order meta by default.
  const refValue = payload.meta_data?.find((m) => m.key === 'haccpro_ref')?.value
  const refToken = typeof refValue === 'string' ? refValue : undefined
  const inactive = !!payload.status && INACTIVE_STATUSES.has(payload.status)

  const admin = createAdminClient()

  let targetOrgId = refToken ? verifyOrgToken(refToken) : null

  if (!targetOrgId && email) {
    const { data: ownerProfile } = await admin
      .from('profiles')
      .select('org_id')
      .ilike('email', email)
      .in('role', ['owner', 'manager'])
      .limit(1)
      .maybeSingle()
    targetOrgId = (ownerProfile as { org_id?: string } | null)?.org_id ?? null
  }

  if (targetOrgId) {
    const update: Record<string, unknown> = { woo_customer_id: wooCustomerId }
    if (inactive) {
      update.subscription_status = payload.status
    } else {
      update.plan = plan
      update.is_active = true
      update.subscription_status = 'active'
    }
    const { error } = await admin.from('organizations').update(update).eq('id', targetOrgId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, org_id: targetOrgId })
  }

  // No matching organisation yet — store for fn_handle_new_user to apply at signup.
  if (!email || inactive) return NextResponse.json({ ok: true })

  const { error } = await admin.from('pending_plan_grants').insert({
    email,
    plan,
    woo_order_id: String(payload.id),
    woo_customer_id: wooCustomerId,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, pending: true })
}
