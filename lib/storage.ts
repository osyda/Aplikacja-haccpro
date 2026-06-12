import type { SupabaseClient } from '@supabase/supabase-js'

const SIGNED_URL_EXPIRY = 60 * 60 // 1 hour

/** Parse a getPublicUrl()-style URL into its storage bucket and object path. */
function parsePublicUrl(url: string): { bucket: string; path: string } | null {
  const marker = '/object/public/'
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  const rest = url.slice(idx + marker.length)
  const slash = rest.indexOf('/')
  if (slash === -1) return null
  return { bucket: rest.slice(0, slash), path: decodeURIComponent(rest.slice(slash + 1)) }
}

/**
 * Resolve stored file references — either getPublicUrl()-style URLs or bare storage
 * paths — to time-limited signed URLs, batched per bucket. `fallbackBucket` is used
 * for references that are bare paths (no embedded bucket).
 *
 * Returns a Map keyed by the original reference. Any reference that can't be resolved
 * (parse failure, RLS denial, etc.) maps to itself, so callers can fall back to the
 * original value without extra checks.
 */
export async function buildSignedUrlMap(
  supabase: SupabaseClient<any, any, any>,
  fallbackBucket: string,
  refs: (string | null | undefined)[],
  expiresIn = SIGNED_URL_EXPIRY
): Promise<Map<string, string>> {
  const unique = Array.from(new Set(refs.filter((r): r is string => !!r)))
  const map = new Map<string, string>()
  if (unique.length === 0) return map

  const byBucket = new Map<string, { ref: string; path: string }[]>()
  for (const ref of unique) {
    const parsed = parsePublicUrl(ref)
    const bucket = parsed?.bucket ?? fallbackBucket
    const path = parsed?.path ?? ref
    if (!byBucket.has(bucket)) byBucket.set(bucket, [])
    byBucket.get(bucket)!.push({ ref, path })
  }

  for (const [bucket, entries] of Array.from(byBucket.entries())) {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrls(entries.map((e) => e.path), expiresIn)
    entries.forEach((e: { ref: string; path: string }, i: number) => map.set(e.ref, (!error && data?.[i]?.signedUrl) || e.ref))
  }

  return map
}

/** Resolve a single stored file reference to a signed URL. Falls back to the original reference on error. */
export async function toSignedUrl(
  supabase: SupabaseClient<any, any, any>,
  fallbackBucket: string,
  ref: string,
  expiresIn = SIGNED_URL_EXPIRY
): Promise<string> {
  const map = await buildSignedUrlMap(supabase, fallbackBucket, [ref], expiresIn)
  return map.get(ref) ?? ref
}
