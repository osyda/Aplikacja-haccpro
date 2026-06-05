import Link from 'next/link'

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 bg-[#22C55E] rounded-lg flex items-center justify-center font-bold text-white text-sm shrink-0">H</div>
          <Link href="https://haccpro.pl" className="font-bold text-gray-900 hover:text-[#22C55E] transition-colors">
            HACCPro
          </Link>
          <span className="text-gray-300 mx-1">·</span>
          <span className="text-sm text-gray-500">Elektroniczne rejestry HACCP</span>
          <div className="ml-auto">
            <Link
              href="/login"
              className="text-sm text-[#22C55E] font-semibold hover:underline"
            >
              Zaloguj się
            </Link>
          </div>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-10 pb-20">
        {children}
      </main>
      <footer className="border-t border-gray-200 bg-white py-6 text-center text-xs text-gray-400">
        © {new Date().getFullYear()} HACCPro · <Link href="/regulamin" className="hover:underline">Regulamin</Link> · <Link href="/polityka-prywatnosci" className="hover:underline">Polityka prywatności</Link>
      </footer>
    </div>
  )
}
