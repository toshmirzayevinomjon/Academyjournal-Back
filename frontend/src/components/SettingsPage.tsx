import { useState } from 'react'
import { ArrowLeft, KeyRound, Lock, Moon, Sun, User, LogOut, Send, ShieldCheck, Bell, Palette, Globe, Save, Smartphone } from 'lucide-react'
import { languages } from '../lib/i18n'
import { api } from '../lib/api'
import { useToast } from '../lib/toast'
import { getAvatarStyle } from '../lib/utils'

type Props = {
  profile: { id: number; email: string; full_name: string; telegram_chat_id?: string | null; language?: string } | null
  onBack: () => void
  onLogout: () => void
  darkMode: boolean
  onToggleDark: () => void
  token: string
}

export default function SettingsPage({ profile, onBack, onLogout, darkMode, onToggleDark, token }: Props) {
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [pwCur, setPwCur] = useState('')
  const [pwNew, setPwNew] = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwSuccess, setPwSuccess] = useState(false)
  const [lang, setLang] = useState(profile?.language || 'uz')
  const [profileSaving, setProfileSaving] = useState(false)
  const [linkLoading, setLinkLoading] = useState(false)
  const { toast } = useToast()

  const t = languages[lang as keyof typeof languages] || languages.uz

  async function handleSaveProfile() {
    if (!fullName.trim()) { toast('error', t.settings_name_required); return }
    setProfileSaving(true)
    try {
      await api('/api/auth/me', {
        method: 'PUT',
        body: JSON.stringify({ full_name: fullName.trim(), language: lang }),
        token,
      })
      toast('success', t.settings_name_saved)
    } catch { toast('error', t.settings_name_error) }
    finally { setProfileSaving(false) }
  }

  async function handleChangePw(e: React.FormEvent) {
    e.preventDefault(); setPwError(null); setPwSuccess(false)
    if (pwNew !== pwConfirm) { setPwError(t.settings_password_mismatch); return }
    setPwLoading(true)
    try {
      await api('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ current_password: pwCur, new_password: pwNew }),
        token,
      })
      setPwSuccess(true); setPwCur(''); setPwNew(''); setPwConfirm(''); toast('success', t.settings_password_changed)
    } catch (e) { setPwError(e instanceof Error ? e.message : t.settings_password_error) }
    finally { setPwLoading(false) }
  }

  async function handleGenerateLink() {
    setLinkLoading(true)
    try {
      const res = await api<{ code: string }>('/api/auth/link-code', { method: 'POST', token })
      window.open(`https://t.me/academy_journal_bot?start=${res.code}`, '_blank')
    } catch { toast('error', 'Kod olishda xatolik') }
    finally { setLinkLoading(false) }
  }

  async function handleChangeLang(l: string) {
    setLang(l)
    await api('/api/auth/me', {
      method: 'PUT',
      body: JSON.stringify({ language: l }),
      token,
    })
  }

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-slate-900">
      <header className="glass-nav sticky top-0 z-30">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 lg:px-6">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="btn-ghost h-9 px-3 text-xs">← {t.dash_back}</button>
            <div className="h-5 w-px bg-stone-200 dark:bg-slate-700" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-brand">{t.settings_header_title}</p>
              <p className="text-sm font-bold text-stone-800 dark:text-slate-200">{t.settings_header_subtitle}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 pt-8 pb-14 lg:px-6">
        <div className="mb-8 flex items-center gap-5">
          <div className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${getAvatarStyle(profile?.full_name || 'User').gradient} shadow-lg shadow-brand`}>
            <span className="text-2xl font-bold text-white">
              {profile?.full_name ? profile.full_name.slice(0, 1).toUpperCase() : 'U'}
            </span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-stone-800 dark:text-slate-200">{profile?.full_name || t.nav_user}</h1>
            <p className="text-sm text-stone-500 dark:text-slate-400">{profile?.email}</p>
          </div>
        </div>

        <div className="mb-8">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-slate-400">{t.settings_profile}</p>
          <div className="glass-card p-5">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px]">
                <p className="mb-1.5 text-xs font-medium text-stone-500 dark:text-slate-400">{t.full_name}</p>
                <input value={fullName} onChange={e => setFullName(e.target.value)} className="input-premium" />
              </div>
              <button onClick={handleSaveProfile} disabled={profileSaving} className="btn-primary h-11 text-xs">
                <Save className="h-3.5 w-3.5" /> {profileSaving ? t.dash_saving : t.save}
              </button>
            </div>
          </div>
        </div>

        <div className="mb-8">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-slate-400">{t.settings}</p>
          <div className="glass-card divide-y divide-stone-100 dark:divide-slate-700 overflow-hidden p-0">
            {[
              {
                icon: darkMode ? Moon : Sun,
                label: t.dark_mode,
                desc: t.dark_desc,
                action: (
                  <button onClick={onToggleDark} className={`relative h-7 w-12 rounded-full transition-colors ${darkMode ? 'bg-brand' : 'bg-stone-300'}`}>
                    <div className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-md transition-transform ${darkMode ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                  </button>
                ),
              },
              {
                icon: Palette,
                label: t.language,
                desc: languages[lang as keyof typeof languages]?.name || "O'zbek",
                action: (
                  <select value={lang} onChange={e => handleChangeLang(e.target.value)} className="input-premium h-8 w-24 text-xs">
                    {Object.entries(languages).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
                  </select>
                ),
              },
              {
                icon: User,
                label: t.full_name,
                desc: profile?.full_name || 'Foydalanuvchi',
                action: null,
              },
              {
                icon: ShieldCheck,
                label: t.email,
                desc: profile?.email || '—',
                action: null,
              },
              {
                icon: Send,
                label: t.telegram,
                desc: t.telegram_desc,
                action: null,
              },
            ].map(({ icon: Icon, label, desc, action }) => (
              <div key={label} className="flex items-center gap-4 px-5 py-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-stone-100 dark:bg-slate-700">
                  <Icon className="h-4 w-4 text-stone-600 dark:text-slate-300" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-stone-800 dark:text-slate-200">{label}</p>
                  <p className="text-xs text-stone-500 dark:text-slate-400">{desc}</p>
                </div>
                {action}
              </div>
            ))}
          </div>
        </div>

        <div className="mb-8">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-slate-400">{t.telegram}</p>
          <div className="glass-card p-5">
            {profile?.telegram_chat_id ? (
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft-2"><Smartphone className="h-5 w-5 text-brand" /></div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-brand">✅ Telegram ulangan</p>
                  <p className="text-xs text-stone-500 dark:text-slate-400">ID: {profile.telegram_chat_id}</p>
                </div>
                <button type="button" onClick={async () => {
                  await api('/api/auth/me', { method: 'PUT', body: JSON.stringify({ telegram_chat_id: '' }), token })
                  window.location.reload()
                }} className="btn-ghost h-9 text-xs text-red-500 hover:text-red-600">{t.nav_delete}</button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 shadow-lg shadow-blue-500/20">
                  <Send className="h-7 w-7 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-stone-800 dark:text-slate-200">{t.telegram_desc}</p>
                  <p className="mt-1 text-xs text-stone-500 dark:text-slate-400">{t.telegram_hint}</p>
                </div>
                <button type="button" onClick={handleGenerateLink} disabled={linkLoading} className="btn-primary h-12 px-8 text-sm shadow-lg shadow-brand">
                  <Send className="h-4 w-4" /> {linkLoading ? t.dash_saving : "Telegramga ulanish"}
                </button>
                {profile?.telegram_chat_id && (
                  <p className="text-xs text-brand font-medium">✅ Ulandi!</p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mb-8">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-slate-400">{t.change_password}</p>
          <form onSubmit={handleChangePw} className="glass-card p-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <div><p className="mb-1.5 text-xs font-medium text-stone-500 dark:text-slate-400">{t.current_password}</p><input value={pwCur} onChange={e => setPwCur(e.target.value)} type="password" className="input-premium" required /></div>
              <div><p className="mb-1.5 text-xs font-medium text-stone-500 dark:text-slate-400">{t.new_password}</p><input value={pwNew} onChange={e => setPwNew(e.target.value)} type="password" className="input-premium" minLength={8} required /></div>
              <div><p className="mb-1.5 text-xs font-medium text-stone-500 dark:text-slate-400">{t.confirm_password}</p><input value={pwConfirm} onChange={e => setPwConfirm(e.target.value)} type="password" className="input-premium" minLength={8} required /></div>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button type="submit" disabled={pwLoading} className="btn-primary h-10 text-xs"><Lock className="h-3.5 w-3.5" /> {pwLoading ? t.dash_saving : t.update_password}</button>
              {pwSuccess && <span className="text-xs font-medium text-brand">{t.password_changed}</span>}
              {pwError && <span className="text-xs font-medium text-red-600">{pwError}</span>}
            </div>
          </form>
        </div>

        <button onClick={onLogout} className="btn-ghost w-full text-red-600 hover:text-red-700 hover:border-red-200"><LogOut className="h-4 w-4" /> {t.logout}</button>
      </div>
    </div>
  )
}
