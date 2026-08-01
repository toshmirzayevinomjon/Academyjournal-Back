import { X, AlertTriangle } from 'lucide-react'

type Props = {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
}

export default function ConfirmModal({ open, title, message, confirmLabel = "O'chirish", cancelLabel = 'Bekor', danger, onConfirm, onCancel, loading }: Props) {
  if (!open) return null
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="p-6 text-center">
          <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${danger ? 'bg-red-50 dark:bg-red-900/30' : 'bg-stone-100 dark:bg-slate-700'}`}>
            <AlertTriangle className={`h-7 w-7 ${danger ? 'text-red-500' : 'text-stone-500 dark:text-slate-400'}`} />
          </div>
          <h3 className="text-lg font-bold text-stone-800 dark:text-slate-200">{title}</h3>
          <p className="mt-2 text-sm text-stone-500 dark:text-slate-400">{message}</p>
          <div className="mt-6 flex gap-3">
            <button onClick={onCancel} className="btn-ghost flex-1" disabled={loading}>{cancelLabel}</button>
            <button onClick={onConfirm} disabled={loading}
              className={`inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl px-6 text-sm font-semibold shadow-lg transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 ${
                danger
                  ? 'bg-red-600 text-white shadow-red-600/25 hover:shadow-xl hover:shadow-red-600/30'
                  : 'btn-primary'
              }`}>
              {loading ? 'Yuklanmoqda...' : confirmLabel}
            </button>
          </div>
        </div>
        <button onClick={onCancel} className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-xl text-stone-400 hover:bg-stone-100 hover:text-stone-600 dark:hover:bg-slate-700 dark:hover:text-slate-300 transition-all">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
