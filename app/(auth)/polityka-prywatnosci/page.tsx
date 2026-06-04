import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export default function PolitykaPrywatnosci() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/register" className="p-2 hover:bg-gray-100 rounded-lg transition-colors inline-flex">
          <ChevronLeft size={18} />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Polityka prywatności</h1>
      </div>

      <div className="prose prose-sm max-w-none text-gray-700 space-y-4">
        <p className="text-sm text-gray-400">Ostatnia aktualizacja: czerwiec 2026</p>

        <h2 className="text-lg font-semibold text-gray-900">1. Administrator danych</h2>
        <p>
          Administratorem danych osobowych jest firma HACCPro, świadcząca usługi elektronicznych rejestrów HACCP
          dostępnych pod adresem app.haccpro.pl.
        </p>

        <h2 className="text-lg font-semibold text-gray-900">2. Jakie dane zbieramy</h2>
        <p>W ramach korzystania z aplikacji HACCPro przetwarzamy następujące dane:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Imię i nazwisko</li>
          <li>Adres email</li>
          <li>Nazwę firmy / lokalu gastronomicznego</li>
          <li>Dane wprowadzane do rejestrów HACCP (temperatury, dostawy, szkolenia, orzeczenia pracowników itp.)</li>
          <li>Dane techniczne (adres IP, typ przeglądarki) — do celów bezpieczeństwa</li>
        </ul>

        <h2 className="text-lg font-semibold text-gray-900">3. Cel przetwarzania danych</h2>
        <p>Dane przetwarzamy w celu:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Świadczenia usługi elektronicznych rejestrów HACCP</li>
          <li>Umożliwienia logowania i zarządzania kontem</li>
          <li>Wysyłania powiadomień związanych z usługą (np. link aktywacyjny, reset hasła)</li>
          <li>Wypełnienia obowiązków prawnych</li>
        </ul>

        <h2 className="text-lg font-semibold text-gray-900">4. Podstawa prawna</h2>
        <p>
          Przetwarzanie odbywa się na podstawie art. 6 ust. 1 lit. b) RODO (wykonanie umowy) oraz
          art. 6 ust. 1 lit. c) RODO (obowiązek prawny).
        </p>

        <h2 className="text-lg font-semibold text-gray-900">5. Okres przechowywania danych</h2>
        <p>
          Dane przechowujemy przez czas trwania umowy oraz przez okres wymagany przepisami prawa
          (dokumentacja HACCP — minimum 1 rok).
        </p>

        <h2 className="text-lg font-semibold text-gray-900">6. Twoje prawa</h2>
        <p>Masz prawo do:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Dostępu do swoich danych</li>
          <li>Sprostowania danych</li>
          <li>Usunięcia danych (&ldquo;prawo do bycia zapomnianym&rdquo;)</li>
          <li>Ograniczenia przetwarzania</li>
          <li>Przenoszenia danych</li>
          <li>Wniesienia sprzeciwu</li>
        </ul>

        <h2 className="text-lg font-semibold text-gray-900">7. Kontakt</h2>
        <p>
          W sprawach dotyczących ochrony danych osobowych skontaktuj się z nami przez stronę{' '}
          <a href="https://haccpro.pl" target="_blank" rel="noopener noreferrer"
            className="text-brand-green hover:underline">haccpro.pl</a>.
        </p>
      </div>
    </div>
  )
}
