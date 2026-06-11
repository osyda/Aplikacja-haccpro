'use client'

import { useRef } from 'react'
import { cn } from '@/lib/utils'
import { Sparkles, Camera, Paperclip, X, Plus, RotateCcw, CheckCircle2 } from 'lucide-react'

interface AiScanRowProps {
  /** Label for the idle "scan" button, e.g. "Skanuj zdjęcie / PDF AI". */
  label: string
  files: File[]
  onFilesChange: (files: File[]) => void
  onScan: () => void
  scanning: boolean
  hasResult: boolean
  onReset: () => void
  /** Result summary, shown below the "Wypełniono automatycznie" header once `hasResult` is true. */
  children?: React.ReactNode
}

/** Compact AI-scan control: a single row that expands to a file picker / preview, then to a result summary. */
export function AiScanRow({ label, files, onFilesChange, onScan, scanning, hasResult, onReset, children }: AiScanRowProps) {
  const pickRef = useRef<HTMLInputElement>(null)
  const addRef = useRef<HTMLInputElement>(null)

  return (
    <div className={cn(
      'rounded-xl p-3 transition-all',
      hasResult || files.length > 0 ? 'border border-purple-200 bg-purple-50' : 'border border-dashed border-gray-200 bg-white'
    )}>
      <input ref={pickRef} type="file" accept="image/*,.pdf" multiple className="hidden"
        onChange={e => {
          const picked = Array.from(e.target.files ?? [])
          if (picked.length) onFilesChange([...files, ...picked])
          if (pickRef.current) pickRef.current.value = ''
        }} />
      <input ref={addRef} type="file" accept="image/*,.pdf" multiple className="hidden"
        onChange={e => {
          const picked = Array.from(e.target.files ?? [])
          if (picked.length) onFilesChange([...files, ...picked])
          if (addRef.current) addRef.current.value = ''
        }} />

      {hasResult ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-purple-700 font-semibold">
              <CheckCircle2 size={13} /> Wypełniono automatycznie
            </div>
            <button type="button" onClick={onReset}
              className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 shrink-0">
              <RotateCcw size={12} /> Skanuj ponownie
            </button>
          </div>
          {children}
        </div>
      ) : scanning ? (
        <div className="flex items-center justify-center gap-3 py-3">
          <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium text-purple-700">
            Analizowanie {files.length} {files.length === 1 ? 'pliku' : 'plików'}…
          </span>
        </div>
      ) : files.length === 0 ? (
        <button type="button" onClick={() => pickRef.current?.click()}
          className="flex items-center gap-2.5 w-full text-left">
          <div className="p-1.5 bg-purple-100 rounded-lg shrink-0">
            <Sparkles size={15} className="text-purple-600" />
          </div>
          <span className="text-sm font-semibold text-gray-800 flex-1">{label}</span>
          <Camera size={17} className="text-gray-400 shrink-0" />
        </button>
      ) : (
        <div className="space-y-2">
          <div className="space-y-1.5">
            {files.map((f, i) => (
              <div key={`${f.name}-${i}`} className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-purple-100 text-xs text-gray-700">
                <Paperclip size={12} className="text-purple-400 shrink-0" />
                <span className="flex-1 truncate font-medium">{f.name}</span>
                <button type="button" onClick={() => onFilesChange(files.filter((_, j) => j !== i))}>
                  <X size={13} className="text-gray-400 hover:text-gray-600" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => addRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-2 border border-dashed border-gray-200 rounded-lg text-xs text-gray-500 hover:border-purple-300 hover:text-purple-600 transition-colors shrink-0">
              <Plus size={13} /> Dodaj
            </button>
            <button type="button" onClick={onScan}
              className="flex-1 flex items-center justify-center gap-2 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg transition-colors">
              <Sparkles size={13} />
              Analizuj {files.length === 1 ? '1 plik' : `${files.length} pliki/plików`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
