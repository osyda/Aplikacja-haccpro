import { createHmac, timingSafeEqual } from 'crypto'

const SECRET = process.env.BILLING_LINK_SECRET

/**
 * Signed, expiring token identifying an organization. Passed as the `ref`
 * query parameter to the haccpro.pl pricing page so that a WooCommerce
 * purchase can be linked back to this exact organization by
 * /api/webhooks/woocommerce — independent of which e-mail the purchase was
 * made with.
 *
 * Returns null if BILLING_LINK_SECRET isn't configured — callers fall back to
 * an unparameterized pricing link (matched by e-mail instead, see webhook).
 */
export function signOrgToken(orgId: string, validDays = 30): string | null {
  if (!SECRET) return null
  const exp = Math.floor(Date.now() / 1000) + validDays * 86400
  const payload = `${orgId}.${exp}`
  return `${payload}.${createHmac('sha256', SECRET).update(payload).digest('hex')}`
}

export function verifyOrgToken(token: string): string | null {
  if (!SECRET) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [orgId, expStr, sig] = parts
  const payload = `${orgId}.${expStr}`
  const expected = createHmac('sha256', SECRET).update(payload).digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(sig)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  const exp = Number(expStr)
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return null
  return orgId
}

export const HACCPRO_PRICING_URL = process.env.NEXT_PUBLIC_HACCPRO_PRICING_URL ?? 'https://haccpro.pl/cennik'
