import webpush from 'web-push'

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY

if (PUBLIC_KEY && PRIVATE_KEY) {
  webpush.setVapidDetails('mailto:powiadomienia@haccpro.pl', PUBLIC_KEY, PRIVATE_KEY)
}

export interface PushPayload {
  title: string
  body: string
  url?: string
}

export interface PushSubscriptionRow {
  endpoint: string
  p256dh: string
  auth_key: string
}

/** Sends a push notification to each subscription. Returns endpoints that are
 * no longer valid (404/410) so the caller can delete them from the database. */
export async function sendPushToSubscriptions(subs: PushSubscriptionRow[], payload: PushPayload): Promise<string[]> {
  if (!PUBLIC_KEY || !PRIVATE_KEY || subs.length === 0) return []

  const deadEndpoints: string[] = []
  await Promise.all(subs.map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
        JSON.stringify(payload)
      )
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode
      if (statusCode === 404 || statusCode === 410) deadEndpoints.push(sub.endpoint)
    }
  }))
  return deadEndpoints
}
