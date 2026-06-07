'use client'

import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'

const DISMISS_KEY = 'haccpro-install-dismissed'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY)) return

    function handler(e: Event) {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setVisible(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  function dismiss() {
    setVisible(false)
    localStorage.setItem(DISMISS_KEY, '1')
  }

  async function install() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
    dismiss()
  }

  if (!visible || !deferredPrompt) return null

  return (
    <div className="fixed bottom-20 lg:bottom-4 left-4 right-4 lg:left-auto lg:right-4 lg:w-80 z-30 rounded-2xl border border-gray-100 bg-white shadow-lg p-4 flex items-start gap-3">
      <div className="p-2 bg-brand-navy/10 rounded-xl shrink-0">
        <Download size={18} className="text-brand-navy" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-gray-900">Zainstaluj HACCPro</p>
        <p className="text-xs text-gray-500 mt-0.5">Dodaj aplikację do ekranu głównego, aby mieć do niej szybszy dostęp.</p>
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={install}
            className="flex-1 bg-brand-green hover:bg-brand-green-dark text-white rounded-lg py-2 text-xs font-bold transition-colors"
          >
            Zainstaluj
          </button>
          <button
            onClick={dismiss}
            className="px-3 py-2 text-xs font-semibold text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Nie teraz
          </button>
        </div>
      </div>
      <button
        onClick={dismiss}
        className="p-1 text-gray-300 hover:text-gray-500 transition-colors shrink-0"
      >
        <X size={16} />
      </button>
    </div>
  )
}
