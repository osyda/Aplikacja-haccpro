import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export interface ScanResult {
  supplier: string | null
  product: string | null
  quantity: string | null
  expiry_date: string | null
  temp_at_delivery: number | null
  categories: string[]
  notes: string | null
  confidence: 'wysoka' | 'srednia' | 'niska'
}

const PROMPT = `Przeanalizuj ten dokument dostawy lub fakturę dla restauracji i wyciągnij dane.
Zwróć TYLKO poprawny JSON bez żadnego tekstu wokół niego, bez markdown, bez \`\`\`json.

Format odpowiedzi:
{
  "supplier": "nazwa firmy dostawcy (string lub null)",
  "product": "główna nazwa towaru lub produktu (string lub null)",
  "quantity": "ilość z jednostką np. '10 kg', '50 szt.', '5 kartonów' (string lub null)",
  "expiry_date": "data ważności w formacie YYYY-MM-DD (string lub null)",
  "temp_at_delivery": temperatura dostawy jako liczba (number lub null),
  "categories": ["lista pasujących kategorii spośród: mieso, drob, ryby, wedliny, nabiał, mrozonki, gotowe, warzywa, suche, pieczywo, napoje, inne"],
  "notes": "dodatkowe uwagi np. numer faktury, numer WZ (string lub null)",
  "confidence": "wysoka lub srednia lub niska"
}

Jeśli na dokumencie jest wiele produktów, wpisz główny lub ogólną nazwę kategorii. Kategorie wybieraj na podstawie rodzaju towaru.`

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Brak pliku' }, { status: 400 })

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Obsługiwane formaty: JPG, PNG, WebP. PDF nie jest obsługiwany w skanowaniu.' }, { status: 400 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'Brak klucza ANTHROPIC_API_KEY w konfiguracji serwera.' }, { status: 500 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const base64 = buffer.toString('base64')
    const mediaType = file.type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
            { type: 'text', text: PROMPT },
          ],
        },
      ],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : ''

    // Strip potential markdown code fences
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()

    const result: ScanResult = JSON.parse(cleaned)
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[scan-invoice] error:', msg)
    if (msg.includes('JSON')) {
      return NextResponse.json({ error: 'AI nie zwróciło poprawnych danych. Spróbuj ponownie.' }, { status: 422 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
