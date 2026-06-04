import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export default function Regulamin() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/register" className="p-2 hover:bg-gray-100 rounded-lg transition-colors inline-flex">
          <ChevronLeft size={18} />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Regulamin</h1>
      </div>

      <div className="prose prose-sm max-w-none text-gray-700 space-y-4">
        <p className="text-sm text-gray-400">Ostatnia aktualizacja: czerwiec 2026</p>

        <h2 className="text-lg font-semibold text-gray-900">§1. Postanowienia ogólne</h2>
        <p>
          Niniejszy regulamin określa zasady korzystania z aplikacji HACCPro dostępnej pod adresem app.haccpro.pl,
          świadczącej usługę elektronicznych rejestrów HACCP dla zakładów gastronomicznych.
        </p>

        <h2 className="text-lg font-semibold text-gray-900">§2. Definicje</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Usługodawca</strong> — firma HACCPro, właściciel platformy app.haccpro.pl</li>
          <li><strong>Użytkownik</strong> — osoba fizyczna lub prawna korzystająca z aplikacji</li>
          <li><strong>Konto</strong> — indywidualne konto w systemie</li>
          <li><strong>Aplikacja</strong> — system elektronicznych rejestrów HACCP dostępny pod app.haccpro.pl</li>
        </ul>

        <h2 className="text-lg font-semibold text-gray-900">§3. Rejestracja i konto</h2>
        <p>
          Rejestracja konta jest bezpłatna i obejmuje 14-dniowy okres próbny z pełnym dostępem do funkcji.
          Do rejestracji wymagane jest podanie prawidłowego adresu email, który zostanie potwierdzony.
        </p>

        <h2 className="text-lg font-semibold text-gray-900">§4. Zakres usługi</h2>
        <p>Aplikacja HACCPro umożliwia:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Prowadzenie elektronicznych rejestrów temperatur</li>
          <li>Rejestrację dostaw i kontrolę jakości</li>
          <li>Zarządzanie szkoleniami pracowników</li>
          <li>Prowadzenie rejestru orzeczeń lekarskich</li>
          <li>Rejestrację niezgodności i działań korygujących</li>
          <li>Generowanie raportów PDF</li>
        </ul>

        <h2 className="text-lg font-semibold text-gray-900">§5. Obowiązki użytkownika</h2>
        <p>Użytkownik zobowiązuje się do:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Podawania prawdziwych danych</li>
          <li>Nieudostępniania dostępu do konta osobom trzecim</li>
          <li>Korzystania z aplikacji zgodnie z jej przeznaczeniem i przepisami prawa</li>
          <li>Samodzielnej weryfikacji prawidłowości wprowadzanych danych</li>
        </ul>

        <h2 className="text-lg font-semibold text-gray-900">§6. Odpowiedzialność</h2>
        <p>
          Usługodawca nie ponosi odpowiedzialności za dane wprowadzane przez użytkownika
          ani za skutki decyzji podjętych na ich podstawie. Aplikacja jest narzędziem wspomagającym —
          ostateczna odpowiedzialność za prowadzenie dokumentacji HACCP leży po stronie użytkownika.
        </p>

        <h2 className="text-lg font-semibold text-gray-900">§7. Postanowienia końcowe</h2>
        <p>
          W sprawach nieuregulowanych niniejszym regulaminem mają zastosowanie przepisy prawa polskiego.
          Wszelkie spory rozstrzygane będą przez sąd właściwy dla siedziby Usługodawcy.
        </p>
      </div>
    </div>
  )
}
