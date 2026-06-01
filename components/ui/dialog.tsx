'use client'

import { Fragment } from 'react'
import { Dialog as HeadlessDialog, Transition } from '@headlessui/react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DialogProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
}

export function Dialog({ open, onClose, title, description, children, size = 'md' }: DialogProps) {
  return (
    <Transition appear show={open} as={Fragment}>
      <HeadlessDialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-end sm:items-center justify-center p-0 sm:p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <HeadlessDialog.Panel
                className={cn(
                  'relative w-full bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-6',
                  sizeClasses[size]
                )}
              >
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={18} />
                </button>

                {title && (
                  <HeadlessDialog.Title className="text-lg font-semibold text-gray-900 pr-8 mb-1">
                    {title}
                  </HeadlessDialog.Title>
                )}
                {description && (
                  <p className="text-sm text-gray-500 mb-4">{description}</p>
                )}

                {children}
              </HeadlessDialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </HeadlessDialog>
    </Transition>
  )
}

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  confirmLabel?: string
  loading?: boolean
  danger?: boolean
}

export function ConfirmDialog({
  open, onClose, onConfirm, title, description,
  confirmLabel = 'Potwierdź', loading, danger,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={title} description={description} size="sm">
      <div className="flex gap-3 justify-end mt-2">
        <button onClick={onClose} className="btn-secondary px-4 py-2 rounded-lg text-sm">
          Anuluj
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50',
            danger ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-green hover:bg-brand-green-dark'
          )}
        >
          {loading ? 'Ładowanie...' : confirmLabel}
        </button>
      </div>
    </Dialog>
  )
}
