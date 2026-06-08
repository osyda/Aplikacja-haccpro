'use client'

import { useEffect, useState } from 'react'
import { Bell, BellOff } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const output = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i)
  return output
}

export function PushNotificationsToggle() {
  const [supported, setSupported] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !VAPID_PUBLIC_KEY) return
    setSupported(true)
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub))
      .catch(() => {})
  }, [])

  async function enable() {
    if (!VAPID_PUBLIC_KEY) return
    setBusy(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        toast.error('Brak zgody na powiadomienia w przeglądarce')
        return
      }
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
      const json = sub.toJSON()
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      })
      if (!res.ok) throw new Error('save failed')
      setSubscribed(true)
      toast.success('Powiadomienia push włączone na tym urządzeniu')
    } catch {
      toast.error('Nie udało się włączyć powiadomień')
    } finally {
      setBusy(false)
    }
  }

  async function disable() {
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setSubscribed(false)
      toast.success('Powiadomienia push wyłączone na tym urządzeniu')
    } catch {
      toast.error('Nie udało się wyłączyć powiadomień')
    } finally {
      setBusy(false)
    }
  }

  if (!supported) return null

  return (
    <div className="card flex items-center gap-3">
      <div className={cn('p-2 rounded-lg shrink-0', subscribed ? 'bg-brand-green/10 text-brand-green' : 'bg-gray-100 text-gray-400')}>
        {subscribed ? <Bell size={16} /> : <BellOff size={16} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">Powiadomienia push</p>
        <p className="text-xs text-gray-500">
          {subscribed ? 'Włączone na tym urządzeniu' : 'Alarmy temperatur i przypomnienia o brakujących wpisach na telefon'}
        </p>
      </div>
      <button
        type="button"
        onClick={subscribed ? disable : enable}
        disabled={busy}
        className={cn(
          'shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50',
          subscribed ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-brand-green text-white hover:bg-brand-green-dark'
        )}
      >
        {busy ? '…' : subscribed ? 'Wyłącz' : 'Włącz'}
      </button>
    </div>
  )
}
