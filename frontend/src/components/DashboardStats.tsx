import { useEffect, useState } from 'react'
import { Activity, TrendingUp, Users, Wallet } from 'lucide-react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../lib/api'
import { languages } from '../lib/i18n'

type MonthTotal = { month: string; total: number }
type MonthRate = { month: string; rate: number }
type GroupStat = { id: number; name: string; student_count: number; attendance_rate: number }
type StudentStat = { id: number; group_id: number; full_name: string; present: number; absent: number; excused: number; attendance_rate: number }
type StatsData = {
  total_students: number
  month_payments: number
  month_attendance_rate: number
  payments_by_month: MonthTotal[]
  attendance_by_month: MonthRate[]
  groups: GroupStat[]
  students: StudentStat[]
}

const EMPTY: StatsData = {
  total_students: 0, month_payments: 0, month_attendance_rate: 0,
  payments_by_month: [], attendance_by_month: [], groups: [], students: [],
}

const MONTH_SHORT: Record<string, string[]> = {
  uz: ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'],
  ru: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
}

function monthLabel(month: string, lang: string): string {
  const parts = month.split('-')
  const idx = Number(parts[1]) - 1
  const names = MONTH_SHORT[lang] || MONTH_SHORT.uz
  return names[idx] ?? month
}

function ringColor(rate: number): string {
  return rate >= 80 ? '#10b981' : rate >= 50 ? '#f59e0b' : '#f43f5e'
}

function ProgressRing({ value, size = 52, stroke = 5 }: { value: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const color = ringColor(value)
  const clamped = Math.min(Math.max(value, 0), 100)
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-stone-200 dark:stroke-slate-700" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (c * clamped) / 100}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold" style={{ color }}>{Math.round(clamped)}%</span>
    </div>
  )
}

function formatMoney(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (v >= 1_000) return `${Math.round(v / 1000)}k`
  return String(v)
}

function SkeletonCards() {
  return (
    <div className="mb-8 grid gap-4 sm:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-[110px] animate-pulse rounded-2xl bg-stone-100 dark:bg-slate-800/70" />
      ))}
    </div>
  )
}

