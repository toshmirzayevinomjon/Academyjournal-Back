import { useEffect, useRef, useState } from 'react'
import { Archive, Bell, Globe, GraduationCap, LayoutDashboard, LogOut, Menu, Moon, Palette, Pencil, Plus, Search, Settings, Shield, Sun, Trash2, Users, X, Maximize2, Minimize2 } from 'lucide-react'
import { languages } from '../lib/i18n'
import { getAvatarStyle } from '../lib/utils'
import { api } from '../lib/api'

type Group = { id: number; name: string; days_of_week: string[]; lesson_time?: string | null; is_archived?: boolean; monthly_fee?: number }
type NotifItem = { student: string; groupId: number; groupName: string; paid: number; fee: number; remaining: number }
type SearchResult = {
  groups: Array<{ id: number; name: string }>
  students: Array<{ id: number; full_name: string; phone?: string | null; group_id: number; group_name: string }>
}
type Props = {
  groups: Group[]; selectedGroupId: number | null; onSelectGroup: (id: number) => void
  onNewGroup: () => void; onLogout: () => void; onSettings?: () => void
  userName?: string; darkMode?: boolean; onToggleDark?: () => void
  theme?: string; onThemeChange?: (t: string) => void
  compact?: boolean; onCompactToggle?: () => void
  showArchived?: boolean; onToggleArchived?: () => void
  isSuperuser?: boolean; onAdmin?: () => void
  onEditGroup?: (g: Group) => void; onDeleteGroup?: (g: Group) => void; onArchiveGroup?: (g: Group) => void
  token?: string; onNavigate?: (path: string) => void
  lang?: string; currentPath?: string; onLanguageChange?: (l: string) => void
}

