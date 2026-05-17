import { Apple } from 'lucide-react'

const ALLERGENS = [
  { id: 1, name: 'Gluten', desc: 'Zboża zawierające gluten (pszenica, żyto, jęczmień, owies)', emoji: '🌾' },
  { id: 2, name: 'Skorupiaki', desc: 'Kraby, krewetki, langusty', emoji: '🦞' },
  { id: 3, name: 'Jaja', desc: 'Jaja i produkty na bazie jaj', emoji: '🥚' },
  { id: 4, name: 'Ryby', desc: 'Ryby i produkty rybne', emoji: '🐟' },
  { id: 5, name: 'Orzeszki ziemne', desc: 'Arachidy i produkty pochodne', emoji: '🥜' },
  { id: 6, name: 'Soja', desc: 'Soja i produkty sojowe', emoji: '🫘' },
  { id: 7, name: 'Mleko', desc: 'Mleko i produkty mleczne (w tym laktoza)', emoji: '🥛' },
  { id: 8, name: 'Orzechy', desc: 'Migdały, orzechy laskowe, włoskie, nerkowca, pekan, brazylijskie, pistacjowe, makadamia', emoji: '🌰' },
  { id: 9, name: 'Seler', desc: 'Seler i produkty pochodne', emoji: '🌿' },
  { id: 10, name: 'Gorczyca', desc: 'Gorczyca i produkty z gorczycy', emoji: '🌱' },
  { id: 11, name: 'Sezam', desc: 'Nasiona sezamu i produkty pochodne', emoji: '⚫' },
  { id: 12, name: 'Dwutlenek siarki i siarczyny', desc: 'Stężenie >10 mg/kg lub 10 mg/l wyrażone jako SO2', emoji: '💨' },
  { id: 13, name: 'Łubin', desc: 'Łubin i produkty z łubinu', emoji: '🌼' },
  { id: 14, name: 'Mięczaki', desc: 'Małże, ślimaki, kałamarnice, ośmiornice', emoji: '🐚' },
]

export default function AlergenPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Alergeny</h1>
        <p className="text-sm text-gray-500 mt-0.5">14 alergenów wg rozporządzenia UE 1169/2011</p>
      </div>

      <div className="card">
        <p className="text-sm text-gray-600 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
          Zgodnie z rozporządzeniem UE 1169/2011, każdy zakład gastronomiczny jest zobowiązany do informowania gości o obecności alergenów w potrawach.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {ALLERGENS.map((a) => (
            <div key={a.id} className="flex items-start gap-3 p-3 border border-gray-100 rounded-lg hover:border-brand-green transition-colors">
              <span className="text-2xl">{a.emoji}</span>
              <div>
                <p className="font-medium text-sm text-gray-900">
                  <span className="text-gray-400 font-normal mr-1">{a.id}.</span>
                  {a.name}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{a.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card bg-brand-navy text-white">
        <h2 className="font-semibold mb-2">Deklaracja alergenowa</h2>
        <p className="text-sm text-white/70">
          Moduł kart alergenowych dla poszczególnych potraw — wkrótce dostępny w Fazie 2.
        </p>
        <div className="mt-3 inline-flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-lg text-sm">
          <Apple size={14} />
          Faza 2 — Q3 2026
        </div>
      </div>
    </div>
  )
}
