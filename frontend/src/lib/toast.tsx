import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { X, CheckCircle, AlertCircle, Info, Sparkles } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info'

type Toast = {
  id: number
  type: ToastType
  message: string
  exiting?: boolean
}

type ToastCtx = { toast: (type: ToastType, message: string) => void }

const Ctx = createContext<ToastCtx>({ toast: () => {} })
let nextId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((type: ToastType, message: string) => {
    const id = nextId++
    setToasts(t => [...t, { id, type, message }])
    setTimeout(() => {
      setToasts(t => t.map(t => t.id === id ? { ...t, exiting: true } : t))
      setTimeout(() => setToasts(t => t.filter(t => t.id !== id)), 300)
    }, 3000)
  }, [])

  const icons = { success: CheckCircle, error: AlertCircle, info: Info }
  const colors = { success: 'bg-emerald-50 dark:bg-emerald-900/50 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300', error: 'bg-red-50 dark:bg-red-900/50 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300', info: 'bg-blue-50 dark:bg-blue-900/50 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300' }
  const iconsExtra: Record<string, ReactNode> = { success: <Sparkles className="h-3 w-3 text-emerald-400 absolute -top-1 -right-1" /> }

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
        {toasts.map(t => {
          const Icon = icons[t.type]
          return (
            <div key={t.id} className={`flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-sm hover-lift ${colors[t.type]} ${t.exiting ? 'toast-exit' : 'toast-enter'}`}>
              <div className="relative shrink-0 mt-0.5">
                <Icon className="h-4 w-4" />
                {iconsExtra[t.type]}
              </div>
              <p className="text-sm flex-1">{t.message}</p>
              <button onClick={() => setToasts(ts => ts.filter(x => x.id !== t.id))} className="shrink-0 opacity-60 hover:opacity-100"><X className="h-3.5 w-3.5" /></button>
            </div>
          )
        })}
      </div>
    </Ctx.Provider>
  )
}

export function useToast() { return useContext(Ctx) }