export default function Navbar({ groups, selectedGroupId, onSelectGroup, onNewGroup, onLogout, onSettings, userName, darkMode, onToggleDark, theme, onThemeChange, compact, onCompactToggle, showArchived, onToggleArchived, isSuperuser, onAdmin, onEditGroup, onDeleteGroup, onArchiveGroup, token, onNavigate, lang: l, currentPath, onLanguageChange }: Props) {
  const t = languages[(l || 'uz') as keyof typeof languages] || languages.uz
  const [mobileOpen, setMobileOpen] = useState(false)
  const [sq, setSq] = useState('')
  const [sres, setSres] = useState<SearchResult | null>(null)
  const [sOpen, setSOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const bellRef = useRef<HTMLDivElement>(null)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notif, setNotif] = useState<NotifItem[] | null>(null)
  const [notifLoading, setNotifLoading] = useState(false)

  function fmtSum(n: number) { return `${n.toLocaleString('ru-RU')} so'm` }

  async function loadNotifs() {
    if (notif || !token) return
    setNotifLoading(true)
    const now = new Date()
    try {
      const items: NotifItem[] = []
      for (const g of groups) {
        const [students, payments] = await Promise.all([
          api<Array<{ id: number; full_name: string }>>(`/api/groups/${g.id}/students`, { token }),
          api<Array<{ student_id: number; amount: number }>>(`/api/groups/${g.id}/payments?year=${now.getFullYear()}&month=${now.getMonth() + 1}`, { token }),
        ])
        const fee = g.monthly_fee || 0
        if (!fee) continue
        const paidByStudent = new Map<number, number>()
        for (const p of payments) paidByStudent.set(p.student_id, (paidByStudent.get(p.student_id) || 0) + p.amount)
        for (const s of students) {
          const paid = paidByStudent.get(s.id) || 0
          if (paid < fee) items.push({ student: s.full_name, groupId: g.id, groupName: g.name, paid, fee, remaining: fee - paid })
        }
      }
      setNotif(items)
    } catch { setNotif([]) }
    finally { setNotifLoading(false) }
  }

  useEffect(() => {
    const q = sq.trim()
    if (!q || !token) { setSres(null); return }
    const h = setTimeout(() => {
      api<SearchResult>(`/search?q=${encodeURIComponent(q)}`, { token }).then(setSres).catch(() => setSres(null))
    }, 300)
    return () => clearTimeout(h)
  }, [sq, token])

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target as Node
      if (boxRef.current && !boxRef.current.contains(target)) setSOpen(false)
      if (bellRef.current && !bellRef.current.contains(target)) setNotifOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  function goSearch() { const q = sq.trim(); if (q && onNavigate) { onNavigate(`/search?q=${encodeURIComponent(q)}`); setSOpen(false) } }

  return (
    <>
      <header className="glass-nav sticky top-0 z-30">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 lg:px-6">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl gradient-brand shadow-lg shadow-brand group/logo">
              <GraduationCap className="h-5 w-5 text-white relative z-10" />
              <div className="absolute inset-0 rounded-xl gradient-brand opacity-0 group-hover/logo:opacity-100 blur-sm transition-all duration-500" />
              <div className="absolute inset-0 rounded-xl bg-white/10 opacity-0 group-hover/logo:opacity-100 scale-150 transition-all duration-700" />
            </div>
            <div>
              <p className="text-sm font-bold gradient-brand-r bg-clip-text text-transparent">Kundalik</p>
              <p className="text-[10px] font-medium tracking-wider text-stone-400 dark:text-slate-500 uppercase">{t.nav_app_subtitle}</p>
            </div>
          </div>

          <div className="hidden items-center gap-2 lg:flex">
            {token && onNavigate && (
              <div className="relative" ref={boxRef}>
                <div className="flex h-9 w-56 items-center gap-2 rounded-xl border border-stone-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 px-3 shadow-sm transition-all focus-within:border-brand focus-within:ring-2 focus-within:ring-brand">
                  <Search className="h-3.5 w-3.5 shrink-0 text-stone-400 dark:text-slate-500" />
                  <input value={sq} onChange={(e) => { setSq(e.target.value); setSOpen(true) }} onFocus={() => setSOpen(true)}
                    onKeyDown={(e) => { if (e.key === 'Enter') goSearch() }}
                    placeholder={t.nav_search} className="h-full w-full bg-transparent text-xs text-stone-700 dark:text-slate-200 outline-none placeholder:text-stone-400 dark:placeholder:text-slate-500" />
                </div>
                {sOpen && sq.trim() && (
                  <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-2xl shadow-stone-900/10 dark:shadow-black/40">
                    {!sres ? (
                      <div className="space-y-2 p-4">
                        <div className="h-3 w-24 animate-pulse rounded bg-stone-100 dark:bg-slate-700" />
                        <div className="h-8 animate-pulse rounded-lg bg-stone-50 dark:bg-slate-700/60" />
                        <div className="h-8 animate-pulse rounded-lg bg-stone-50 dark:bg-slate-700/60" />
                      </div>
                    ) : sres.groups.length === 0 && sres.students.length === 0 ? (
                      <div className="p-6 text-center">
                        <Search className="mx-auto h-6 w-6 text-stone-300 dark:text-slate-600" />
                        <p className="mt-2 text-xs font-medium text-stone-500 dark:text-slate-400">{t.nav_search_empty}</p>
                      </div>
                    ) : (
                      <div className="max-h-80 overflow-y-auto p-2">
                        {sres.groups.length > 0 && (
                          <div className="mb-1 px-2 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-stone-400 dark:text-slate-500">{t.nav_search_groups}</div>
                        )}
                        {sres.groups.map((g) => (
                          <button key={`g-${g.id}`} type="button" onClick={() => { onNavigate(`/groups/${g.id}`); setSOpen(false); setSq('') }}
                            className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm font-medium text-stone-700 dark:text-slate-300 transition-colors hover:bg-brand-soft dark:hover:bg-brand-soft">
                            <span className={`flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br ${getAvatarStyle(g.name).gradient} text-[10px] font-bold text-white`}>{g.name.slice(0, 1)}</span>
                            <span className="truncate">{g.name}</span>
                          </button>
                        ))}
                        {sres.students.length > 0 && (
                          <div className="mb-1 mt-2 px-2 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-stone-400 dark:text-slate-500">{t.nav_search_students}</div>
                        )}
                        {sres.students.map((s) => (
                          <button key={`s-${s.id}`} type="button" onClick={() => { onNavigate(`/groups/${s.group_id}`); setSOpen(false); setSq('') }}
                            className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-brand-soft dark:hover:bg-brand-soft">
                            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${getAvatarStyle(s.full_name).gradient} text-[10px] font-bold text-white`}>{s.full_name.slice(0, 1)}</span>
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium text-stone-700 dark:text-slate-300">{s.full_name}</span>
                              <span className="block truncate text-[10px] text-stone-400 dark:text-slate-500">{s.group_name}{s.phone ? ` · ${s.phone}` : ''}</span>
                            </span>
                          </button>
                        ))}
                        <button type="button" onClick={goSearch} className="mt-1.5 w-full rounded-xl bg-stone-50 dark:bg-slate-700/60 px-3 py-2 text-center text-xs font-semibold text-brand transition-colors hover:bg-brand-soft dark:hover:bg-brand-soft">
                          {t.search_all_results} →
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {onCompactToggle && (
              <button onClick={onCompactToggle} className="btn-ghost h-9 w-9 p-0 group relative" title={compact ? t.nav_wide : t.nav_compact}>
                {compact ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
                <span className="tooltip">{compact ? t.nav_wide : t.nav_compact}</span>
              </button>
            )}
            {onToggleArchived && (
              <button onClick={onToggleArchived} className={`btn-ghost h-9 px-3 text-xs ${showArchived ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-400' : ''}`}>
                <Archive className="h-3.5 w-3.5" /> {showArchived ? t.nav_all : t.nav_archived}
              </button>
            )}
            {onAdmin && (
              <button onClick={onAdmin} className="btn-ghost h-9 px-3 text-xs">
                <Shield className="h-3.5 w-3.5" /> {t.nav_admin}
              </button>
            )}
            {onThemeChange && (
              <div className="group relative">
                <button className="btn-ghost h-9 w-9 p-0"><Palette className="h-4 w-4" /></button>
                <span className="tooltip">{t.nav_theme}</span>
                <div className="invisible group-hover:visible opacity-0 group-hover:opacity-100 absolute top-full right-0 mt-2 flex w-[104px] flex-wrap gap-1.5 rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 shadow-xl transition-all duration-200 z-50">
                  {[
                    { v: '', g: 'linear-gradient(135deg, #059669, #0d9488)' },
                    { v: 'theme-blue', g: 'linear-gradient(135deg, #2563eb, #0891b2)' },
                    { v: 'theme-purple', g: 'linear-gradient(135deg, #7c3aed, #a21caf)' },
                    { v: 'theme-rose', g: 'linear-gradient(135deg, #e11d48, #db2777)' },
                    { v: 'theme-orange', g: 'linear-gradient(135deg, #ea580c, #d97706)' },
                    { v: 'theme-cyan', g: 'linear-gradient(135deg, #0891b2, #0e7490)' },
                    { v: 'theme-violet', g: 'linear-gradient(135deg, #6d28d9, #7c3aed)' },
                    { v: 'theme-pink', g: 'linear-gradient(135deg, #db2777, #be185d)' },
                    { v: 'theme-red', g: 'linear-gradient(135deg, #dc2626, #b91c1c)' },
                    { v: 'theme-lime', g: 'linear-gradient(135deg, #65a30d, #4d7c0f)' },
                    { v: 'theme-indigo', g: 'linear-gradient(135deg, #4f46e5, #6366f1)' },
                  ].map(({ v, g }) => (
                    <button key={v} onClick={() => onThemeChange(v)} className={`h-7 w-7 rounded-lg border-2 transition-all hover:scale-110 ${theme === v ? 'border-stone-900 dark:border-white scale-110' : 'border-transparent'}`}
                      style={{ background: g }}
                    />
                  ))}
                </div>
              </div>
            )}
            {onLanguageChange && (
              <div className="group relative">
                <button className="btn-ghost h-9 w-9 p-0"><Globe className="h-4 w-4" /></button>
                <span className="tooltip">{t.nav_lang}</span>
                <div className="invisible group-hover:visible opacity-0 group-hover:opacity-100 absolute top-full right-0 mt-2 flex min-w-[130px] flex-col gap-0.5 rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1.5 shadow-xl transition-all duration-200 z-50">
                  {Object.entries(languages).map(([k, v]) => (
                    <button key={k} onClick={() => onLanguageChange(k)} className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium transition-colors ${l === k ? 'bg-brand-soft text-brand' : 'text-stone-600 dark:text-slate-300 hover:bg-stone-50 dark:hover:bg-slate-700'}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${l === k ? 'bg-brand' : 'bg-stone-300 dark:bg-slate-600'}`} />
                      {v.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {onToggleDark && (
              <button onClick={onToggleDark} className="btn-ghost h-9 w-9 p-0 group relative" title={darkMode ? t.nav_dark_off : t.nav_dark_on}>
                {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                <span className="tooltip">{darkMode ? t.nav_dark_off : t.nav_dark_on}</span>
              </button>
            )}
            {onSettings && (
              <button onClick={onSettings} className="btn-ghost h-9 px-3 text-xs"><Settings className="h-3.5 w-3.5" /> {t.nav_settings}</button>
            )}
            <div className="relative" ref={bellRef}>
              <button onClick={() => { setNotifOpen(o => !o); if (!notifOpen) loadNotifs() }} className="btn-ghost h-9 w-9 p-0 group relative">
                <Bell className="h-4 w-4" />
                {notif && notif.length > 0 && <span className="notification-badge">{notif.length > 9 ? '9+' : notif.length}</span>}
                <span className="tooltip">{t.nav_notifications}</span>
              </button>
              {notifOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-2xl shadow-stone-900/10 dark:shadow-black/40 animate-in">
                  <div className="flex items-center justify-between border-b border-stone-100 dark:border-slate-700 px-4 py-3">
                    <p className="text-sm font-bold text-stone-800 dark:text-slate-200">{t.nav_notifications}</p>
                    {notif && notif.length > 0 && <span className="rounded-lg bg-rose-50 dark:bg-rose-900/30 px-2 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400">{notif.length}</span>}
                  </div>
                  <div className="max-h-80 overflow-y-auto p-2">
                    {notifLoading ? (
                      <div className="space-y-2 p-3">
                        <div className="h-12 animate-pulse rounded-xl bg-stone-100 dark:bg-slate-700/60" />
                        <div className="h-12 animate-pulse rounded-xl bg-stone-50 dark:bg-slate-700/40" />
                        <div className="h-12 animate-pulse rounded-xl bg-stone-50 dark:bg-slate-700/40" />
                      </div>
                    ) : notif && notif.length === 0 ? (
                      <div className="p-8 text-center">
                        <Bell className="mx-auto h-6 w-6 text-stone-300 dark:text-slate-600" />
                        <p className="mt-2 text-xs font-medium text-stone-500 dark:text-slate-400">{t.nav_notif_empty}</p>
                      </div>
                    ) : notif && notif.map((n, i) => (
                      <button key={i} type="button" onClick={() => { setNotifOpen(false); if (onNavigate) onNavigate(`/groups/${n.groupId}`) }}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-brand-soft dark:hover:bg-brand-soft">
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${getAvatarStyle(n.student).gradient} text-xs font-bold text-white`}>{n.student.slice(0, 1)}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-stone-800 dark:text-slate-200">{n.student}</span>
                          <span className="block truncate text-[11px] text-stone-500 dark:text-slate-400">{n.groupName} · {fmtSum(n.remaining)}</span>
                        </span>
                        <span className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-semibold ${n.paid === 0 ? 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400' : 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'}`}>
                          {n.paid === 0 ? t.nav_notif_unpaid : t.nav_notif_partial}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
              <button onClick={onNewGroup} className="hidden h-9 items-center gap-2 rounded-xl gradient-brand-r px-4 text-xs font-semibold text-white shadow-lg shadow-brand transition-all hover:-translate-y-0.5 hover:shadow-xl lg:inline-flex">
                  <Plus className="h-3.5 w-3.5" /> {t.nav_new_group}
                </button>
            <div className="flex h-9 items-center gap-2.5 rounded-xl bg-brand-soft px-4 text-sm font-medium text-brand-deep dark:text-brand shadow-sm ring-1 ring-brand">
              <div className="h-2.5 w-2.5 rounded-full gradient-brand-r status-pulse" />
              <span className="hidden sm:inline">{userName || t.nav_user}</span>
              <span className="sm:hidden">{userName ? userName.slice(0, 1).toUpperCase() : 'U'}</span>
            </div>
            <button onClick={onLogout} className="btn-ghost h-9 px-3 text-xs" title={t.nav_logout}>
              <LogOut className="h-3.5 w-3.5" /> {t.nav_logout}
            </button>
          </div>

          <button onClick={() => setMobileOpen(true)} className="btn-ghost h-9 w-9 p-0 lg:hidden"><Menu className="h-4 w-4" /></button>
        </div>

        {groups.length > 0 && (
          <div className="border-t border-stone-100 dark:border-slate-700/50 bg-stone-50/50 dark:bg-slate-800/50">
            <div className="mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto px-4 py-3 lg:px-6">
              <Users className="h-4 w-4 shrink-0 text-stone-400 dark:text-slate-500" />
              <div className="h-4 w-px bg-stone-200 dark:bg-slate-700" />
              {groups.map((group) => (
                <div key={group.id} className="relative group/chip">
                  <button onClick={() => onSelectGroup(group.id)}
                    className={`chip shrink-0 hover-lift ${selectedGroupId === group.id ? 'chip-active' : 'chip-inactive'}`}>
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${selectedGroupId === group.id ? 'bg-white/20 text-white' : getAvatarStyle(group.name).color + ' bg-stone-100 dark:bg-slate-700'}`}>
                      {group.name.slice(0, 1)}
                    </span>
                    <span className="truncate max-w-[100px]">{group.name}</span>
                    {group.is_archived && <Archive className="h-3 w-3 text-amber-500" />}
                  </button>
                  <div className="absolute -top-2 right-0 hidden gap-0.5 group-hover/chip:flex">
                    {onEditGroup && <button onClick={(e)=>{e.stopPropagation();onEditGroup(group)}} className="flex h-5 w-5 items-center justify-center rounded-full bg-white dark:bg-slate-700 border border-stone-200 dark:border-slate-600 text-stone-400 hover:text-brand shadow-sm transition-all" title={t.nav_edit}><Pencil className="h-3 w-3" /></button>}
                    {onArchiveGroup && <button onClick={(e)=>{e.stopPropagation();onArchiveGroup(group)}} className="flex h-5 w-5 items-center justify-center rounded-full bg-white dark:bg-slate-700 border border-stone-200 dark:border-slate-600 text-stone-400 hover:text-amber-600 shadow-sm transition-all" title={group.is_archived?t.nav_unarchive:t.nav_archive}><Archive className="h-3 w-3" /></button>}
                    {onDeleteGroup && <button onClick={(e)=>{e.stopPropagation();onDeleteGroup(group)}} className="flex h-5 w-5 items-center justify-center rounded-full bg-white dark:bg-slate-700 border border-stone-200 dark:border-slate-600 text-stone-400 hover:text-red-600 shadow-sm transition-all" title={t.nav_delete}><Trash2 className="h-3 w-3" /></button>}
                  </div>
                </div>
              ))}
              <button onClick={onNewGroup} className="chip-inactive chip border-dashed text-brand hover:border-brand hover:bg-brand-soft dark:hover:bg-brand-soft">
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </header>


      <nav className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-stone-200/70 dark:border-slate-700/70 bg-white/90 dark:bg-slate-900/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        <button onClick={() => onNavigate?.('/')} className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-semibold transition-colors ${currentPath === '/' ? 'text-brand' : 'text-stone-500 dark:text-slate-400'}`}>
          <LayoutDashboard className="h-[18px] w-[18px]" /> {t.nav_dashboard}
        </button>
        <button onClick={onNewGroup} className="flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-semibold text-stone-500 dark:text-slate-400 transition-colors">
          <Plus className="h-[18px] w-[18px]" /> {t.nav_new_group}
        </button>
        {onSettings && (
          <button onClick={onSettings} className="flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-semibold text-stone-500 dark:text-slate-400 transition-colors">
            <Settings className="h-[18px] w-[18px]" /> {t.nav_settings}
          </button>
        )}
        <button onClick={onLogout} className="flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-semibold text-red-500 transition-colors">
          <LogOut className="h-[18px] w-[18px]" /> {t.nav_logout}
        </button>
      </nav>

      {mobileOpen && (
        <div className="mobile-menu lg:hidden">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-brand">
                <GraduationCap className="h-5 w-5 text-white" />
              </div>
              <div><p className="text-sm font-bold text-stone-800 dark:text-slate-200">Kundalik</p><p className="text-[10px] text-stone-400 dark:text-slate-500 uppercase tracking-wider">{t.nav_app_subtitle}</p></div>
            </div>
            <button onClick={() => setMobileOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-100 dark:bg-slate-700"><X className="h-4 w-4" /></button>
          </div>

          <div className="flex items-center gap-3 rounded-xl bg-stone-50 dark:bg-slate-800 p-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand font-bold text-lg">
              {userName ? userName.slice(0, 1).toUpperCase() : 'U'}
            </div>
            <div><p className="text-sm font-semibold text-stone-800 dark:text-slate-200">{userName || t.nav_user}</p><p className="text-xs text-stone-500 dark:text-slate-400">{t.nav_panel}</p></div>
          </div>

          <nav className="space-y-1 flex-1">
            <button onClick={() => { setMobileOpen(false); onNewGroup() }} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-stone-700 dark:text-slate-300 hover:bg-brand-soft dark:hover:bg-brand-soft hover:text-brand transition-all">
              <Plus className="h-4 w-4" /> {t.nav_new_group}
            </button>
            {onToggleArchived && (
              <button onClick={() => { setMobileOpen(false); onToggleArchived() }} className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all ${showArchived ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-700' : 'text-stone-600 dark:text-slate-400 hover:bg-stone-50 dark:hover:bg-slate-800'}`}>
                <Archive className="h-4 w-4" /> {showArchived ? t.nav_all_groups : t.nav_archived_groups}
              </button>
            )}
            {onAdmin && (
              <button onClick={() => { setMobileOpen(false); onAdmin() }} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-stone-600 dark:text-slate-400 hover:bg-stone-50 dark:hover:bg-slate-800 transition-all">
                <Shield className="h-4 w-4" /> {t.nav_admin_panel}
              </button>
            )}
            {groups.map((g) => (
              <button key={g.id} onClick={() => { setMobileOpen(false); onSelectGroup(g.id) }}
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all ${
                  selectedGroupId === g.id ? 'bg-brand-soft text-brand' : 'text-stone-600 dark:text-slate-400 hover:bg-stone-50 dark:hover:bg-slate-800'
                }`}>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-stone-100 dark:bg-slate-700 text-xs font-bold">{g.name.slice(0, 1)}</span>
                {g.name}
              </button>
            ))}
          </nav>

          <div className="space-y-2 border-t border-stone-100 dark:border-slate-700 pt-4">
            {onToggleDark && (
              <button onClick={() => { onToggleDark(); setMobileOpen(false) }} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-stone-600 dark:text-slate-400 hover:bg-stone-50 dark:hover:bg-slate-800 transition-all">
                {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />} {darkMode ? t.nav_dark_off : t.nav_dark_on}
              </button>
            )}
            {onSettings && (
              <button onClick={() => { setMobileOpen(false); onSettings() }} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-stone-600 dark:text-slate-400 hover:bg-stone-50 dark:hover:bg-slate-800 transition-all">
                <Settings className="h-4 w-4" /> {t.nav_settings}
              </button>
            )}
            <button onClick={() => { setMobileOpen(false); onLogout() }} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all">
              <LogOut className="h-4 w-4" /> {t.nav_logout}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
