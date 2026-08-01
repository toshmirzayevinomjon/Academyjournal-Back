import { Component, type ReactNode, type ErrorInfo } from 'react'
import { AlertTriangle, Mail, Phone, RefreshCw, Send } from 'lucide-react'

const CONTACTS = [
  { icon: Phone, label: '+998 95 184 07 51', href: 'tel:+998951840751' },
  { icon: Mail, label: 'toshmirzayevinomjon@gmail.com', href: 'mailto:toshmirzayevinomjon@gmail.com' },
  { icon: Send, label: '@toshmirzayevinomjon', href: 'https://t.me/toshmirzayevinomjon' },
]

type Props = { children: ReactNode }
type State = { hasError: boolean; error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4 dark:bg-slate-900">
          <div className="max-w-md text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-red-50 dark:bg-red-900/30">
              <AlertTriangle className="h-10 w-10 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-stone-800 dark:text-slate-200">Xatolik yuz berdi</h1>
            <p className="mt-2 text-sm text-stone-500 dark:text-slate-400">
              {this.state.error?.message || "Kutilmagan xatolik."}
            </p>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload() }}
              className="btn-primary mt-6"
            >
              <RefreshCw className="h-4 w-4" /> Qayta yuklash
            </button>
            <div className="mt-8 rounded-2xl border border-stone-200/70 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 p-5 text-left shadow-sm">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-slate-400">
                Sayt ishlamayaptimi? Admin bilan bog'laning
              </p>
              <div className="space-y-2">
                {CONTACTS.map(({ icon: Icon, label, href }) => (
                  <a key={href} href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer"
                    className="flex items-center gap-3 rounded-xl bg-stone-50 dark:bg-slate-700/50 px-3.5 py-2.5 text-sm font-medium text-stone-700 dark:text-slate-200 transition-colors hover:bg-brand-soft dark:hover:bg-brand-soft hover:text-brand">
                    <Icon className="h-4 w-4 shrink-0 text-brand" />
                    <span className="truncate">{label}</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
