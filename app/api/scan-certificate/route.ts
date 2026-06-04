import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export interface CertScanResult {
  person_name: string | null
  pesel: string | null
  valid_until: string | null
  confidence: 'wysoka' | 'srednia' | 'niska'
}

const PROMPT = `Przeanalizuj to orzeczenie lekarskie do celów sanitarno-epidemiologicznych i wyciągnij dane pracownika.
Zwróć TYLKO poprawny JSON bez żadnego tekstu wokół niego, bez markdown, bez \`\`\`json.

Format odpowiedzi:
{
  "person_name": "imię i nazwisko pracownika (string lub null)",
  "pesel": "11-cyfrowy numer PESEL bez spacji i kresek (string lub null)",
  "valid_until": "data ważności orzeczenia w formacie YYYY-MM-DD (string lub null)",
  "confidence": "wysoka lub srednia lub niska"
}

Szukaj danych w całym dokumencie. PESEL to 11 cyfr. Data ważności to zazwyczaj 'Badanie ważne do:', 'Data następnego badania:', 'Orzeczenie wydane na okres' lub podobne sformułowanie.
Jeśli danych nie ma na dokumencie, zwróć null dla danego pola.`

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Brak pliku' }, { status: 400 })

    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ error: 'Obsługiwane formaty: JPG, PNG, WebP, PDF.' }, { status: 400 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'Brak klucza ANTHROPIC_API_KEY w konfiguracji serwera.' }, { status: 500 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const base64 = buffer.toString('base64')

    const fileBlock = file.type === 'application/pdf'
      ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 } }
      : { type: 'image' as const, source: { type: 'base64' as const, media_type: file.type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data: base64 } }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      messages: [{ role: 'user', content: [fileBlock, { type: 'text', text: PROMPT }] }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    const result: CertScanResult = JSON.parse(cleaned)
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[scan-certificate] error:', msg)
    if (msg.includes('JSON')) {
      return NextResponse.json({ error: 'AI nie zwróciło poprawnych danych. Spróbuj ponownie.' }, { status: 422 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
