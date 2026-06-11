import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export interface WasteScheduleScanItem {
  waste_type: string
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'once'
  day_of_week: number | null
  day_of_month: number | null
  specific_date: string | null
  anchor_date: string | null
}

export interface WasteScheduleScanResult {
  items: WasteScheduleScanItem[]
  confidence: 'wysoka' | 'srednia' | 'niska'
}

const PROMPT = `Przeanalizuj ten harmonogram odbioru odpadów (może się składać z kilku stron / zdjęć tego samego dokumentu) i wyciągnij listę regularnych odbiorów odpadów.
Zwróć TYLKO poprawny JSON bez żadnego tekstu wokół niego, bez markdown, bez \`\`\`json.

Dla każdego rodzaju odpadu (np. zmieszane, papier, szkło, plastik i metale, BIO/odpady kuchenne, inne) zwróć osobny wpis z częstotliwością odbioru:
- "weekly" — odbiór co tydzień w określony dzień tygodnia (uzupełnij "day_of_week")
- "biweekly" — odbiór co dwa tygodnie w określony dzień tygodnia (uzupełnij "day_of_week" i jeśli to możliwe "anchor_date" — przykładową datę jednego z odbiorów, na podstawie której można wyznaczyć cykl)
- "monthly" — odbiór raz w miesiącu w określony dzień miesiąca (uzupełnij "day_of_month")
- "once" — pojedynczy, jednorazowy odbiór w konkretnym dniu (uzupełnij "specific_date")

"day_of_week": 0=poniedziałek, 1=wtorek, 2=środa, 3=czwartek, 4=piątek, 5=sobota, 6=niedziela.

Format odpowiedzi:
{
  "items": [
    {
      "waste_type": "nazwa rodzaju odpadu, np. 'Odpady zmieszane' (string)",
      "frequency": "weekly" | "biweekly" | "monthly" | "once",
      "day_of_week": liczba 0-6 lub null,
      "day_of_month": liczba 1-31 lub null,
      "specific_date": "YYYY-MM-DD lub null",
      "anchor_date": "YYYY-MM-DD lub null"
    }
  ],
  "confidence": "wysoka lub srednia lub niska"
}

WAŻNE — harmonogramy roczne (kalendarze z konkretnymi datami na cały rok):
Jeśli dokument pokazuje konkretne daty odbioru dla całego roku, NIE twórz osobnego wpisu "once" dla każdej pojedynczej daty z kalendarza — to wygenerowałoby setki wpisów. Zamiast tego rozpoznaj powtarzający się wzorzec (np. "zawsze w poniedziałki" → "weekly" z odpowiednim "day_of_week", "co drugi wtorek" → "biweekly" z "anchor_date" ustawionym na jedną z dat). Jeśli dany rodzaj odpadu jest odbierany kilka razy w tygodniu (np. w poniedziałki i czwartki), zwróć dla niego osobny wpis "weekly" dla każdego dnia tygodnia. Wpis "once" zostaw tylko dla naprawdę pojedynczych, nieregularnych odbiorów (np. jednorazowy odbiór gabarytów w konkretnym dniu), a nie dla regularnego harmonogramu.

Jeśli dostałeś kilka stron/zdjęć, potraktuj je jako jeden dokument i połącz informacje z wszystkich. Jeśli nie uda się rozpoznać żadnego harmonogramu, zwróć pustą listę "items".`

export async function POST(req: NextRequest) {
  let rawText = ''
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
      max_tokens: 8192,
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
    rawText = text

    if (message.stop_reason === 'max_tokens') {
      console.error('[scan-waste-schedule] truncated response (max_tokens):', text.slice(-300))
      return NextResponse.json({ error: 'Harmonogram zawiera zbyt wiele pozycji do zeskanowania naraz. Spróbuj zeskanować mniej stron jednocześnie.' }, { status: 422 })
    }

    // Strip potential markdown code fences and any leading/trailing prose around the JSON object
    let cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start !== -1 && end !== -1 && end > start) {
      cleaned = cleaned.slice(start, end + 1)
    }

    const result: WasteScheduleScanResult = JSON.parse(cleaned)
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[scan-waste-schedule] error:', msg)
    if (msg.includes('JSON')) {
      console.error('[scan-waste-schedule] raw AI response:', rawText)
      return NextResponse.json({ error: 'AI nie zwróciło poprawnych danych. Spróbuj ponownie.' }, { status: 422 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
