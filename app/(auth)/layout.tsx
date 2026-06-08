import { ToastProvider } from '@/components/ui/toast-provider'
import { Thermometer, Truck, ShieldCheck } from 'lucide-react'

const FEATURES = [
  { icon: Thermometer, title: 'Temperatury', desc: 'Alarmy w czasie rzeczywistym' },
  { icon: Truck, title: 'Dostawy', desc: 'Kontrola norm i jakości' },
  { icon: ShieldCheck, title: 'Audyt', desc: 'Pełna historia zmian' },
]

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 lg:p-8">
      <ToastProvider />
      <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-6 lg:gap-12 items-center">
        {/* Branding panel — visible on larger screens */}
        <div className="hidden lg:flex flex-col justify-between bg-brand-navy rounded-3xl p-10 text-white relative overflow-hidden min-h-[600px]">
          <div
            className="absolute inset-0 opacity-[0.06] pointer-events-none"
            style={{
              backgroundImage:
                'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)',
              backgroundSize: '32px 32px',
            }}
          />
          <div className="relative">
            <div className="flex items-center gap-3 mb-12">
              <div className="w-10 h-10 bg-brand-green rounded-xl flex items-center justify-center text-white font-bold text-lg">
                H
              </div>
              <div>
                <p className="font-bold text-lg leading-none">HACCPro</p>
                <p className="text-[10px] tracking-[0.2em] text-white/40 uppercase mt-1">
                  Elektroniczne rejestry HACCP
                </p>
              </div>
            </div>
            <span className="inline-block text-[11px] tracking-wider uppercase bg-white/10 px-3 py-1.5 rounded-full text-white/70 mb-6">
              System dla branży gastronomicznej
            </span>
            <h1 className="text-4xl font-bold leading-tight mb-4">
              Rejestry HACCP
              <br />
              zawsze gotowe
              <br />
              na kontrolę.
            </h1>
            <p className="text-white/55 text-sm max-w-sm leading-relaxed">
              Temperatury, dostawy, mycie i szkolenia w jednym miejscu —
              uporządkowane, z przypomnieniami na czas i pełną historią na
              wypadek kontroli sanepidu.
            </p>
          </div>
          <div className="relative grid grid-cols-3 gap-3 mt-12">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <Icon size={18} className="text-brand-green mb-2" />
                <p className="font-semibold text-sm">{title}</p>
                <p className="text-white/40 text-xs mt-0.5">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Form column */}
        <div className="w-full max-w-md mx-auto lg:mx-0">
          <div className="lg:hidden text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-brand-navy rounded-2xl mb-4">
              <span className="text-white font-bold text-2xl">H</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">HACCPro</h1>
            <p className="text-gray-500 text-sm mt-1">Elektroniczne rejestry HACCP</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
