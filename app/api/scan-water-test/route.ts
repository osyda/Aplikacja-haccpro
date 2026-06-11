import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export interface WaterTestScanResult {
  company: string | null
  tested_at: string | null
  result: string | null
  notes: string | null
  confidence: 'wysoka' | 'srednia' | 'niska'
}

const PROMPT = `Przeanalizuj ten dokument badania jakości wody (np. sprawozdanie z badań wody pitnej z laboratorium, może się składać z kilku stron / zdjęć tego samego dokumentu) i wyciągnij dane.
Zwróć TYLKO poprawny JSON bez żadnego tekstu wokół niego, bez markdown, bez \`\`\`json.

Format odpowiedzi:
{
  "company": "nazwa firmy/laboratorium wykonującego badanie wody (string lub null)",
  "tested_at": "data wykonania badania lub data pobrania próbki w formacie YYYY-MM-DD (string lub null)",
  "result": "wynik badania, np. 'Woda przydatna do spożycia' / 'Woda nieprzydatna do spożycia' / krótkie podsumowanie wyniku (string lub null)",
  "notes": "dodatkowe uwagi np. numer sprawozdania, zakres badania, parametry (string lub null)",
  "confidence": "wysoka lub srednia lub niska"
}

Jeśli dostałeś kilka stron/zdjęć, potraktuj je jako jeden dokument i połącz informacje z wszystkich.`

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await req.formData()
    const files = formData.getAll('files').filter((f): f is File => f instanceof File)
    if (files.length === 0) {
      const single = formData.get('file')
      if (single instanceof File) files.push(single)
    }
    if (files.length === 0) return NextResponse.json({ error: 'Brak pliku' }, { status: 400 })

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
    for (const file of files) {
      if (!allowedTypes.includes(file.type)) {
        return NextResponse.json({ error: 'Obsługiwane formaty: JPG, PNG, WebP, PDF.' }, { status: 400 })
      }
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'Brak klucza ANTHROPIC_API_KEY w konfiguracji serwera.' }, { status: 500 })
    }

    const fileBlocks = await Promise.all(files.map(async (file) => {
      const buffer = Buffer.from(await file.arrayBuffer())
      const base64 = buffer.toString('base64')
      return file.type === 'application/pdf'
        ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 } }
        : { type: 'image' as const, source: { type: 'base64' as const, media_type: file.type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data: base64 } }
    }))

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            ...fileBlocks,
            { type: 'text', text: PROMPT },
          ],
        },
      ],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : ''

    // Strip potential markdown code fences
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()

    const result: WaterTestScanResult = JSON.parse(cleaned)
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[scan-water-test] error:', msg)
    if (msg.includes('JSON')) {
      return NextResponse.json({ error: 'AI nie zwróciło poprawnych danych. Spróbuj ponownie.' }, { status: 422 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
