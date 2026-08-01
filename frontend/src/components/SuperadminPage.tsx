import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Shield, Users, Mail, Calendar, ShieldCheck, ShieldOff, Trash2, BookOpen, BarChart3, ToggleLeft, ToggleRight, Search, LogIn, XCircle, Activity } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { languages } from '../lib/i18n'
import { api } from '../lib/api'
import { useToast } from '../lib/toast'
import { getAvatarStyle } from '../lib/utils'
import ConfirmModal from './ConfirmModal'

type User = { id: number; email: string; username: string | null; full_name: string; is_active: boolean; is_superuser: boolean; group_count: number; created_at: string }
type LoginStats = { total: number; success: number; failed: number; today: number }
type LoginLog = { id: number; user_id: number | null; email: string | null; ip: string | null; user_agent: string | null; success: boolean; created_at: string }

type Props = { token: string; onBack: () => void; lang?: string }

export default function SuperadminPage({ token, onBack, lang: l }: Props) {
  const t = languages[(l || 'uz') as keyof typeof languages] || languages.uz
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [updating, setUpdating] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)
  const [loginStats, setLoginStats] = useState<LoginStats | null>(null)
  const [loginLogs, setLoginLogs] = useState<LoginLog[]>([])
  const { toast } = useToast()

  function load() {
    setLoading(true)
    api<User[]>('/api/superadmin/users', { token })
      .then(setUsers)
      .catch(() => toast('error', 'Yuklanmadi'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [token])

  useEffect(() => {
    api<LoginStats>('/api/superadmin/login-stats', { token }).then(setLoginStats).catch(() => setLoginStats(null))
    api<LoginLog[]>('/api/superadmin/login-logs?limit=100', { token }).then(setLoginLogs).catch(() => setLoginLogs([]))
  }, [token])

  const chartData = useMemo(() => {
    const dayMap = new Map<string, { date: string; ok: number; fail: number }>()
    const today = new Date()
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i)
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      dayMap.set(k, { date: k.slice(5), ok: 0, fail: 0 })
    }
    for (const log of loginLogs) {
      const k = (log.created_at || '').slice(0, 10)
      const entry = dayMap.get(k)
      if (!entry) continue
      if (log.success) entry.ok += 1; else entry.fail += 1
    }
    return Array.from(dayMap.values())
  }, [loginLogs])

  const filtered = users.filter(u =>
    u.full_name.toLowerCase().includes(q.toLowerCase()) ||
    u.email.toLowerCase().includes(q.toLowerCase()) ||
    (u.username && u.username.toLowerCase().includes(q.toLowerCase()))
  )

  const totalUsers = users.length
  const activeUsers = users.filter(u => u.is_active).length
  const superusers = users.filter(u => u.is_superuser).length

  async function toggleSuperuser(u: User) {
    setUpdating(u.id)
    try {
      await api(`/api/superadmin/users/${u.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_superuser: !u.is_superuser }),
        token,
      })
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, is_superuser: !x.is_superuser } : x))
      toast('success', !u.is_superuser ? 'Superuser qilindi' : 'Superuser olib tashlandi')
    } catch { toast('error', 'Xatolik') }
    finally { setUpdating(null) }
  }

  async function toggleActive(u: User) {
    setUpdating(u.id)
    try {
      await api(`/api/superadmin/users/${u.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !u.is_active }),
        token,
      })
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, is_active: !x.is_active } : x))
      toast('success', u.is_active ? 'Bloklandi' : 'Faollashtirildi')
    } catch { toast('error', 'Xatolik') }
    finally { setUpdating(null) }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await api(`/api/superadmin/users/${deleteTarget.id}`, { method: 'DELETE', token })
      setUsers(prev => prev.filter(x => x.id !== deleteTarget.id))
      toast('success', "O'chirildi")
    } catch (e) { toast('error', e instanceof Error ? e.message : "O'chirilmadi") }
    finally { setDeleteTarget(null) }
  }

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-slate-900">
      <header className="glass-nav sticky top-0 z-30">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 lg:px-6">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="btn-ghost h-9 px-3 text-xs">← {t.sp_back}</button>
            <div className="h-5 w-px bg-stone-200 dark:bg-slate-700" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-brand">{t.sp_title}</p>
              <p className="text-sm font-bold text-stone-800 dark:text-slate-200">{t.sp_users}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 pt-8 pb-14 lg:px-6">
        <div className="mb-6 grid gap-4 stagger-fade-in sm:grid-cols-3">
          <div className="stat-card border-l-[3px] border-l-brand hover-glow hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-brand">{t.sp_users}</p>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-soft-2 shadow-sm"><Users className="h-4 w-4 text-brand" /></div>
            </div>
            <p className="mt-2 text-3xl font-bold text-stone-800 dark:text-slate-200">{totalUsers}</p>
            <div className="mt-1 flex items-center gap-1 text-xs text-brand"><BarChart3 className="h-3 w-3" /> {t.sp_total.replace('{n}', String(totalUsers))}</div>
          </div>
          <div className="stat-card border-l-[3px] border-l-blue-500 hover-glow hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">{t.am_filter_active}</p>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/50 shadow-sm"><ShieldCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" /></div>
            </div>
            <p className="mt-2 text-3xl font-bold text-stone-800 dark:text-slate-200">{activeUsers}</p>
            <div className="mt-1 flex items-center gap-1 text-xs text-blue-600"><BarChart3 className="h-3 w-3" /> Aktiv</div>
          </div>
          <div className="stat-card border-l-[3px] border-l-amber-500 hover-glow hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">Superuser</p>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/50 shadow-sm"><Shield className="h-4 w-4 text-amber-600 dark:text-amber-400" /></div>
            </div>
            <p className="mt-2 text-3xl font-bold text-stone-800 dark:text-slate-200">{superusers}</p>
            <div className="mt-1 flex items-center gap-1 text-xs text-amber-600"><BarChart3 className="h-3 w-3" /> Adminlar</div>
          </div>
        </div>

        <div className="mb-8">
          <div className="mb-4 flex items-center gap-2">
            <Activity className="h-4 w-4 text-brand" />
            <p className="text-sm font-bold text-stone-800 dark:text-slate-200">{t.sp_login_stats}</p>
          </div>
          <div className="grid gap-4 stagger-fade-in sm:grid-cols-2 lg:grid-cols-4">
            <div className="stat-card border-l-[3px] border-l-stone-500 hover-glow hover:-translate-y-1">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">{t.sp_login_total}</p>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-100 dark:bg-slate-700 shadow-sm"><LogIn className="h-4 w-4 text-stone-600 dark:text-slate-300" /></div>
              </div>
              <p className="mt-2 text-3xl font-bold text-stone-800 dark:text-slate-200">{loginStats?.total ?? '—'}</p>
            </div>
            <div className="stat-card border-l-[3px] border-l-brand hover-glow hover:-translate-y-1">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-brand">{t.sp_login_success}</p>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-soft-2 shadow-sm"><ShieldCheck className="h-4 w-4 text-brand" /></div>
              </div>
              <p className="mt-2 text-3xl font-bold text-stone-800 dark:text-slate-200">{loginStats?.success ?? '—'}</p>
            </div>
            <div className="stat-card border-l-[3px] border-l-rose-500 hover-glow hover:-translate-y-1">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-rose-500">{t.sp_login_failed}</p>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100 dark:bg-rose-900/50 shadow-sm"><XCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" /></div>
              </div>
              <p className="mt-2 text-3xl font-bold text-stone-800 dark:text-slate-200">{loginStats?.failed ?? '—'}</p>
            </div>
            <div className="stat-card border-l-[3px] border-l-blue-500 hover-glow hover:-translate-y-1">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">{t.sp_login_today}</p>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/50 shadow-sm"><Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" /></div>
              </div>
              <p className="mt-2 text-3xl font-bold text-stone-800 dark:text-slate-200">{loginStats?.today ?? '—'}</p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="glass-card p-5">
              <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-slate-400">{t.sp_login_chart}</p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} barGap={2}>
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#94a3b8" tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} stroke="#94a3b8" tickLine={false} axisLine={false} width={24} />
                    <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="ok" name={t.sp_login_success} fill="#059669" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="fail" name={t.sp_login_failed} fill="#f43f5e" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-stone-200/60 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg shadow-stone-900/5">
              <p className="border-b border-stone-200/60 dark:border-slate-700 px-5 py-4 text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-slate-400">{t.sp_login_recent}</p>
              <div className="max-h-72 divide-y divide-stone-100 dark:divide-slate-700 overflow-y-auto">
                {loginLogs.length === 0 ? (
                  <div className="p-10 text-center text-sm text-stone-500">{t.sp_login_empty}</div>
                ) : loginLogs.slice(0, 12).map((log) => (
                  <div key={log.id} className="flex items-center gap-3 px-5 py-3">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${log.success ? 'bg-brand-soft-2' : 'bg-rose-100 dark:bg-rose-900/50'}`}>
                      {log.success ? <LogIn className="h-3.5 w-3.5 text-brand" /> : <XCircle className="h-3.5 w-3.5 text-rose-500 dark:text-rose-400" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-stone-800 dark:text-slate-200">{log.email || '—'}</p>
                      <p className="truncate text-[11px] text-stone-500 dark:text-slate-400">{log.ip || '—'} · {(log.created_at || '').slice(0, 16).replace('T', ' ')}</p>
                    </div>
                    <span className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-semibold ${log.success ? 'bg-brand-soft text-brand' : 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400'}`}>
                      {log.success ? t.sp_login_success : t.sp_login_failed}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-11 flex-1 items-center gap-3 rounded-2xl border border-stone-200/60 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 px-5 shadow-sm transition-all focus-within:border-brand focus-within:shadow-xl focus-within:shadow-brand focus-within:ring-2 focus-within:ring-brand">
            <Search className="h-4 w-4 shrink-0 text-stone-400 dark:text-slate-500" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder={t.am_search} className="h-full w-full bg-transparent text-sm outline-none dark:text-slate-200" />
          </div>
        </div>

        {loading ? (
          <div className="glass-card divide-y divide-stone-100 dark:divide-slate-700">
            {[1,2,3].map(i => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 animate-pulse">
                <div className="h-10 w-10 rounded-xl bg-stone-200 dark:bg-slate-700" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-40 rounded bg-stone-200 dark:bg-slate-700" />
                  <div className="h-2 w-24 rounded bg-stone-100 dark:bg-slate-800" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-stone-200/60 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg shadow-stone-900/5">
            <div className="hidden grid-cols-[1fr_120px_80px_100px_80px_80px] border-b border-stone-200/60 dark:border-slate-700 bg-gradient-to-r from-stone-50 to-stone-100/50 dark:from-slate-800 dark:to-slate-800/50 px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-slate-400 lg:grid">
              <div>{t.sp_users}</div>
              <div>Username</div>
              <div>{t.sp_active}</div>
              <div>{t.dash_groups}</div>
              <div>Superuser</div>
              <div />
            </div>
            <div className="divide-y divide-stone-100 dark:divide-slate-700">
              {filtered.length === 0 ? (
                <div className="p-12 text-center text-sm text-stone-500">{t.am_no_results}</div>
              ) : filtered.map(u => (
                <div key={u.id} className="group grid gap-3 px-5 py-4 transition-all hover:bg-stone-50/50 dark:hover:bg-slate-800/50 lg:grid-cols-[1fr_120px_80px_100px_80px_80px] lg:items-center">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${getAvatarStyle(u.full_name).gradient} text-base font-bold text-white shadow-sm`}>
                      {u.full_name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-stone-800 dark:text-slate-200">{u.full_name}</p>
                        {u.is_superuser && <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
                        {!u.is_active && <span className="shrink-0 rounded bg-red-50 dark:bg-red-900/30 px-1.5 py-0.5 text-[10px] font-medium text-red-500">{t.sp_blocked}</span>}
                      </div>
                      <p className="truncate text-xs text-stone-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <Mail className="h-3 w-3 shrink-0" /> {u.email}
                      </p>
                    </div>
                  </div>
                  <div className="text-xs text-stone-500 dark:text-slate-400">
                    {u.username || <span className="text-stone-300 dark:text-slate-600">—</span>}
                  </div>
                  <div>
                    <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg ${u.is_active ? 'bg-brand-soft text-brand' : 'bg-red-50 dark:bg-red-900/30 text-red-600'}`}>
                      {u.is_active ? t.sp_active : t.sp_inactive}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-slate-400">
                    <BookOpen className="h-3 w-3" /> {u.group_count}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => toggleSuperuser(u)} disabled={updating === u.id}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-all ${u.is_superuser ? 'border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 text-amber-600' : 'border-stone-200 dark:border-slate-600 text-stone-400 hover:border-amber-200 hover:text-amber-600'}`}
                      title={u.is_superuser ? "Superuser olib tashlash" : "Superuser qilish"}>
                      {u.is_superuser ? <ShieldCheck className="h-4 w-4" /> : <ShieldOff className="h-4 w-4" />}
                    </button>
                    <button onClick={() => toggleActive(u)} disabled={updating === u.id}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-all ${u.is_active ? 'border-stone-200 dark:border-slate-600 text-stone-400 hover:text-amber-600' : 'border-brand bg-brand-soft text-brand'}`}
                      title={u.is_active ? 'Bloklash' : 'Faollashtirish'}>
                      {u.is_active ? <ToggleLeft className="h-4 w-4" /> : <ToggleRight className="h-4 w-4" />}
                    </button>
                    <button onClick={() => setDeleteTarget(u)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 dark:border-slate-600 text-stone-400 transition-all hover:border-red-200 hover:text-red-500"
                      title={t.nav_delete}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!deleteTarget}
        title={t.am_confirm_delete_student}
        message={`${deleteTarget?.full_name} (${deleteTarget?.email}) foydalanuvchisini va uning barcha guruhlari, o'quvchilari, davomatlari va to'lovlarini o'chirasizmi?`}
        danger
        confirmLabel={t.am_confirm_delete_label}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}