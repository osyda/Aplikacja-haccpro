import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export const metadata = {
  title: 'Polityka prywatności – HACCPro',
}

export default function PolitykaPrywatnosci() {
  return (
    <div className="space-y-8">
      <div>
        <Link href="/register" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors mb-6">
          <ChevronLeft size={16} /> Wróć do rejestracji
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Polityka prywatności HACCPro</h1>
        <p className="text-sm text-gray-400 mt-2">Ostatnia aktualizacja: 5 czerwca 2026</p>
        <p className="text-sm text-gray-600 mt-3 leading-relaxed">
          Szanujemy Twoją prywatność. Niniejsza Polityka prywatności wyjaśnia, jakie dane osobowe zbieramy, w jakim celu i na jakiej podstawie prawnej je przetwarzamy, jak długo je przechowujemy oraz jakie prawa Ci przysługują. Dokument jest zgodny z Rozporządzeniem Parlamentu Europejskiego i Rady (UE) 2016/679 z dnia 27 kwietnia 2016 r. (RODO).
        </p>
      </div>

      <Section title="1. Administrator danych osobowych">
        <p>Administratorem Twoich danych osobowych jest właściciel i operator platformy <strong>HACCPro</strong>, dostępnej pod adresem <strong>app.haccpro.pl</strong>.</p>
        <p>W sprawach związanych z ochroną danych osobowych możesz skontaktować się z nami:</p>
        <ul className="list-disc pl-5 mt-1 space-y-1">
          <li>E-mail: <a href="mailto:kontakt@haccpro.pl" className="text-[#22C55E] hover:underline">kontakt@haccpro.pl</a></li>
          <li>Strona internetowa: <a href="https://haccpro.pl" target="_blank" rel="noopener noreferrer" className="text-[#22C55E] hover:underline">haccpro.pl</a></li>
        </ul>
      </Section>

      <Section title="2. Jakie dane zbieramy i skąd">
        <p><strong>Dane podawane przy rejestracji:</strong></p>
        <ul className="list-disc pl-5 mt-1 space-y-1">
          <li>Imię i nazwisko</li>
          <li>Adres e-mail</li>
          <li>Hasło (przechowywane wyłącznie w formie zaszyfrowanej — nigdy w postaci jawnej)</li>
          <li>Nazwa firmy / lokalu gastronomicznego</li>
        </ul>
        <p className="mt-2"><strong>Dane wprowadzane do rejestrów HACCP:</strong></p>
        <ul className="list-disc pl-5 mt-1 space-y-1">
          <li>Pomiary temperatur urządzeń chłodniczych</li>
          <li>Dane dostaw (nazwy dostawców, temperatury, daty)</li>
          <li>Informacje o szkoleniach i orzeczeniach pracowników (imiona i nazwiska pracowników, daty szkoleń i badań lekarskich)</li>
          <li>Rekordy mycia, dezynfekcji i kontroli alergentów</li>
          <li>Opisy niezgodności i działań korygujących</li>
        </ul>
        <p className="mt-2"><strong>Dane techniczne (zbierane automatycznie):</strong></p>
        <ul className="list-disc pl-5 mt-1 space-y-1">
          <li>Adres IP (na potrzeby bezpieczeństwa i zapobiegania nadużyciom)</li>
          <li>Typ przeglądarki i systemu operacyjnego</li>
          <li>Data i godzina logowania</li>
        </ul>
      </Section>

      <Section title="3. Cel i podstawa prawna przetwarzania">
        <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden mt-2">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left px-3 py-2 font-semibold text-gray-700 border-b border-gray-200">Cel przetwarzania</th>
              <th className="text-left px-3 py-2 font-semibold text-gray-700 border-b border-gray-200">Podstawa prawna (RODO)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            <tr>
              <td className="px-3 py-2 text-gray-700">Założenie i obsługa Konta w Aplikacji</td>
              <td className="px-3 py-2 text-gray-600">Art. 6 ust. 1 lit. b) — wykonanie umowy</td>
            </tr>
            <tr>
              <td className="px-3 py-2 text-gray-700">Świadczenie usługi elektronicznych rejestrów HACCP</td>
              <td className="px-3 py-2 text-gray-600">Art. 6 ust. 1 lit. b) — wykonanie umowy</td>
            </tr>
            <tr>
              <td className="px-3 py-2 text-gray-700">Wysyłka emaili transakcyjnych (link aktywacyjny, reset hasła, zaproszenia)</td>
              <td className="px-3 py-2 text-gray-600">Art. 6 ust. 1 lit. b) — wykonanie umowy</td>
            </tr>
            <tr>
              <td className="px-3 py-2 text-gray-700">Obsługa płatności i fakturowanie</td>
              <td className="px-3 py-2 text-gray-600">Art. 6 ust. 1 lit. c) — obowiązek prawny</td>
            </tr>
            <tr>
              <td className="px-3 py-2 text-gray-700">Bezpieczeństwo systemu i zapobieganie nadużyciom</td>
              <td className="px-3 py-2 text-gray-600">Art. 6 ust. 1 lit. f) — prawnie uzasadniony interes</td>
            </tr>
            <tr>
              <td className="px-3 py-2 text-gray-700">Rozpatrywanie reklamacji i obsługa klienta</td>
              <td className="px-3 py-2 text-gray-600">Art. 6 ust. 1 lit. f) — prawnie uzasadniony interes</td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section title="4. Przekazywanie danych podmiotom trzecim">
        <p>Twoje dane mogą być przekazywane wyłącznie zaufanym podprocesorom, niezbędnym do świadczenia usług:</p>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li><strong>Supabase Inc.</strong> — dostawca infrastruktury bazy danych i uwierzytelniania (serwery w UE — region eu-west-1, Irlandia). Supabase przetwarza dane zgodnie z RODO i posiada stosowne certyfikaty bezpieczeństwa.</li>
          <li><strong>Vercel Inc.</strong> — dostawca infrastruktury hostingowej aplikacji (serwery w UE). Dane przetwarzane w ramach umowy o przetwarzanie danych (DPA).</li>
          <li><strong>Resend Inc.</strong> — dostawca usług wysyłki e-mail (wyłącznie emaile transakcyjne: aktywacja konta, reset hasła).</li>
        </ul>
        <p className="mt-2">Nie sprzedajemy, nie wynajmujemy ani nie udostępniamy Twoich danych osobowych podmiotom trzecim w celach marketingowych.</p>
      </Section>

      <Section title="5. Okres przechowywania danych">
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Dane konta i rejestry HACCP</strong> — przez czas trwania umowy (aktywnej subskrypcji) oraz przez 30 dni po jej zakończeniu (umożliwia reaktywację lub pobranie danych).</li>
          <li><strong>Po upływie 30 dni od rozwiązania umowy</strong> — dane są trwale usuwane, chyba że obowiązek przechowywania wynika z przepisów prawa.</li>
          <li><strong>Dokumentacja HACCP</strong> — przepisy prawa żywnościowego wymagają przechowywania dokumentacji HACCP przez minimum 1 rok. Użytkownik jest odpowiedzialny za samodzielne archiwizowanie wymaganych dokumentów (np. eksportowane raporty PDF).</li>
          <li><strong>Dane do celów podatkowych i rachunkowych</strong> — przez 5 lat od końca roku podatkowego, zgodnie z przepisami prawa.</li>
          <li><strong>Logi systemowe (bezpieczeństwo)</strong> — przez 90 dni.</li>
        </ul>
      </Section>

      <Section title="6. Twoje prawa">
        <p>Na podstawie RODO przysługują Ci następujące prawa:</p>
        <div className="space-y-2 mt-2">
          <Right title="Prawo dostępu (art. 15 RODO)">Masz prawo uzyskać informację, czy przetwarzamy Twoje dane, a jeśli tak — dostęp do nich oraz kopię.</Right>
          <Right title="Prawo do sprostowania (art. 16 RODO)">Masz prawo żądać poprawienia nieprawidłowych lub uzupełnienia niekompletnych danych.</Right>
          <Right title="Prawo do usunięcia (art. 17 RODO)">Masz prawo żądać usunięcia danych (&bdquo;prawo do bycia zapomnianym&rdquo;), gdy nie są już potrzebne do celów, dla których zostały zebrane lub gdy cofniesz zgodę.</Right>
          <Right title="Prawo do ograniczenia przetwarzania (art. 18 RODO)">Masz prawo żądać ograniczenia przetwarzania danych w określonych przypadkach, np. gdy kwestionujesz ich prawidłowość.</Right>
          <Right title="Prawo do przenoszenia danych (art. 20 RODO)">Masz prawo otrzymać swoje dane w ustrukturyzowanym formacie nadającym się do odczytu maszynowego (np. CSV, JSON).</Right>
          <Right title="Prawo do sprzeciwu (art. 21 RODO)">Masz prawo wnieść sprzeciw wobec przetwarzania danych opartego na prawnie uzasadnionym interesie.</Right>
          <Right title="Prawo do skargi">Masz prawo wnieść skargę do organu nadzorczego — Prezesa Urzędu Ochrony Danych Osobowych (UODO), ul. Stawki 2, 00-193 Warszawa.</Right>
        </div>
        <p className="mt-3">Aby skorzystać z powyższych praw, skontaktuj się z nami: <a href="mailto:kontakt@haccpro.pl" className="text-[#22C55E] hover:underline">kontakt@haccpro.pl</a>. Odpowiemy w ciągu 30 dni.</p>
      </Section>

      <Section title="7. Bezpieczeństwo danych">
        <p>Stosujemy odpowiednie środki techniczne i organizacyjne w celu ochrony Twoich danych przed nieuprawnionym dostępem, utratą lub zniszczeniem:</p>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li>Szyfrowanie połączeń HTTPS (TLS)</li>
          <li>Hasła przechowywane wyłącznie w postaci zaszyfrowanej (bcrypt)</li>
          <li>Kontrola dostępu oparta na rolach (Row Level Security w bazie danych)</li>
          <li>Infrastruktura w centrach danych certyfikowanych zgodnie z ISO 27001</li>
          <li>Regularne kopie zapasowe danych</li>
        </ul>
      </Section>

      <Section title="8. Pliki cookies i dane techniczne">
        <p>Aplikacja HACCPro używa wyłącznie niezbędnych plików cookies (sesyjnych), koniecznych do utrzymania sesji zalogowanego użytkownika. Nie stosujemy plików cookies śledzących ani marketingowych.</p>
        <p className="mt-2">Nie korzystamy z narzędzi analitycznych (takich jak Google Analytics) w wersji wymagającej zgody użytkownika.</p>
      </Section>

      <Section title="9. Zmiany Polityki prywatności">
        <p>Zastrzegamy sobie prawo do aktualizacji niniejszej Polityki prywatności. O istotnych zmianach poinformujemy Cię drogą e-mail lub poprzez widoczne powiadomienie w Aplikacji przed wejściem zmian w życie.</p>
        <p className="mt-1">Aktualna wersja Polityki prywatności jest zawsze dostępna pod adresem: <strong>app.haccpro.pl/polityka-prywatnosci</strong></p>
      </Section>

      <div className="border-t border-gray-200 pt-6 text-sm text-gray-500">
        <p>Pytania dotyczące ochrony danych kieruj na: <a href="mailto:kontakt@haccpro.pl" className="text-[#22C55E] hover:underline">kontakt@haccpro.pl</a></p>
        <p className="mt-1">Zobacz też: <Link href="/regulamin" className="text-[#22C55E] hover:underline">Regulamin świadczenia usług HACCPro</Link></p>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold text-gray-900 border-b border-gray-200 pb-2">{title}</h2>
      <div className="text-sm text-gray-700 leading-relaxed space-y-2">
        {children}
      </div>
    </section>
  )
}

function Right({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-50 rounded-xl px-4 py-3">
      <p className="font-semibold text-gray-800 text-xs uppercase tracking-wide">{title}</p>
      <p className="text-gray-600 mt-0.5">{children}</p>
    </div>
  )
}
