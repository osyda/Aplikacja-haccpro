'use client'

import { useState } from 'react'
import { AlertCircle, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Dialog, ConfirmDialog } from '@/components/ui/dialog'
import { TempStepInput } from '@/components/ui/temp-step-input'
import { CHILLED_TEMP_MAX, FROZEN_TEMP_MAX, chilledMaxAllowed, isChilledTempOk, isFrozenTempOk } from '@/lib/delivery-temp'
import { getCats, type DeliveryLog } from './delivery-list'

interface Props {
  log: DeliveryLog
  isOwner: boolean
  onClose: () => void
  onSaved: () => void
  onDeleted: () => void
}

function parseTempInput(s: string): number | null {
  if (s.trim() === '') return null
  const n = parseFloat(s.replace(',', '.'))
  return isNaN(n) ? null : n
}

export function EditDeliveryModal({ log, isOwner, onClose, onSaved, onDeleted }: Props) {
  const cats = getCats(log)
  const frozenSelected = cats.includes('mrozonki')
  const chilledCats = cats.filter(c => c !== 'mrozonki' && CHILLED_TEMP_MAX[c] !== undefined)
  const mixed = frozenSelected && chilledCats.length > 0
  const chilledMax = chilledMaxAllowed(chilledCats)

  const showChilledField = chilledCats.length > 0
  const showFrozenField = frozenSelected
  const showGenericField = !showChilledField && !showFrozenField && log.temp_at_delivery !== null

  const [quantity, setQuantity] = useState(log.quantity ?? '')
  const [expiryDate, setExpiryDate] = useState(log.expiry_date ?? '')
  const [tempAtDelivery, setTempAtDelivery] = useState(log.temp_at_delivery !== null ? String(log.temp_at_delivery) : '')
  const [tempFrozen, setTempFrozen] = useState(log.temp_frozen != null ? String(log.temp_frozen) : '')
  const [notes, setNotes] = useState(log.notes ?? '')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const supabase = createClient()

  const tempAtDeliveryVal = parseTempInput(tempAtDelivery)
  const tempFrozenVal = parseTempInput(tempFrozen)
  const tempAtDeliveryChanged = tempAtDeliveryVal !== log.temp_at_delivery
  const tempFrozenChanged = mixed && tempFrozenVal !== (log.temp_frozen ?? null)
  const tempChanged = tempAtDeliveryChanged || tempFrozenChanged

  const chilledOk = tempAtDeliveryVal === null || isChilledTempOk(tempAtDeliveryVal, chilledCats)
  const frozenFieldVal = mixed ? tempFrozenVal : tempAtDeliveryVal
  const frozenOk = frozenFieldVal === null || isFrozenTempOk(frozenFieldVal)

  const canSave = !saving && (!tempChanged || reason.trim().length > 0)

  async function handleSave() {
    if (tempChanged && !reason.trim()) {
      toast.error('Podaj powód korekty temperatury')
      return
    }

    setSaving(true)

    const correctionLines: string[] = []
    if (tempAtDeliveryChanged) {
      const label = mixed ? ' (chłodzone)' : showFrozenField ? ' (mrożonki)' : ''
      correctionLines.push(
        `Korekta odczytu temperatury${label}: ${log.temp_at_delivery ?? '—'}°C → ${tempAtDeliveryVal ?? '—'}°C. Powód: ${reason.trim()}`
      )
    }
    if (tempFrozenChanged) {
      correctionLines.push(
        `Korekta odczytu temperatury (mrożonki): ${log.temp_frozen ?? '—'}°C → ${tempFrozenVal ?? '—'}°C. Powód: ${reason.trim()}`
      )
    }

    const finalNotes = [notes.trim(), ...correctionLines].filter(Boolean).join('\n')

    const { error } = await supabase.from('delivery_logs').update({
      quantity: quantity.trim() || null,
      expiry_date: expiryDate || null,
      temp_at_delivery: tempAtDeliveryVal,
      temp_frozen: mixed ? tempFrozenVal : (log.temp_frozen ?? null),
      notes: finalNotes || null,
    }).eq('id', log.id)

    setSaving(false)
    if (error) { toast.error('Błąd zapisu: ' + error.message); return }
    toast.success('Dostawa zaktualizowana')
    onSaved()
  }

  async function handleDelete() {
    setDeleting(true)
    const { error } = await supabase.from('delivery_logs').delete().eq('id', log.id)
    setDeleting(false)
    if (error) { toast.error('Błąd usuwania: ' + error.message); return }
    toast.success('Dostawa usunięta')
    onDeleted()
  }

  return (
    <Dialog open onClose={onClose} title="Edytuj dostawę" description={log.product} size="md">
      <div className="space-y-4">
        <div>
          <label className="label">Ilość</label>
          <input className="input" placeholder="np. 10 kg, 50 szt."
            value={quantity} onChange={e => setQuantity(e.target.value)} />
        </div>

        <div>
          <label className="label">Data ważności</label>
          <input type="date" className="input" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} />
        </div>

        {showChilledField && (
          <div>
            <label className="label">
              {mixed ? 'Temperatura — produkty chłodzone' : 'Temperatura przy odbiorze (°C)'}
            </label>
            <TempStepInput value={tempAtDelivery} onChange={setTempAtDelivery} />
            {tempAtDeliveryVal !== null && !chilledOk && (
              <div className="flex items-center gap-2 mt-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertCircle size={13} />
                Temperatura poza normą{chilledMax !== null ? ` (0–${chilledMax}°C)` : ''} — dostawa wymaga uwagi
              </div>
            )}
          </div>
        )}

        {showFrozenField && (
          <div>
            <label className="label">
              {mixed ? 'Temperatura — mrożonki' : 'Temperatura przy odbiorze (°C)'}
            </label>
            <TempStepInput
              value={mixed ? tempFrozen : tempAtDelivery}
              onChange={mixed ? setTempFrozen : setTempAtDelivery}
            />
            {frozenFieldVal !== null && !frozenOk && (
              <div className="flex items-center gap-2 mt-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertCircle size={13} />
                Temperatura mrożonek wyższa niż {FROZEN_TEMP_MAX}°C — dostawa wymaga uwagi
              </div>
            )}
          </div>
        )}

        {showGenericField && (
          <div>
            <label className="label">Temperatura (°C)</label>
            <input
              type="number"
              step="0.1"
              inputMode="decimal"
              className="input font-mono text-xl text-center py-3 h-14"
              value={tempAtDelivery}
              onChange={e => setTempAtDelivery(e.target.value)}
            />
          </div>
        )}

        {tempChanged && (
          <div>
            <label className="label">
              Powód korekty temperatury <span className="text-red-500">*wymagane</span>
            </label>
            <input
              className="input"
              placeholder='np. "Błędna temperatura — pomyłka pracownika"'
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
          </div>
        )}

        <div>
          <label className="label">Uwagi <span className="text-gray-400 font-normal">(opcjonalne)</span></label>
          <textarea rows={2} className="input resize-none" placeholder="Dodatkowe informacje..."
            value={notes} onChange={e => setNotes(e.target.value)} />
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className={cn(
              'flex-1 py-3.5 rounded-xl text-sm font-bold text-white transition-colors min-h-[52px]',
              !canSave ? 'bg-gray-300 cursor-not-allowed' : 'bg-brand-green hover:bg-brand-green-dark'
            )}
          >
            {saving ? 'Zapisywanie…' : 'Zapisz zmiany'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-3.5 rounded-xl text-sm font-medium text-gray-600 border-2 border-gray-200 hover:bg-gray-50 min-h-[52px]"
          >
            Anuluj
          </button>
        </div>

        {isOwner && (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium text-red-600 border-2 border-red-200 hover:bg-red-50 min-h-[48px]"
          >
            <Trash2 size={16} />
            Usuń dostawę
          </button>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Usuń dostawę"
        description="Czy na pewno chcesz całkowicie usunąć ten wpis dostawy? Tej operacji nie można odwrócić."
        confirmLabel="Usuń"
        loading={deleting}
        danger
      />
    </Dialog>
  )
}
