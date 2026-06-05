import Link from 'next/link'
import { ShieldOff, Mail } from 'lucide-react'

export default function SuspendedPage() {
  return (
    <div className="min-h-screen bg-[#1B2E4B] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md text-center space-y-5">
        <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto">
          <ShieldOff size={32} className="text-red-500" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Konto zawieszone</h1>
          <p className="text-sm text-gray-500 mt-2">
            Dostęp do aplikacji HACCPro dla Twojej organizacji został tymczasowo zawieszony.
          </p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800 text-left">
          Skontaktuj się z nami w celu wyjaśnienia sytuacji lub wznowienia konta.
        </div>
        <a
          href="mailto:kontakt@haccpro.pl"
          className="inline-flex items-center gap-2 w-full justify-center py-3 rounded-xl bg-[#1B2E4B] text-white font-semibold text-sm hover:bg-[#243d63] transition-colors"
        >
          <Mail size={16} />
          kontakt@haccpro.pl
        </a>
        <Link
          href="/login"
          className="block text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          Wróć do logowania
        </Link>
      </div>
    </div>
  )
}
