import { FormEvent, useEffect, useState } from 'react'
import { GraduationCap } from 'lucide-react'
import AuthPage from './components/AuthPage'
import Dashboard from './components/Dashboard'
import SettingsPage from './components/SettingsPage'
import SuperadminPage from './components/SuperadminPage'
import ConfirmModal from './components/ConfirmModal'
import { DEFAULT_DAYS } from './lib/constants'
import { languages } from './lib/i18n'
import { api } from './lib/api'
import { useToast } from './lib/toast'

type UserProfile = { id: number; email: string; full_name: string; is_superuser?: boolean; telegram_chat_id?: string | null; language?: string }
type Group = { id: number; name: string; days_of_week: string[]; lesson_time?: string | null; is_archived?: boolean; monthly_fee?: number }
function fmtTime(t?: string | null) { return t ? t.slice(0, 5) : '--:--' }

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('access_token') ?? '')
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [groups, setGroups] = useState<Group[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)
  const [groupName, setGroupName] = useState('Matematika guruhi')
  const [lessonTime, setLessonTime] = useState('09:00')
  const [groupFee, setGroupFee] = useState<number | null>(null)
  const [selectedDays, setSelectedDays] = useState<string[]>(DEFAULT_DAYS)
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null)
  const [isBooting, setIsBooting] = useState(Boolean(token))
  const [isGroupLoading, setIsGroupLoading] = useState(false)
  const [currentPath, setCurrentPath] = useState<string>(window.location.pathname)
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('dark') === 'true')
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || '')
  const [compact, setCompact] = useState(() => localStorage.getItem('compact') === 'true')
  const [showArchived, setShowArchived] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Group | null>(null)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const { toast } = useToast()

  useEffect(() => {
    const on = () => setIsOnline(true)
    const off = () => setIsOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', darkMode)
    localStorage.setItem('dark', String(darkMode))
    root.className = root.className.replace(/theme-\w+/g, '').trim()
    if (theme) root.classList.add(theme)
    localStorage.setItem('theme', theme)
    root.classList.toggle('compact', compact)
    localStorage.setItem('compact', String(compact))
  }, [darkMode, theme, compact])

  async function loadGroups(preferredGroupId?: number) {
    const nextGroups = await api<Group[]>(`/api/groups${showArchived ? '?archived=true' : ''}`, { token })
    setGroups(nextGroups)
    setSelectedGroupId((currentId) => {
      if (preferredGroupId && nextGroups.some((g) => g.id === preferredGroupId)) return preferredGroupId
      if (currentId && nextGroups.some((g) => g.id === currentId)) return currentId
      return nextGroups[0]?.id ?? null
    })
  }

  function navigate(path: string) {
    if (path === currentPath) return
    window.history.pushState({}, '', path)
    setCurrentPath(path)
    if (path === '/' || path === '') setSelectedGroupId(groups[0]?.id ?? null)
    else if (path.startsWith('/groups/')) { const id = Number(path.split('/')[2]); if (!Number.isNaN(id)) setSelectedGroupId(id) }
  }

  useEffect(() => {
    function onPop() { setCurrentPath(window.location.pathname) }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    if (!token) { setIsBooting(false); return }
    let active = true
    async function boot() {
      setIsBooting(true)
      try {
        const [p, g] = await Promise.all([
          api<UserProfile>('/api/auth/me', { token }),
          api<Group[]>('/api/groups', { token }),
        ])
        if (!active) return
        setProfile(p); setGroups(g); setSelectedGroupId(g[0]?.id ?? null)
      } catch (err) {
        if (!active) return
        localStorage.removeItem('access_token'); setToken(''); setProfile(null); setGroups([])
        toast('error', t.app_session_error)
      } finally { if (active) setIsBooting(false) }
    }
    boot()
    return () => { active = false }
  }, [token])

  function handleAuth(token: string) { setToken(token) }

  async function handleSubmitGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (selectedDays.length === 0) { toast('error', t.app_min_days_error); return }
    setIsGroupLoading(true)
    try {
      const group = await api<Group>(editingGroupId ? `/api/groups/${editingGroupId}` : '/api/groups', {
        method: editingGroupId ? 'PUT' : 'POST',
        body: JSON.stringify({ name: groupName, days_of_week: selectedDays, lesson_time: lessonTime || null, monthly_fee: groupFee ?? 0 }),
        token,
      })
      resetGroupForm(); await loadGroups(group.id)
      toast('success', editingGroupId ? t.app_group_updated : t.app_group_created)
    } catch (err) { toast('error', err instanceof Error ? err.message : t.app_group_save_error) }
    finally { setIsGroupLoading(false) }
  }

  function resetGroupForm() { setEditingGroupId(null); setGroupName('Matematika guruhi'); setLessonTime('09:00'); setGroupFee(0); setSelectedDays(DEFAULT_DAYS) }
  function handleStartEditGroup(group: Group) { setEditingGroupId(group.id); setGroupName(group.name); setLessonTime(fmtTime(group.lesson_time) === '--:--' ? '09:00' : fmtTime(group.lesson_time)); setGroupFee(group.monthly_fee ?? 0); setSelectedDays(group.days_of_week) }

  async function handleDeleteGroup() {
    if (!deleteTarget) return
    setIsGroupLoading(true)
    try { await api<void>(`/api/groups/${deleteTarget.id}`, { method: 'DELETE', token }); if (editingGroupId === deleteTarget.id) resetGroupForm(); await loadGroups(); toast('success', t.app_group_deleted) }
    catch (err) { toast('error', err instanceof Error ? err.message : t.app_group_delete_error) }
    finally { setIsGroupLoading(false); setDeleteTarget(null) }
  }

  async function handleArchiveGroup(group: Group) {
    setIsGroupLoading(true)
    try { await api<Group>(`/api/groups/${group.id}/archive`, { method: 'PATCH', token }); if (editingGroupId === group.id) resetGroupForm(); await loadGroups(); toast('success', group.is_archived ? t.app_group_unarchived : t.app_group_archived) }
    catch (err) { toast('error', err instanceof Error ? err.message : t.app_group_archive_error) }
    finally { setIsGroupLoading(false) }
  }

  async function submitNewGroup(data: { name: string; days_of_week: string[]; lesson_time?: string | null; monthly_fee?: number | null }) {
    setIsGroupLoading(true)
    try { const group = await api<Group>('/api/groups', { method: 'POST', body: JSON.stringify(data), token }); await loadGroups(group.id); navigate('/'); toast('success', t.app_group_created) }
    catch (err) { toast('error', err instanceof Error ? err.message : t.app_group_save_error) }
    finally { setIsGroupLoading(false) }
  }

  function handleToggleDay(day: string) { setSelectedDays((d) => d.includes(day) ? d.filter((x) => x !== day) : [...d, day]) }
  function handleLogout() { localStorage.removeItem('access_token'); setToken(''); setProfile(null); setGroups([]); setSelectedGroupId(null) }

  async function handleLanguageChange(l: string) {
    setProfile((p) => (p ? { ...p, language: l } : p))
    try { await api('/api/auth/me', { method: 'PUT', body: JSON.stringify({ language: l }), token }) }
    catch { /* lang kept locally */ }
  }

  const t = languages[profile?.language as keyof typeof languages] || languages.uz

  if (isBooting) {
    return (
      <main className="page-enter grid min-h-screen place-items-center bg-stone-50 px-4 dark:bg-slate-900">
        <div className="flex animate-in flex-col items-center gap-5">
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl gradient-brand shadow-xl shadow-brand">
            <GraduationCap className="h-8 w-8 text-white" />
            <div className="absolute -inset-1 rounded-2xl border-2 border-brand animate-ping" />
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-stone-800 dark:text-slate-200">{t.app_boot_title}</p>
            <p className="mt-1 text-sm text-stone-500 dark:text-slate-400 animate-pulse">{t.app_boot_loading}</p>
          </div>
        </div>
      </main>
    )
  }

  if (!token) return <AuthPage onAuth={handleAuth} lang={profile?.language} />

  return (
    <>
      {!isOnline && (
        <div className="fixed inset-x-0 top-0 z-[60] bg-amber-500 px-4 py-2 text-center text-xs font-semibold text-white shadow-lg shadow-amber-500/20 animate-in">
          <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
          {t.offline_banner}
        </div>
      )}

      {currentPath === '/settings' ? (
        <div key="/settings" className="page-enter"><SettingsPage profile={profile} onBack={() => navigate('/')} onLogout={handleLogout} darkMode={darkMode} onToggleDark={() => setDarkMode(!darkMode)} token={token} /></div>
      ) : currentPath === '/admin' ? (
        <div key="/admin" className="page-scale-enter"><SuperadminPage token={token} onBack={() => navigate('/')} lang={profile?.language} /></div>
      ) : (
        <>
          <Dashboard
            groups={groups}
            selectedGroupId={selectedGroupId}
            onSelectGroup={(id) => navigate(`/groups/${id}`)}
            onNewGroup={() => navigate('/groups/new')}
            onEditGroup={handleStartEditGroup}
            onDeleteGroup={(g) => setDeleteTarget(g)}
            onArchiveGroup={handleArchiveGroup}
            onLogout={handleLogout}
            onNavigate={navigate}
            currentPath={currentPath}
            profile={profile}
            token={token}
            groupName={groupName}
            lessonTime={lessonTime}
            groupFee={groupFee}
            onGroupFeeChange={setGroupFee}
            selectedDays={selectedDays}
            editingGroupId={editingGroupId}
            isGroupLoading={isGroupLoading}
            onSubmitGroup={handleSubmitGroup}
            onResetGroupForm={resetGroupForm}
            onGroupNameChange={setGroupName}
            onLessonTimeChange={setLessonTime}
            onToggleDay={handleToggleDay}
            submitNewGroup={submitNewGroup}
            darkMode={darkMode}
            onToggleDark={() => setDarkMode(!darkMode)}
            theme={theme}
            onThemeChange={setTheme}
            compact={compact}
            onCompactToggle={() => setCompact(c => !c)}
            showArchived={showArchived}
            onToggleArchived={() => { setShowArchived(s => !s); setTimeout(() => loadGroups(), 0) }}
            lang={profile?.language}
            onLanguageChange={handleLanguageChange}
          />
          <ConfirmModal
            open={!!deleteTarget}
            title={t.app_confirm_delete_group_title}
            message={`${deleteTarget?.name} guruhini va undagi barcha ma'lumotlarni o'chirasizmi?`}
            danger
            confirmLabel={t.confirm_delete}
            onConfirm={handleDeleteGroup}
            onCancel={() => setDeleteTarget(null)}
            loading={isGroupLoading}
          />
        </>
      )}
    </>
  )
}
