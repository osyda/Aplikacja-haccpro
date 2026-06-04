import { ToastProvider } from '@/components/ui/toast-provider'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-brand-navy flex items-center justify-center p-4">
      <ToastProvider />
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-brand-green rounded-2xl mb-4">
            <span className="text-white font-bold text-2xl">H</span>
          </div>
          <h1 className="text-2xl font-bold text-white">HACCPro</h1>
          <p className="text-white/60 text-sm mt-1">Elektroniczne rejestry HACCP</p>
        </div>
        <div className="bg-white rounded-2xl shadow-xl p-6">
          {children}
        </div>
      </div>
    </div>
  )
}
