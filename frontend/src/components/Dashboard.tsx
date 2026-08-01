import { useMemo } from 'react'
import { Archive, ArrowUpRight, GraduationCap, Pencil, Plus, Printer, Sparkles, Trash2, X } from 'lucide-react'
import AttendanceMatrix from './AttendanceMatrix'
import AddGroupForm from './AddGroupForm'
import DashboardStats from './DashboardStats'
import SearchPage from './SearchPage'
import Navbar from './Navbar'
import { languages } from '../lib/i18n'
import { getAvatarStyle } from '../lib/utils'

type Group = { id: number; name: string; days_of_week: string[]; lesson_time?: string | null; is_archived?: boolean; monthly_fee?: number }

type Props = {
  groups: Group[]; selectedGroupId: number | null; onSelectGroup: (id: number) => void
  onNewGroup: () => void; onEditGroup: (group: Group) => void; onDeleteGroup: (group: Group) => void; onArchiveGroup: (group: Group) => void
  onLogout: () => void; onNavigate: (path: string) => void; currentPath: string
  profile: { id: number; email: string; full_name: string; is_superuser?: boolean } | null; token: string
  groupName: string; lessonTime: string; selectedDays: string[]; editingGroupId: number | null
  groupFee?: number | null; onGroupFeeChange?: (v: number) => void
  isGroupLoading: boolean; error?: string | null
  onSubmitGroup: (e: React.FormEvent<HTMLFormElement>) => void; onResetGroupForm: () => void
  onGroupNameChange: (v: string) => void; onLessonTimeChange: (v: string) => void
  onToggleDay: (day: string) => void
  submitNewGroup: (data: { name: string; days_of_week: string[]; lesson_time?: string | null }) => void
  darkMode: boolean; onToggleDark: () => void
  theme: string; onThemeChange: (t: string) => void
  compact: boolean; onCompactToggle: () => void
  showArchived?: boolean; onToggleArchived?: () => void
  lang?: string; onLanguageChange?: (l: string) => void
}

