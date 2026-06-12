'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Stethoscope, AlertTriangle, Paperclip, X, Search, Trash2,
} from 'lucide-react'
import { formatDate, getDaysUntil } from '@/lib/utils'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { SectionHeader } from '@/components/ui/section-header'
import { AiScanRow } from '@/components/ui/ai-scan-row'
import { Dialog } from '@/components/ui/dialog'
import type { CertScanResult } from '@/app/api/scan-certificate/route'

interface MedRecord {
  id: string
  person_name: string
  certificate_type: string
  valid_until: string
  pesel: string | null
  notes: string | null
  doc_url: string | null
}

function StatusBadge({ validUntil }: { validUntil: string }) {
  const days = getDaysUntil(validUntil)
  if (days < 0) return <span className="text-xs font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded-full">Wygasło {Math.abs(days)}d temu</span>
  if (days <= 30) return <span className="text-xs font-medium text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">Wygasa za {days}d</span>
  return <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">Ważne {days}d</span>
}

export default function OrzeczenicaPage() {
  const [records, setRecords] = useState<MedRecord[]>([])
  const [canDelete, setCanDelete] = useState(false)
  const [form, setForm] = useState({ person_name: '', pesel: '', valid_until: '', notes: '' })
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)

  // AI scan
  const [scanFiles, setScanFiles] = useState<File[]>([])
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<CertScanResult | null>(null)

  // "+ Nowy wpis" modal (AI scan + manual form)
  const [showModal, setShowModal] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  async function getCtx() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('location_id, role').eq('id', user!.id).single()
    return { locationId: profile?.location_id ?? '', userId: user!.id, role: (profile?.role ?? '') as string }
  }

  async function fetchRecords() {
    const { locationId, role } = await getCtx()
    setCanDelete(role === 'owner')
    const { data } = await supabase.from('medical_records').select('*').eq('location_id', locationId).order('valid_until')
    setRecords(data ?? [])
  }

  async function handleDelete(id: string) {
    if (!confirm('Usunąć to orzeczenie z rejestru? Tej operacji nie można cofnąć.')) return
    const { error } = await supabase.from('medical_records').delete().eq('id', id)
    if (error) { toast.error('Błąd: ' + error.message); return }
    toast.success('Orzeczenie usunięte.')
    fetchRecords()
  }

  useEffect(() => { fetchRecords() }, [])

  async function handleScan(toScan: File[]) {
    setScanning(true)
    setScanResult(null)
    setFile(toScan[0] ?? null) // pre-fill attachment so it's not uploaded twice
    try {
      const fd = new FormData()
      toScan.forEach((f) => fd.append('files', f))
      const res = await fetch('/api/scan-certificate', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Błąd skanowania'); return }
      const result = json as CertScanResult
      setScanResult(result)
      setForm((prev) => ({
        ...prev,
        person_name: result.person_name ?? prev.person_name,
        pesel: result.pesel ?? prev.pesel,
        valid_until: result.valid_until ?? prev.valid_until,
      }))
      setShowModal(true)
      toast.success('Dokument zeskanowany! Sprawdź i uzupełnij dane.')
    } catch (e) {
      toast.error('Błąd połączenia: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setScanning(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.person_name) { toast.error('Podaj imię i nazwisko'); return }
    if (!form.valid_until) { toast.error('Podaj datę ważności'); return }
    setLoading(true)
    const { locationId, userId } = await getCtx()

    let docUrl: string | null = null
    if (file) {
      const ext = file.name.split('.').pop()
      const path = `medical/${locationId}/${Date.now()}.${ext}`
      const { data: upload, error: uploadError } = await supabase.storage
        .from('documents').upload(path, file, { upsert: false })
      if (uploadError) { toast.error('Błąd uploadu: ' + uploadError.message); setLoading(false); return }
      docUrl = supabase.storage.from('documents').getPublicUrl(upload.path).data.publicUrl
    }

    const { error } = await supabase.from('medical_records').insert({
      location_id: locationId,
      person_name: form.person_name,
      certificate_type: 'Do celów sanitarno-epidemiologicznych',
      valid_until: form.valid_until,
      pesel: form.pesel.trim() || null,
      notes: form.notes.trim() || null,
      doc_url: docUrl,
      recorded_by: userId,
    })

    setLoading(false)
    if (error) { toast.error('Błąd zapisu: ' + error.message); return }
    toast.success('Orzeczenie dodane!')
    setForm({ person_name: '', pesel: '', valid_until: '', notes: '' })
    setFile(null)
    if (fileRef.current) fileRef.current.value = ''
    setScanFiles([])
    setScanResult(null)
    setShowModal(false)
    fetchRecords()
  }

  const urgent = records.filter((r) => getDaysUntil(r.valid_until) <= 30)

  return (
    <div className="space-y-6">
      <PageHeader title="Orzeczenia lekarskie" subtitle="Rejestr orzeczeń do celów sanitarno-epidemiologicznych" />

      {/* Urgent alert */}
      {urgent.length > 0 && (
        <div className="card border-red-200 bg-red-50">
          <div className="flex items-center gap-2 text-red-700 mb-2">
            <AlertTriangle size={16} />
            <p className="font-semibold text-sm">Wymagają uwagi ({urgent.length})</p>
          </div>
          {urgent.map((r) => (
            <div key={r.id} className="flex items-center gap-2 text-sm text-red-700 py-0.5 flex-wrap">
              <span>• {r.person_name}</span>
              <StatusBadge validUntil={r.valid_until} />
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3">
        <SectionHeader title="Rejestr orzeczeń" actionLabel="Nowy wpis" onAction={() => setShowModal(true)} />
        {records.length > 0 ? (
          <div className="card">
            <div className="divide-y divide-gray-50">
              {records.map((r) => (
                <div key={r.id} className="py-3 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="font-medium text-sm text-gray-900">{r.person_name}</p>
                      <StatusBadge validUntil={r.valid_until} />
                    </div>
                    {r.pesel && (
                      <p className="text-xs text-gray-500 font-mono mt-0.5">PESEL: {r.pesel}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">Ważne do: {formatDate(r.valid_until)}</p>
                    {r.notes && <p className="text-xs text-gray-400 mt-0.5">{r.notes}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {r.doc_url ? (
                      <a
                        href={r.doc_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Podgląd orzeczenia"
                        className="p-2 rounded-lg border border-gray-200 hover:border-purple-400 hover:bg-purple-50 transition-colors text-gray-400 hover:text-purple-600"
                      >
                        <Search size={16} />
                      </a>
                    ) : (
                      <div className="p-2 rounded-lg border border-dashed border-gray-200 text-gray-300" title="Brak skanu">
                        <Search size={16} />
                      </div>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => handleDelete(r.id)}
                        title="Usuń orzeczenie"
                        className="p-2 rounded-lg border border-dashed border-red-200 text-red-400 hover:text-red-600 hover:border-red-400 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <EmptyState icon={Stethoscope} title="Brak orzeczeń" description="Dodaj pierwsze orzeczenie, aby zacząć budować rejestr." />
        )}
      </div>

      {/* New entry modal */}
      <Dialog open={showModal} onClose={() => setShowModal(false)} title="Nowe orzeczenie" size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <AiScanRow
            label="Skanuj orzeczenie AI"
            files={scanFiles}
            onFilesChange={setScanFiles}
            onScan={() => handleScan(scanFiles)}
            scanning={scanning}
            hasResult={!!scanResult}
            onReset={() => { setScanResult(null); setScanFiles([]) }}
          >
            {scanResult && (
              <div className="space-y-1.5">
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  {scanResult.person_name && <div className="bg-white rounded-lg px-3 py-2 border border-purple-100 col-span-2"><span className="text-gray-400">Pracownik: </span><span className="font-medium text-gray-800">{scanResult.person_name}</span></div>}
                  {scanResult.pesel && <div className="bg-white rounded-lg px-3 py-2 border border-purple-100"><span className="text-gray-400">PESEL: </span><span className="font-medium text-gray-800">{scanResult.pesel}</span></div>}
                  {scanResult.valid_until && <div className="bg-white rounded-lg px-3 py-2 border border-purple-100"><span className="text-gray-400">Ważne do: </span><span className="font-medium text-gray-800">{scanResult.valid_until}</span></div>}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold',
                    scanResult.confidence === 'wysoka' ? 'bg-green-100 text-green-700'
                    : scanResult.confidence === 'srednia' ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-red-100 text-red-700'
                  )}>
                    Pewność: {scanResult.confidence}
                  </span>
                  <span className="text-[11px] text-purple-600">Sprawdź dane poniżej i popraw jeśli trzeba.</span>
                </div>
              </div>
            )}
          </AiScanRow>

          <Input
            label="Imię i nazwisko pracownika"
            placeholder="Jan Kowalski"
            value={form.person_name}
            onChange={(e) => setForm((p) => ({ ...p, person_name: e.target.value }))}
            required
          />

          <Input
            label="PESEL"
            placeholder="00000000000"
            value={form.pesel}
            onChange={(e) => setForm((p) => ({ ...p, pesel: e.target.value.replace(/\D/g, '').slice(0, 11) }))}
          />

          <div>
            <label className="label">Ważne do</label>
            <input
              type="date"
              className="input"
              value={form.valid_until}
              onChange={(e) => setForm((p) => ({ ...p, valid_until: e.target.value }))}
              required
            />
          </div>

          <Input
            label="Uwagi (opcjonalnie)"
            placeholder="Dodatkowe informacje"
            value={form.notes}
            onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
          />

          <div>
            <label className="label">
              Skan orzeczenia (opcjonalnie)
              {file && <span className="text-green-600 font-normal ml-1">— plik gotowy</span>}
            </label>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 cursor-pointer hover:border-gray-300 transition-colors flex-1">
                <Paperclip size={14} />
                {file ? file.name : 'Wybierz plik (JPG, PNG, PDF)'}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
              {file && (
                <button type="button" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = '' }}>
                  <X size={16} className="text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>
          </div>

          <Button type="submit" loading={loading}>Zapisz orzeczenie</Button>
        </form>
      </Dialog>
    </div>
  )
}
