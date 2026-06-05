import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export const metadata = {
  title: 'Regulamin – HACCPro',
}

export default function Regulamin() {
  return (
    <div className="space-y-8">
      <div>
        <Link href="/register" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors mb-6">
          <ChevronLeft size={16} /> Wróć do rejestracji
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Regulamin świadczenia usług HACCPro</h1>
        <p className="text-sm text-gray-400 mt-2">Ostatnia aktualizacja: 5 czerwca 2026</p>
      </div>

      <Section title="§1. Postanowienia ogólne">
        <p>1.1. Niniejszy Regulamin określa zasady i warunki świadczenia usług drogą elektroniczną przez HACCPro, zwanego dalej &bdquo;Usługodawcą&rdquo;, za pośrednictwem aplikacji internetowej dostępnej pod adresem <strong>app.haccpro.pl</strong>.</p>
        <p>1.2. Aplikacja HACCPro jest narzędziem do prowadzenia elektronicznej dokumentacji systemu HACCP (Hazard Analysis and Critical Control Points) przeznaczonym dla zakładów gastronomicznych, firm cateringowych oraz innych podmiotów prowadzących działalność związaną z produkcją lub obrotem żywnością.</p>
        <p>1.3. Korzystanie z Aplikacji oznacza akceptację niniejszego Regulaminu w całości. Jeśli nie zgadzasz się z jego postanowieniami, prosimy o niekorzystanie z Aplikacji.</p>
        <p>1.4. Regulamin jest dostępny nieodpłatnie pod adresem app.haccpro.pl/regulamin w formie umożliwiającej jego pobranie, utrwalenie i wydrukowanie.</p>
      </Section>

      <Section title="§2. Definicje">
        <ul className="list-none space-y-2">
          <Li><strong>Usługodawca</strong> — właściciel i operator platformy HACCPro, dostępnej pod adresem app.haccpro.pl.</Li>
          <Li><strong>Użytkownik</strong> — osoba fizyczna posiadająca pełną zdolność do czynności prawnych, osoba prawna lub jednostka organizacyjna nieposiadająca osobowości prawnej, która dokonała rejestracji w Aplikacji.</Li>
          <Li><strong>Właściciel konta</strong> — Użytkownik, który zarejestrował Organizację i jest jej administratorem.</Li>
          <Li><strong>Pracownik</strong> — osoba zaproszona przez Właściciela konta do korzystania z Aplikacji w ramach danej Organizacji.</Li>
          <Li><strong>Organizacja</strong> — podmiot (firma, lokal gastronomiczny) zarejestrowany w Aplikacji przez Właściciela konta.</Li>
          <Li><strong>Konto</strong> — indywidualny dostęp do Aplikacji przypisany do adresu e-mail Użytkownika.</Li>
          <Li><strong>Aplikacja</strong> — serwis internetowy HACCPro dostępny pod adresem app.haccpro.pl, świadczący usługę elektronicznych rejestrów HACCP.</Li>
          <Li><strong>Plan subskrypcyjny</strong> — wybrany przez Użytkownika zakres usług i okres rozliczeniowy.</Li>
          <Li><strong>Okres próbny (Trial)</strong> — bezpłatny, ograniczony czasowo dostęp do pełnych funkcji Aplikacji.</Li>
        </ul>
      </Section>

      <Section title="§3. Rejestracja i konto">
        <p>3.1. Rejestracja w Aplikacji jest bezpłatna i wymaga podania: imienia i nazwiska, nazwy organizacji (firmy/lokalu) oraz adresu e-mail i hasła.</p>
        <p>3.2. Po rejestracji Użytkownik otrzymuje dostęp do 14-dniowego okresu próbnego (Trial) z pełnym dostępem do wszystkich funkcji Aplikacji, bez konieczności podawania danych płatniczych.</p>
        <p>3.3. Użytkownik zobowiązuje się do podania prawdziwych, kompletnych i aktualnych danych. W przypadku zmiany danych, Użytkownik powinien niezwłocznie je zaktualizować w Aplikacji.</p>
        <p>3.4. Jeden adres e-mail może być przypisany tylko do jednego Konta.</p>
        <p>3.5. Użytkownik zobowiązuje się do zachowania poufności danych logowania (adresu e-mail i hasła) i nieudostępniania ich osobom trzecim. Wszelkie działania podjęte za pomocą Konta Użytkownika obciążają Użytkownika.</p>
        <p>3.6. Użytkownik ma prawo do posiadania tylko jednego Konta (jednej Organizacji) na darmowym Trialu. Usługodawca zastrzega sobie prawo do usunięcia kont zakładanych w celu wielokrotnego korzystania z okresu próbnego.</p>
      </Section>

      <Section title="§4. Zakres i warunki świadczenia usług">
        <p>4.1. Aplikacja HACCPro umożliwia:</p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li>Prowadzenie elektronicznych rejestrów temperatur urządzeń chłodniczych</li>
          <li>Rejestrację i kontrolę dostaw towarów</li>
          <li>Prowadzenie rejestrów mycia i dezynfekcji</li>
          <li>Zarządzanie szkoleniami pracowników z zakresu higieny</li>
          <li>Prowadzenie rejestru orzeczeń lekarskich i badań sanitarno-epidemiologicznych</li>
          <li>Rejestrację i obsługę niezgodności oraz działań korygujących</li>
          <li>Rejestrację alergentów</li>
          <li>Generowanie raportów PDF z pełną historią wpisów</li>
          <li>Zarządzanie wieloma lokalami w ramach jednej Organizacji</li>
          <li>Zapraszanie i zarządzanie pracownikami</li>
        </ul>
        <p>4.2. Usługodawca zastrzega sobie prawo do modyfikowania zakresu funkcji Aplikacji, w tym wprowadzania nowych funkcji oraz wycofywania istniejących, z zachowaniem praw nabytych przez Użytkowników.</p>
        <p>4.3. Usługodawca dołoży wszelkich starań, aby Aplikacja była dostępna 24 godziny na dobę, 7 dni w tygodniu. Usługodawca zastrzega sobie prawo do przerw technicznych, o których będzie informował Użytkowników z wyprzedzeniem.</p>
      </Section>

      <Section title="§5. Plany subskrypcyjne i płatności">
        <p>5.1. Po upływie okresu próbnego korzystanie z Aplikacji wymaga wykupienia odpowiedniego Planu subskrypcyjnego. Aktualne ceny i zakresy poszczególnych Planów dostępne są na stronie haccpro.pl/cennik.</p>
        <p>5.2. Opłaty za subskrypcję naliczane są z góry, za wybrany okres rozliczeniowy (miesięcznie lub rocznie).</p>
        <p>5.3. Brak wniesienia opłaty za subskrypcję po zakończeniu okresu próbnego lub poprzedniego okresu rozliczeniowego skutkuje zawieszeniem dostępu do Aplikacji. Dane Użytkownika są zachowywane przez okres 30 dni od zawieszenia, po czym mogą zostać trwale usunięte.</p>
        <p>5.4. Użytkownik może anulować subskrypcję w dowolnym momencie. Anulowanie skutkuje nieodnawianiem subskrypcji po zakończeniu bieżącego okresu rozliczeniowego — dostęp pozostaje aktywny do końca opłaconego okresu.</p>
        <p>5.5. Usługodawca zastrzega sobie prawo do zmiany cennika. O zmianach Użytkownicy będą informowani z co najmniej 30-dniowym wyprzedzeniem.</p>
      </Section>

      <Section title="§6. Obowiązki Użytkownika">
        <p>6.1. Użytkownik zobowiązuje się do korzystania z Aplikacji zgodnie z jej przeznaczeniem, niniejszym Regulaminem oraz obowiązującymi przepisami prawa.</p>
        <p>6.2. Użytkownik jest wyłącznie odpowiedzialny za treść, kompletność i prawidłowość danych wprowadzanych do Aplikacji.</p>
        <p>6.3. Użytkownik zobowiązuje się do nieudostępniania danych logowania osobom trzecim. Właściciel konta może zapraszać Pracowników za pomocą mechanizmu zaproszeń dostępnego w Aplikacji.</p>
        <p>6.4. Użytkownik zobowiązuje się do niezwłocznego poinformowania Usługodawcy o podejrzeniu nieuprawnionego dostępu do Konta.</p>
        <p>6.5. Zabronione jest korzystanie z Aplikacji w celach niezgodnych z jej przeznaczeniem, w szczególności do przechowywania treści nielegalnych, naruszających prawa osób trzecich lub regulacje prawne.</p>
      </Section>

      <Section title="§7. Odpowiedzialność Usługodawcy">
        <p>7.1. Aplikacja HACCPro jest narzędziem wspomagającym prowadzenie dokumentacji HACCP. Usługodawca nie gwarantuje, że korzystanie z Aplikacji zapewnia pełną zgodność z przepisami prawa dotyczącymi bezpieczeństwa żywności. Ostateczna odpowiedzialność za prawidłowość prowadzonej dokumentacji HACCP spoczywa na Użytkowniku.</p>
        <p>7.2. Usługodawca nie ponosi odpowiedzialności za dane wprowadzane przez Użytkownika, ich kompletność ani prawidłowość, a także za decyzje podjęte na ich podstawie.</p>
        <p>7.3. Usługodawca nie ponosi odpowiedzialności za przerwy w dostępie do Aplikacji spowodowane siłą wyższą lub awariami infrastruktury zewnętrznej.</p>
        <p>7.4. Całkowita odpowiedzialność Usługodawcy wobec Użytkownika jest ograniczona do wysokości opłat uiszczonych przez Użytkownika za ostatnie 3 miesiące korzystania z Aplikacji.</p>
      </Section>

      <Section title="§8. Ochrona danych osobowych">
        <p>8.1. Zasady przetwarzania danych osobowych opisane są w <Link href="/polityka-prywatnosci" className="text-[#22C55E] hover:underline font-medium">Polityce Prywatności</Link>, stanowiącej integralną część niniejszego Regulaminu.</p>
        <p>8.2. Korzystając z Aplikacji, Użytkownik wyraża zgodę na przetwarzanie danych osobowych zgodnie z Polityką Prywatności.</p>
      </Section>

      <Section title="§9. Własność intelektualna">
        <p>9.1. Wszelkie prawa do Aplikacji, w tym prawa autorskie, prawa do baz danych, znaki towarowe i inne prawa własności intelektualnej należą do Usługodawcy.</p>
        <p>9.2. Użytkownik nabywa wyłącznie niewyłączną, nieprzenoszalną licencję na korzystanie z Aplikacji na potrzeby własnej działalności, w zakresie określonym niniejszym Regulaminem.</p>
        <p>9.3. Zabronione jest kopiowanie, modyfikowanie, dekompilowanie lub rozprowadzanie Aplikacji bez uprzedniej pisemnej zgody Usługodawcy.</p>
      </Section>

      <Section title="§10. Rozwiązanie umowy i usunięcie konta">
        <p>10.1. Użytkownik może w każdej chwili usunąć swoje Konto, kontaktując się z Usługodawcą pod adresem kontakt@haccpro.pl. Usunięcie Konta jest nieodwracalne i skutkuje trwałym usunięciem wszystkich danych powiązanych z Kontem.</p>
        <p>10.2. Usługodawca może usunąć Konto Użytkownika w przypadku rażącego naruszenia postanowień Regulaminu, po uprzednim wezwaniu do zaprzestania naruszeń.</p>
        <p>10.3. W przypadku rozwiązania umowy z winy Usługodawcy, Użytkownikowi przysługuje zwrot opłaty za niewykorzystany okres subskrypcji.</p>
      </Section>

      <Section title="§11. Reklamacje">
        <p>11.1. Reklamacje dotyczące funkcjonowania Aplikacji należy kierować na adres e-mail: <strong>kontakt@haccpro.pl</strong>.</p>
        <p>11.2. Reklamacja powinna zawierać: dane Użytkownika (adres e-mail przypisany do Konta), opis problemu oraz datę jego wystąpienia.</p>
        <p>11.3. Usługodawca rozpatrzy reklamację w terminie 14 dni roboczych od jej otrzymania i poinformuje Użytkownika o jej wyniku.</p>
      </Section>

      <Section title="§12. Zmiany Regulaminu">
        <p>12.1. Usługodawca zastrzega sobie prawo do zmiany niniejszego Regulaminu. O zmianach Użytkownicy będą informowani drogą e-mail lub poprzez powiadomienie w Aplikacji z co najmniej 14-dniowym wyprzedzeniem.</p>
        <p>12.2. Dalsze korzystanie z Aplikacji po wejściu w życie zmian Regulaminu oznacza ich akceptację.</p>
      </Section>

      <Section title="§13. Postanowienia końcowe">
        <p>13.1. W sprawach nieuregulowanych niniejszym Regulaminem mają zastosowanie przepisy prawa polskiego, w szczególności Kodeksu cywilnego oraz ustawy o świadczeniu usług drogą elektroniczną.</p>
        <p>13.2. Wszelkie spory wynikające z korzystania z Aplikacji strony zobowiązują się rozwiązywać polubownie. W przypadku braku porozumienia, właściwym do rozstrzygania sporów jest sąd powszechny właściwy dla siedziby Usługodawcy.</p>
        <p>13.3. Jeśli którekolwiek postanowienie Regulaminu zostanie uznane za nieważne lub niewykonalne, pozostałe postanowienia zachowują pełną moc obowiązującą.</p>
      </Section>

      <div className="border-t border-gray-200 pt-6 text-sm text-gray-500">
        Pytania dotyczące Regulaminu kieruj na adres: <a href="mailto:kontakt@haccpro.pl" className="text-[#22C55E] hover:underline">kontakt@haccpro.pl</a>
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

function Li({ children }: { children: React.ReactNode }) {
  return <li className="flex gap-2"><span className="text-[#22C55E] font-bold shrink-0">—</span><span>{children}</span></li>
}