export default function Dashboard(props: Props) {
  const t = languages[(props.lang || 'uz') as keyof typeof languages] || languages.uz
  const {
    groups, selectedGroupId, onSelectGroup, onNewGroup, onEditGroup, onDeleteGroup, onArchiveGroup,
    onLogout, onNavigate, currentPath, profile, token,
    groupName, lessonTime, selectedDays, editingGroupId, isGroupLoading, error,
    groupFee, onGroupFeeChange,
    onSubmitGroup, onResetGroupForm, onGroupNameChange, onLessonTimeChange, onToggleDay, submitNewGroup,
    darkMode, onToggleDark, theme, onThemeChange, compact, onCompactToggle,
  } = props

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) ?? groups[0] ?? null
  const nav = { groups, selectedGroupId, onSelectGroup, onNewGroup, onLogout, onSettings: () => onNavigate('/settings'), userName: profile?.full_name, darkMode, onToggleDark, theme, onThemeChange, compact, onCompactToggle, showArchived: props.showArchived, onToggleArchived: props.onToggleArchived, isSuperuser: profile?.is_superuser, onAdmin: () => onNavigate('/admin'), onEditGroup, onDeleteGroup, onArchiveGroup, token, onNavigate, lang: props.lang, currentPath, onLanguageChange: props.onLanguageChange }

  if (currentPath === '/groups/new') {
    return (
      <div className="page-enter min-h-screen "><Navbar {...nav} />
        <div className="mx-auto max-w-xl px-4 pt-10 pb-28 lg:pb-14 lg:px-6">
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand">{t.dash_new}</p>
            <div className="mt-1 flex items-center justify-between">
              <h1 className="text-2xl font-bold text-stone-800 dark:text-slate-200">{t.dash_create_group}</h1>
              <button onClick={() => onNavigate('/')} className="btn-ghost h-9 px-3 text-xs"><X className="h-3.5 w-3.5" /> {t.dash_cancel}</button>
            </div>
          </div>
          <AddGroupForm onSubmit={submitNewGroup} loading={isGroupLoading} lang={props.lang} />
          {error && <div className="mt-4 animate-in rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/30 dark:border-red-800 px-5 py-3.5 text-sm text-red-700 dark:text-red-400 shadow-sm"><div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100 dark:bg-red-800"><span className="text-xs font-bold text-red-600 dark:text-red-400">!</span></div> {error}</div>}
        </div>
      </div>
    )
  }

  if (currentPath.startsWith('/groups/')) {
    const parts = currentPath.split('/'); const id = Number(parts[2]); const group = groups.find((g) => g.id === id)
    return (
      <div className="page-enter min-h-screen "><Navbar {...nav} />
        <div className="mx-auto max-w-7xl px-4 pt-6 pb-28 lg:pb-14 lg:px-6 page-enter">
          <div className="mb-6 flex flex-wrap items-center gap-4">
            <button onClick={() => onNavigate('/')} className="btn-ghost h-9 px-3 text-xs no-print">← {t.dash_back}</button>
            <div className="h-5 w-px bg-gradient-to-b from-transparent via-stone-300 dark:via-slate-600 to-transparent" />
            <div className="flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-brand">{t.dash_group}</p>
              <h1 className="text-lg font-bold text-stone-800 dark:text-slate-200">{group?.name ?? `${t.dash_group} #${id}`}</h1>
            </div>
            <div className="no-print flex gap-2">
              <button onClick={() => window.print()} className="btn-ghost h-9 px-3 text-xs" title={t.print_btn}><Printer className="h-3.5 w-3.5" /> {t.print_btn}</button>
              {group && <>
              <button onClick={() => onEditGroup(group)} className="btn-ghost h-9 px-3 text-xs"><Pencil className="h-3.5 w-3.5" /> {t.dash_edit}</button>
              <button onClick={() => onArchiveGroup(group)} className="btn-ghost h-9 px-3 text-xs"><Archive className="h-3.5 w-3.5" /> {group.is_archived ? t.dash_unarchive : t.dash_archive}</button>
              <button onClick={() => onDeleteGroup(group)} className="btn-ghost h-9 px-3 text-xs text-red-600 hover:text-red-700"><Trash2 className="h-3.5 w-3.5" /> {t.dash_delete}</button>
              </>}
            </div>
          </div>
          {group ? <AttendanceMatrix groupId={group.id} groupName={group.name} groupDays={group.days_of_week} groupFee={group.monthly_fee} token={token} lang={props.lang} />
          : <div className="card-glow flex flex-col items-center gap-5 p-16 text-center"><GraduationCap className="h-14 w-14 text-stone-300 dark:text-slate-600" /><p className="text-lg font-semibold text-stone-600 dark:text-slate-400">{t.dash_not_found}</p></div>}
        </div>
      </div>
    )
  }

  if (currentPath === '/search') {
    return (
      <div className="page-enter min-h-screen "><Navbar {...nav} />
        <div className="mx-auto max-w-3xl px-4 pt-10 pb-28 lg:pb-14 lg:px-6">
          <SearchPage token={token} lang={props.lang} onNavigate={onNavigate} />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen ">
      <Navbar {...nav} onSelectGroup={(id) => { onSelectGroup(id); onNavigate(`/groups/${id}`) }} />

      <div className="mx-auto max-w-7xl px-4 pt-8 pb-28 lg:pb-14 lg:px-6">
        <div className="relative mb-8 overflow-hidden rounded-3xl gradient-brand-dark p-6 text-white shadow-xl shadow-brand lg:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-brand-soft blur-3xl" />
          <div className="pointer-events-none absolute right-1/3 top-0 h-24 w-24 rounded-full bg-white/5 blur-xl" />
          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-white">{t.dash_dashboard}</p>
              <h1 className="mt-1.5 text-2xl font-bold lg:text-3xl">{t.dash_greeting.replace('{name}', profile?.full_name?.split(' ')[0] || t.nav_user)}</h1>
              <p className="mt-1.5 text-sm text-white/80">
                {new Date().toLocaleDateString(props.lang === 'ru' ? 'ru-RU' : props.lang === 'en' ? 'en-US' : 'uz-UZ', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-semibold backdrop-blur-sm">
                <Sparkles className="h-4 w-4 text-white" />
                {groups.length} {t.dash_groups}
              </span>
              {selectedGroup && (
                <span className="flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-semibold backdrop-blur-sm">
                  <GraduationCap className="h-4 w-4 text-white" />
                  {selectedGroup.name}
                </span>
              )}
            </div>
          </div>
        </div>

        {groups.length > 0 && <DashboardStats token={token} lang={props.lang} />}

        {editingGroupId && (() => { const eg = groups.find(g => g.id === editingGroupId); return (
          <div className="mb-8 animate-in overflow-hidden rounded-2xl border border-brand bg-brand-soft shadow-lg shadow-brand">
            <div className="flex items-center justify-between border-b border-brand px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-brand text-white text-xs font-bold shadow-md">✎</div>
                <div><p className="text-xs font-semibold uppercase tracking-wider text-brand">{t.dash_edit_panel}</p><p className="text-xs text-stone-500 dark:text-slate-400">{t.dash_edit_desc}</p></div>
              </div>
              <div className="flex items-center gap-2">
                {eg && <button type="button" onClick={() => onArchiveGroup(eg)} className="btn-ghost h-8 px-3 text-xs"><Archive className="h-3.5 w-3.5" /> {t.dash_archive}</button>}
                <button type="button" onClick={onResetGroupForm} className="btn-ghost h-8 px-3 text-xs"><X className="h-3.5 w-3.5" /> {t.dash_cancel}</button>
              </div>
            </div>
            <form onSubmit={onSubmitGroup} className="px-6 py-4">
              <div className="flex flex-wrap items-end gap-4">
                <div className="min-w-[220px] flex-1"><label className="mb-1.5 block text-xs font-medium text-stone-600 dark:text-slate-400">{t.dash_form_name}</label><input value={groupName} onChange={(e) => onGroupNameChange(e.target.value)} className="input-premium" required /></div>
                <div className="w-[130px]"><label className="mb-1.5 block text-xs font-medium text-stone-600 dark:text-slate-400">{t.dash_form_time}</label><input value={lessonTime} onChange={(e) => onLessonTimeChange(e.target.value)} type="time" className="input-premium" /></div>
                <div className="w-[150px]"><label className="mb-1.5 block text-xs font-medium text-stone-600 dark:text-slate-400">{t.group_fee}</label><input value={groupFee ?? ''} onChange={(e) => onGroupFeeChange?.(Number(e.target.value) || 0)} type="number" min="0" step="1000" className="input-premium" /></div>
                <div><label className="mb-1.5 block text-xs font-medium text-stone-600 dark:text-slate-400">{t.dash_form_days}</label>
                  <div className="flex gap-1">{['DU','SE','CH','PA','JU','SH','YA'].map((d,i)=>{const wd=['MON','TUE','WED','THU','FRI','SAT','SUN'];return(<button key={wd[i]} type="button" onClick={()=>onToggleDay(wd[i])} className={`flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold transition-all ${selectedDays.includes(wd[i])?'gradient-brand text-white shadow-md':'border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-stone-500 dark:text-slate-400 hover:border-brand dark:hover:border-brand hover:text-brand dark:hover:text-brand'}`}>{d}</button>)})}</div>
                </div>
                <button type="submit" disabled={isGroupLoading} className="btn-primary">{isGroupLoading ? t.dash_saving : t.dash_save}</button>
              </div>
            </form>
            {error && <div className="mx-6 mb-4 animate-in rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 px-5 py-3 text-sm text-red-700 dark:text-red-400 shadow-sm"><div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100 dark:bg-red-800"><span className="text-xs font-bold text-red-600 dark:text-red-400">!</span></div> {error}</div>}
          </div>
        )})()}

        {selectedGroup ? (
          <div className="page-scale-enter">
            <div className="mb-4 flex items-center justify-between rounded-2xl border border-stone-200/60 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 px-5 py-3 shadow-sm card-shine">
              <div className="flex items-center gap-3">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${getAvatarStyle(selectedGroup.name).gradient} text-white text-xs font-bold shadow-md`}>{selectedGroup.name.slice(0,1)}</div>
                <div>
                  <p className="text-sm font-bold text-stone-800 dark:text-slate-200">{selectedGroup.name}</p>
                  <p className="text-xs text-stone-500 dark:text-slate-400">{t.dash_days_per_week.replace('{n}', String(selectedGroup.days_of_week.length))}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => onEditGroup(selectedGroup)} className="btn-ghost h-8 px-3 text-xs"><Pencil className="h-3 w-3" /> {t.dash_edit}</button>
                <button onClick={() => onArchiveGroup(selectedGroup)} className="btn-ghost h-8 px-3 text-xs"><Archive className="h-3 w-3" /> {selectedGroup.is_archived ? t.dash_unarchive : t.dash_archive}</button>
                <button onClick={() => onDeleteGroup(selectedGroup)} className="btn-ghost h-8 px-3 text-xs text-red-600 hover:text-red-700"><Trash2 className="h-3 w-3" /> {t.dash_delete}</button>
              </div>
            </div>
            <AttendanceMatrix groupId={selectedGroup.id} groupName={selectedGroup.name} groupDays={selectedGroup.days_of_week} groupFee={selectedGroup.monthly_fee} token={token} />
          </div>
        ) : groups.length > 0 ? (
          <div className="card-glow flex flex-col items-center gap-5 p-16 text-center">
            <svg className="empty-state-icon h-20 w-20" viewBox="0 0 80 80" fill="none">
              <rect x="20" y="10" width="40" height="50" rx="6" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.5" />
              <path d="M30 30 L50 30 M30 40 L45 40 M30 50 L40 50" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.3" />
              <circle cx="55" cy="55" r="12" stroke="currentColor" strokeWidth="2" fill="none" />
              <path d="M55 50 L55 60 M50 55 L60 55" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <p className="text-lg font-semibold text-stone-700 dark:text-slate-300">{t.dash_no_group}</p>
            <p className="text-sm text-stone-500 dark:text-slate-400">{t.dash_no_group_desc}</p>
          </div>
        ) : (
          <div className="card-glow flex flex-col items-center gap-6 p-20 text-center page-scale-enter">
            <div className="relative">
              <svg className="empty-state-icon h-28 w-28 text-white dark:text-brand-deep" viewBox="0 0 100 100" fill="none">
                <circle cx="50" cy="45" r="20" stroke="currentColor" strokeWidth="2" />
                <path d="M35 70 Q50 75, 65 70" stroke="currentColor" strokeWidth="2" fill="none" />
                <rect x="45" y="30" width="10" height="8" rx="2" fill="currentColor" opacity="0.5" />
                <circle cx="50" cy="42" r="3" fill="currentColor" opacity="0.5" />
                <path d="M20 50 L80 50" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" opacity="0.3" />
                <path d="M30 30 Q50 10, 70 30" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.3" />
              </svg>
              <div className="absolute -right-1 -top-1 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-rose-500 shadow-lg shadow-amber-500/20 animate-badge-pulse"><Sparkles className="h-4 w-4 text-white" /></div>
            </div>
            <div>
              <p className="text-xl font-bold text-stone-800 dark:text-slate-200">{t.dash_no_groups}</p>
              <p className="mt-1.5 text-sm text-stone-500 dark:text-slate-400 max-w-sm">{t.dash_no_groups_desc}</p>
            </div>
            <button onClick={onNewGroup} className="btn-primary hover-lift"><Plus className="h-4 w-4" /> {t.dash_create_btn}</button>
            <div className="flex items-center gap-6 text-xs text-stone-400 dark:text-slate-500 stagger-fade-in">
              <span className="flex items-center gap-1.5"><ArrowUpRight className="h-3 w-3 text-brand" /> {t.dash_step1}</span>
              <span className="flex items-center gap-1.5"><ArrowUpRight className="h-3 w-3 text-brand" /> {t.dash_step2}</span>
              <span className="flex items-center gap-1.5"><ArrowUpRight className="h-3 w-3 text-brand" /> {t.dash_step3}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
