import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL ?? 'osyda@icloud.com'

async function checkAdmin() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.email === SUPERADMIN_EMAIL ? user : null
}

export async function POST(request: NextRequest) {
  const user = await checkAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()

  let body: {
    orgName: string; ownerName: string; ownerEmail: string; plan: string; trialDays: number
    nip: string
    addressStreet: string; addressBuildingNo: string; addressUnitNo: string; addressPostalCode: string; addressCity: string
    locationName: string; locationAddress: string; locationCity: string; locationPostalCode: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const {
    orgName, ownerName, ownerEmail, plan, trialDays,
    nip, addressStreet, addressBuildingNo, addressUnitNo, addressPostalCode, addressCity,
    locationName, locationAddress, locationCity, locationPostalCode,
  } = body

  if (!orgName?.trim() || !ownerEmail?.trim()) {
    return NextResponse.json({ error: 'Nazwa firmy i email są wymagane' }, { status: 400 })
  }
  if (!nip || nip.replace(/\D/g, '').length !== 10) {
    return NextResponse.json({ error: 'NIP musi składać się z 10 cyfr' }, { status: 400 })
  }

  const trialEndsAt = plan === 'trial'
    ? new Date(Date.now() + (trialDays ?? 14) * 86_400_000).toISOString()
    : null

  // 1. Create organization
  const { data: org, error: orgErr } = await admin
    .from('organizations')
    .insert({
      name: orgName.trim(), plan, is_active: true, trial_ends_at: trialEndsAt,
      nip: nip.replace(/\D/g, ''),
      address_street: addressStreet?.trim() ?? '',
      address_building_no: addressBuildingNo?.trim() ?? '',
      address_unit_no: addressUnitNo?.trim() ?? '',
      address_postal_code: addressPostalCode?.trim() ?? '',
      address_city: addressCity?.trim() ?? '',
    })
    .select('id')
    .single()

  if (orgErr || !org) {
    return NextResponse.json({ error: orgErr?.message ?? 'Błąd tworzenia organizacji' }, { status: 500 })
  }

  // 2. Create the first location
  const { data: location, error: locErr } = await admin
    .from('locations')
    .insert({
      org_id: org.id,
      name: locationName?.trim() || orgName.trim(),
      address: locationAddress?.trim() ?? '',
      city: locationCity?.trim() ?? '',
      postal_code: locationPostalCode?.trim() ?? '',
    })
    .select('id')
    .single()

  if (locErr || !location) {
    // Rollback org if location creation failed
    await admin.from('organizations').delete().eq('id', org.id)
    return NextResponse.json({ error: locErr?.message ?? 'Błąd tworzenia lokalizacji' }, { status: 500 })
  }

  // 3. Invite owner — trigger joins them to the new org and location as owner
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://app.haccpro.pl'
  const { error: inviteErr } = await admin.auth.admin.inviteUserByEmail(ownerEmail.trim(), {
    data: {
      full_name: ownerName?.trim() ?? '',
      invited_org_id: org.id,
      invited_role: 'owner',
      invited_location_id: location.id,
    },
    redirectTo: `${siteUrl}/auth/confirm`,
  })

  if (inviteErr) {
    // Rollback org (cascade removes the location too) if invite failed
    await admin.from('organizations').delete().eq('id', org.id)
    return NextResponse.json({ error: inviteErr.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true, orgId: org.id })
}
