import { useEffect, useState } from 'react'
import { ArrowLeft, DollarSign, Printer, Users, Calendar, TrendingUp, Image, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { languages } from '../lib/i18n'
import { api } from '../lib/api'
import { useToast } from '../lib/toast'

type Payment = { id: number; student_id: number; amount: number; date: string; note?: string | null }
type Summary = { total_income: number; student_count: number; payments: Payment[] }
type Receipt = { id: number; student_id: number; amount: number | null; status: string; note?: string | null; created_at: string }

type Props = {
  groupId: number; groupName: string; token: string; year: number; month: number
  onBack: () => void; studentNameMap: Record<number,string>; lang?: string
}

const MO = ['Yan','Fev','Mar','Apr','May','Iyun','Iyul','Avg','Sen','Okt','Noy','Dek']

export default function PaymentReportPage({ groupId, groupName, token, year, month, onBack, studentNameMap, lang: l }: Props) {
  const t = languages[(l || 'uz') as keyof typeof languages] || languages.uz
  const { toast } = useToast()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [attRates, setAttRates] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(true)
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [photos, setPhotos] = useState<Record<number, string>>({})
  const [photoLoading, setPhotoLoading] = useState<Record<number, boolean>>({})
  const [rcAmounts, setRcAmounts] = useState<Record<number, string>>({})
  const [rcDates, setRcDates] = useState<Record<number, string>>({})
  const [rcAction, setRcAction] = useState<number | null>(null)

  function loadAll() {
    setLoading(true)
    Promise.all([
      api<Summary>(`/api/groups/${groupId}/payments/summary?year=${year}&month=${month+1}`, { token }),
      api<{ students: Array<{ id: number; attendance_rate: number }> }>('/stats', { token }),
      api<Receipt[]>(`/api/groups/${groupId}/receipts`, { token }),
    ])
      .then(([s, stats, rc]) => {
        setSummary(s)
        const map: Record<number, number> = {}
        stats.students.forEach((st) => { map[st.id] = st.attendance_rate })
        setAttRates(map)
        setReceipts(rc)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, year, month, token])

  useEffect(() => {
    receipts.forEach(r => {
      if (photos[r.id] || photoLoading[r.id]) return
      setPhotoLoading(p => ({ ...p, [r.id]: true }))
      fetch(`/api/receipts/${r.id}/photo`, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => { if (!res.ok) throw new Error(); return res.blob() })
        .then(b => setPhotos(p => ({ ...p, [r.id]: URL.createObjectURL(b) })))
        .catch(() => {})
        .finally(() => setPhotoLoading(p => ({ ...p, [r.id]: false })))
    })
  }, [receipts, photos, photoLoading, token])

  useEffect(() => () => { Object.values(photos).forEach(u => URL.revokeObjectURL(u)) }, [])

  async function confirmReceipt(r: Receipt) {
    const amount = rcAmounts[r.id]
    const date = rcDates[r.id]
    if (!amount || !date) { toast('error', t.pay_receipt_err); return }
    setRcAction(r.id)
    try {
      await api(`/api/groups/${groupId}/receipts/${r.id}/confirm`, { method: 'POST', body: JSON.stringify({ amount: Number(amount), date }), token })
      toast('success', t.pay_receipt_confirm_ok)
      loadAll()
    } catch (e) { toast('error', e instanceof Error ? e.message : t.pay_receipt_err) }
    finally { setRcAction(null) }
  }

  async function rejectReceipt(r: Receipt) {
    setRcAction(r.id)
    try {
      await api(`/api/groups/${groupId}/receipts/${r.id}/reject`, { method: 'POST', token })
      toast('success', t.pay_receipt_reject_ok)
      loadAll()
    } catch (e) { toast('error', e instanceof Error ? e.message : t.pay_receipt_err) }
    finally { setRcAction(null) }
  }

  const fd = (r: string) => { const d = new Date(r.split('T')[0]+'T00:00:00'); return `${d.getDate()}/${d.getMonth()+1}` }
  const pendingReceipts = receipts.filter(r => r.status === 'pending')
  const historyReceipts = receipts.filter(r => r.status !== 'pending')

  const statusBadge = (s: string) => {
    if (s === 'confirmed') return <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-bold text-brand"><CheckCircle2 className="h-3 w-3" />{t.pay_receipt_confirmed}</span>
    if (s === 'rejected') return <span className="inline-flex items-center gap-1 rounded-full bg-red-50 dark:bg-red-900/30 px-2 py-0.5 text-[10px] font-bold text-red-600 dark:text-red-400"><XCircle className="h-3 w-3" />{t.pay_receipt_rejected}</span>
    return <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400"><Loader2 className="h-3 w-3 animate-spin" />{t.pay_receipt_pending}</span>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="btn-ghost h-9 px-3 text-xs no-print">← {t.pay_back}</button>
        <div className="h-5 w-px bg-stone-200 dark:bg-slate-700" />
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand">{t.pay_title}</p>
          <p className="text-sm font-bold text-stone-800 dark:text-slate-200">{groupName} · {MO[month]} {year}</p>
        </div>
        <button onClick={() => window.print()} className="btn-ghost h-9 px-3 text-xs no-print" title={t.print_btn}><Printer className="h-3.5 w-3.5" /> {t.print_btn}</button>
      </div>

      {loading ? (
        <div className="glass-card p-8 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-[3px] border-stone-200 border-t-brand" />
        </div>
      ) : !summary ? (
        <div className="glass-card p-8 text-center text-stone-500">{t.pay_no_data}</div>
      ) : (
        <>
          {pendingReceipts.length > 0 && (
            <div className="glass-card overflow-hidden p-0">
              <div className="flex items-center gap-2 border-b border-stone-200/60 dark:border-slate-700 bg-gradient-to-r from-amber-50 to-amber-50/30 dark:from-amber-900/20 dark:to-slate-800 px-5 py-3.5">
                <Image className="h-4 w-4 text-amber-600" />
                <p className="text-sm font-bold text-stone-800 dark:text-slate-200">{t.pay_receipts_title}</p>
                <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">{pendingReceipts.length}</span>
              </div>
              <div className="divide-y divide-stone-100 dark:divide-slate-700">
                {pendingReceipts.map(r => (
                  <div key={r.id} className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center">
                    <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800">
                      {photos[r.id] ? <img src={photos[r.id]} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><Image className="h-5 w-5 text-stone-300 dark:text-slate-600" /></div>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-stone-800 dark:text-slate-200">{studentNameMap[r.student_id] || `#${r.student_id}`}</p>
                      <p className="mt-0.5 text-xs text-stone-500 dark:text-slate-400">{fd(r.created_at)} · Chek #{r.id}</p>
                      {r.note && <p className="mt-1 truncate text-xs text-stone-400 dark:text-slate-500">{r.note}</p>}
                      <div className="mt-2">{statusBadge(r.status)}</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <input value={rcAmounts[r.id] || ''} onChange={e => setRcAmounts(a => ({ ...a, [r.id]: e.target.value }))} type="number" placeholder={t.pay_receipt_amount_ph} className="input-premium h-9 w-32 text-xs" />
                      <input value={rcDates[r.id] || ''} onChange={e => setRcDates(a => ({ ...a, [r.id]: e.target.value }))} type="date" className="input-premium h-9 text-xs" />
                      <button type="button" onClick={() => confirmReceipt(r)} disabled={rcAction === r.id} className="btn-primary h-9 px-4 text-xs disabled:opacity-50"><CheckCircle2 className="h-3.5 w-3.5" /> {t.pay_receipt_confirm}</button>
                      <button type="button" onClick={() => rejectReceipt(r)} disabled={rcAction === r.id} className="btn-ghost h-9 px-3 text-xs text-red-600 hover:text-red-700 disabled:opacity-50"><XCircle className="h-3.5 w-3.5" /> {t.pay_receipt_reject}</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {historyReceipts.length > 0 && (
            <div className="glass-card overflow-hidden p-0">
              <div className="flex items-center gap-2 border-b border-stone-200/60 dark:border-slate-700 bg-gradient-to-r from-stone-50 to-stone-100/50 dark:from-slate-800 dark:to-slate-800/50 px-5 py-3.5">
                <Calendar className="h-4 w-4 text-stone-500 dark:text-slate-400" />
                <p className="text-sm font-bold text-stone-800 dark:text-slate-200">{t.pay_receipts_history}</p>
              </div>
              <div className="divide-y divide-stone-100 dark:divide-slate-700">
                {historyReceipts.map(r => (
                  <div key={r.id} className="flex flex-col gap-2 px-5 py-3 lg:flex-row lg:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-stone-800 dark:text-slate-200">{studentNameMap[r.student_id] || `#${r.student_id}`}</p>
                      <p className="mt-0.5 text-xs text-stone-500 dark:text-slate-400">{fd(r.created_at)} · Chek #{r.id}</p>
                    </div>
                    <p className="text-sm font-bold text-brand">{r.amount ? `${r.amount.toLocaleString()} so'm` : '—'}</p>
                    {statusBadge(r.status)}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-4 stagger-fade-in sm:grid-cols-3">
            <div className="stat-card hover-glow hover:-translate-y-1">
              <TrendingUp className="h-5 w-5 text-brand" />
              <p className="mt-2 text-2xl font-bold text-stone-800 dark:text-slate-200">{summary.total_income.toLocaleString()} so'm</p>
              <p className="text-xs text-stone-500 dark:text-slate-400">{t.pay_total_income}</p>
            </div>
            <div className="stat-card hover-glow hover:-translate-y-1">
              <Users className="h-5 w-5 text-blue-600" />
              <p className="mt-2 text-2xl font-bold text-stone-800 dark:text-slate-200">{summary.student_count}</p>
              <p className="text-xs text-stone-500 dark:text-slate-400">{t.pay_student_count}</p>
            </div>
            <div className="stat-card hover-glow hover:-translate-y-1">
              <DollarSign className="h-5 w-5 text-amber-600" />
              <p className="mt-2 text-2xl font-bold text-stone-800 dark:text-slate-200">{summary.payments.length}</p>
              <p className="text-xs text-stone-500 dark:text-slate-400">{t.pay_total_payments}</p>
            </div>
          </div>

          <div className="glass-card overflow-hidden p-0">
            <div className="hidden grid-cols-[1fr_120px_100px_80px] border-b border-stone-200/60 dark:border-slate-700 bg-gradient-to-r from-stone-50 to-stone-100/50 dark:from-slate-800 dark:to-slate-800/50 px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-slate-400 lg:grid">
              <div>{t.pay_student}</div><div>{t.pay_date}</div><div>{t.pay_amount}</div><div>{t.pay_note}</div>
            </div>
            <div className="divide-y divide-stone-100 dark:divide-slate-700">
              {summary.payments.length === 0 ? (
                <div className="p-8 text-center text-sm text-stone-500">{t.pay_no_payments}</div>
              ) : summary.payments.map(p => {
                const rate = attRates[p.student_id]
                return (
                <div key={p.id} className="grid gap-2 px-5 py-4 transition-all hover:bg-stone-50/50 dark:hover:bg-slate-800/50 lg:grid-cols-[1fr_120px_100px_80px] lg:items-center">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-stone-800 dark:text-slate-200">{studentNameMap[p.student_id] || `#${p.student_id}`}</p>
                    {rate !== undefined && (
                      <div className="mt-1 flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-stone-100 dark:bg-slate-700">
                          <div className={`h-full rounded-full ${rate >= 80 ? 'bg-brand' : rate >= 50 ? 'bg-amber-400' : 'bg-red-500'}`} style={{ width: `${Math.min(rate, 100)}%` }} />
                        </div>
                        <span className={`text-[10px] font-semibold ${rate >= 80 ? 'text-brand' : rate >= 50 ? 'text-amber-600' : 'text-red-500'}`}>{Math.round(rate)}%</span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-stone-500 dark:text-slate-400">{fd(p.date)}</p>
                  <p className="text-sm font-bold text-brand">{p.amount.toLocaleString()} so'm</p>
                  <p className="text-xs text-stone-400 dark:text-slate-500">{p.note || '—'}</p>
                </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