export default function DashboardStats({ token, lang }: { token: string; lang?: string }) {
  const t = languages[(lang || 'uz') as keyof typeof languages] || languages.uz
  const [data, setData] = useState<StatsData | null>(null)

  useEffect(() => {
    let alive = true
    api<StatsData>('/stats', { token })
      .then((d) => { if (alive) setData(d) })
      .catch(() => { if (alive) setData(null) })
    return () => { alive = false }
  }, [token])

  if (data === null) return <SkeletonCards />

  const stats = data ?? EMPTY
  const barFill = ['#10b981', '#34d399']

  return (
    <>
      <div className="mb-8 grid gap-4 stagger-fade-in sm:grid-cols-3">
        <div className="stat-card border-l-[3px] border-l-brand hover-glow hover:-translate-y-1">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand">{t.dash_month_payments}</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-soft-2 shadow-sm"><Wallet className="h-4 w-4 text-brand" /></div>
          </div>
          <p className="mt-2 text-3xl font-bold text-stone-800 dark:text-slate-200">{stats.month_payments.toLocaleString()} <span className="text-sm font-semibold text-stone-400 dark:text-slate-500">so'm</span></p>
          <div className="mt-1 flex items-center gap-1 text-xs text-brand"><TrendingUp className="h-3 w-3" /> {t.dash_this_month}</div>
          {stats.payments_by_month.length > 0 && (
            <div className="pointer-events-none mt-2 h-8 -mx-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.payments_by_month} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                  <Bar dataKey="total" radius={[3, 3, 0, 0]}>
                    {stats.payments_by_month.map((_, i) => <Cell key={i} fill={barFill[i % 2]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div className="stat-card border-l-[3px] border-l-amber-400 hover-glow hover:-translate-y-1">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">{t.dash_total_students}</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/50 shadow-sm"><Users className="h-4 w-4 text-amber-600 dark:text-amber-400" /></div>
          </div>
          <p className="mt-2 text-3xl font-bold text-stone-800 dark:text-slate-200">{stats.total_students}</p>
          <div className="mt-1 flex items-center gap-1 text-xs text-amber-600"><Users className="h-3 w-3" /> {t.dash_students_total}</div>
        </div>
        <div className="stat-card border-l-[3px] border-l-rose-400 hover-glow hover:-translate-y-1">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-rose-600">{t.dash_attendance_rate}</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100 dark:bg-rose-900/50 shadow-sm"><Activity className="h-4 w-4 text-rose-600 dark:text-rose-400" /></div>
          </div>
          <p className="mt-2 text-3xl font-bold text-stone-800 dark:text-slate-200">{Math.round(stats.month_attendance_rate)}%</p>
          <div className="mt-1 flex items-center gap-1 text-xs text-rose-600"><TrendingUp className="h-3 w-3" /> {t.dash_this_month}</div>
        </div>
      </div>

      {(stats.payments_by_month.length > 0 || stats.attendance_by_month.length > 0) && (
        <div className="mb-8 grid gap-4 page-scale-enter lg:grid-cols-2">
          <div className="rounded-2xl border border-stone-200/60 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 p-5 shadow-sm card-shine">
            <p className="mb-4 text-sm font-bold text-stone-800 dark:text-slate-200">{t.dash_payments_chart}</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.payments_by_month} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(168,162,158,0.2)" vertical={false} />
                <XAxis dataKey="month" tickFormatter={(m: string) => monthLabel(m, lang || 'uz')} tick={{ fontSize: 11, fill: '#a8a29e' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v: number) => formatMoney(v)} tick={{ fontSize: 11, fill: '#a8a29e' }} axisLine={false} tickLine={false} width={44} />
                <Tooltip
                  cursor={{ fill: 'rgba(16,185,129,0.08)' }}
                  formatter={(v) => [`${Number(v).toLocaleString()} so'm`, t.dash_month_payments]}
                  labelFormatter={(m) => monthLabel(String(m), lang || 'uz')}
                  contentStyle={{ borderRadius: 12, border: '1px solid rgba(168,162,158,0.3)', fontSize: 12, background: 'rgba(255,255,255,0.95)' }}
                />
                <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                  {stats.payments_by_month.map((_, i) => <Cell key={i} fill={barFill[i % 2]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="rounded-2xl border border-stone-200/60 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 p-5 shadow-sm card-shine">
            <p className="mb-4 text-sm font-bold text-stone-800 dark:text-slate-200">{t.dash_attendance_chart}</p>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={stats.attendance_by_month} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
                <defs>
                  <linearGradient id="attGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(168,162,158,0.2)" vertical={false} />
                <XAxis dataKey="month" tickFormatter={(m: string) => monthLabel(m, lang || 'uz')} tick={{ fontSize: 11, fill: '#a8a29e' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11, fill: '#a8a29e' }} axisLine={false} tickLine={false} width={40} />
                <Tooltip
                  formatter={(v) => [`${Number(v)}%`, t.dash_attendance_rate]}
                  labelFormatter={(m) => monthLabel(String(m), lang || 'uz')}
                  contentStyle={{ borderRadius: 12, border: '1px solid rgba(168,162,158,0.3)', fontSize: 12, background: 'rgba(255,255,255,0.95)' }}
                />
                <Area type="monotone" dataKey="rate" stroke="#10b981" strokeWidth={2.5} fill="url(#attGrad)" dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="mb-8 grid gap-4 page-scale-enter lg:grid-cols-2">
        <div className="rounded-2xl border border-stone-200/60 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 p-5 shadow-sm card-shine">
          <p className="mb-4 text-sm font-bold text-stone-800 dark:text-slate-200">{t.dash_group_attendance}</p>
          {stats.groups.length === 0 ? (
            <p className="py-6 text-center text-sm text-stone-400 dark:text-slate-500">{t.dash_no_data}</p>
          ) : (
            <div className="space-y-3">
              {stats.groups.map((g) => (
                <div key={g.id} className="flex items-center gap-3">
                  <ProgressRing value={g.attendance_rate} size={44} stroke={4} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-stone-700 dark:text-slate-300">{g.name}</p>
                      <p className="shrink-0 text-xs text-stone-400 dark:text-slate-500">{g.student_count} o'quvchi</p>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-stone-100 dark:bg-slate-700">
                      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(g.attendance_rate, 100)}%`, background: ringColor(g.attendance_rate) }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-2xl border border-stone-200/60 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 p-5 shadow-sm card-shine">
          <p className="mb-4 text-sm font-bold text-stone-800 dark:text-slate-200">{t.dash_student_attendance}</p>
          {stats.students.length === 0 ? (
            <p className="py-6 text-center text-sm text-stone-400 dark:text-slate-500">{t.dash_no_data}</p>
          ) : (
            <div className="max-h-[320px] space-y-2.5 overflow-y-auto pr-1">
              {[...stats.students]
                .sort((a, b) => b.attendance_rate - a.attendance_rate)
                .map((s) => {
                  const group = stats.groups.find((g) => g.id === s.group_id)
                  return (
                    <div key={s.id} className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-stone-50 dark:hover:bg-slate-700/40">
                      <ProgressRing value={s.attendance_rate} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-stone-700 dark:text-slate-300">{s.full_name}</p>
                        <p className="truncate text-xs text-stone-400 dark:text-slate-500">{group?.name ?? ''} · {s.present} ✓ / {s.absent} ✗ / {s.excused} •</p>
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
