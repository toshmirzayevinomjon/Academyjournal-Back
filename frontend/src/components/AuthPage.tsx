import { FormEvent, useEffect, useRef, useState } from 'react'
import { BookOpen, GraduationCap, KeyRound, Mail, Phone, Send, UserRound, ArrowRight, BarChart3, Users, Sparkles, ShieldCheck, ChevronLeft } from 'lucide-react'
import { languages } from '../lib/i18n'
import { GOOGLE_CLIENT_ID } from '../lib/constants'

type AuthMode = 'login' | 'register'
type AuthView = 'form' | 'verify' | 'forgot' | 'reset'
type TokenResponse = { access_token: string; token_type: string }
type RegisterResponse = { is_active: boolean }

async function readApiError(response: Response) {
  try {
    const body = await response.json()
    if (Array.isArray(body.detail)) return body.detail.map((item: { msg?: string }) => item.msg).filter(Boolean).join(' ')
    return body.detail || "So'rov bajarilmadi."
  } catch { return "So'rov bajarilmadi." }
}

type Props = { onAuth: (token: string) => void; lang?: string }

export default function AuthPage({ onAuth, lang: l }: Props) {
  const t = languages[(l || 'uz') as keyof typeof languages] || languages.uz
  const parallaxRef = useRef<HTMLDivElement>(null)
  const googleBtnRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function onScroll() {
      const el = parallaxRef.current
      if (!el) return
      const sy = window.scrollY
      const layers = el.querySelectorAll<HTMLElement>('.parallax-layer')
      layers.forEach((layer, i) => {
        const speed = 0.03 * (i + 1)
        layer.style.transform = `translateY(${sy * speed}px)`
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  const features = [
    { icon: BookOpen, text: t.auth_feature1, desc: t.auth_feature1_desc },
    { icon: Users, text: t.auth_feature2, desc: t.auth_feature2_desc },
    { icon: BarChart3, text: t.auth_feature3, desc: t.auth_feature3_desc },
  ]
  const [mode, setMode] = useState<AuthMode>('login')
  const [view, setView] = useState<AuthView>('form')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function doLogin(loginEmail: string, loginPassword: string) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: loginEmail, password: loginPassword }),
    })
    if (!res.ok) throw new Error(await readApiError(res))
    const data = (await res.json()) as TokenResponse
    localStorage.setItem('access_token', data.access_token)
    onAuth(data.access_token)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true); setError(null); setNotice(null)
    try {
      if (mode === 'register') {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, full_name: fullName }),
        })
        if (!res.ok) throw new Error(await readApiError(res))
        const created = (await res.json()) as RegisterResponse
        if (created.is_active === false) {
          setView('verify')
          setNotice(t.auth_verify_desc)
          return
        }
      }
      await doLogin(email, password)
    } catch (err) { setError(err instanceof Error ? err.message : t.auth_error) }
    finally { setLoading(false) }
  }

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true); setError(null); setNotice(null)
    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      })
      if (!res.ok) throw new Error(await readApiError(res))
      setNotice(t.auth_verify_success)
      await doLogin(email, password)
    } catch (err) { setError(err instanceof Error ? err.message : t.auth_error) }
    finally { setLoading(false) }
  }

  async function handleForgot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true); setError(null); setNotice(null)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) throw new Error(await readApiError(res))
      setNotice(t.auth_forgot_sent)
      setView('reset')
    } catch (err) { setError(err instanceof Error ? err.message : t.auth_error) }
    finally { setLoading(false) }
  }

  async function handleReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true); setError(null); setNotice(null)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, new_password: newPassword }),
      })
      if (!res.ok) throw new Error(await readApiError(res))
      setNotice(t.auth_reset_success)
      setPassword(newPassword)
      setCode(''); setNewPassword('')
      setMode('login')
      setView('form')
    } catch (err) { setError(err instanceof Error ? err.message : t.auth_error) }
    finally { setLoading(false) }
  }

  async function handleGoogleCredential(credential: string) {
    setLoading(true); setError(null); setNotice(null)
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token: credential }),
      })
      if (!res.ok) throw new Error(await readApiError(res))
      const data = (await res.json()) as TokenResponse
      localStorage.setItem('access_token', data.access_token)
      onAuth(data.access_token)
    } catch (err) { setError(err instanceof Error ? err.message : t.auth_google_error) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || view !== 'form') return
    let cancelled = false
    const g = (window as unknown as { google?: any }).google
    if (!g?.accounts?.id) return
    g.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (resp: { credential?: string }) => {
        if (resp?.credential) handleGoogleCredential(resp.credential)
      },
      auto_select: false,
    })
    if (googleBtnRef.current) {
      g.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        text: 'continue_with',
        logo_alignment: 'left',
        width: 340,
      })
    }
    return () => { cancelled = true }
  }, [view])

  function switchMode(next: AuthMode) {
    setMode(next); setError(null); setNotice(null)
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <div ref={parallaxRef} className="relative flex flex-1 items-center justify-center overflow-hidden gradient-brand-dark p-8 lg:p-14">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.1)_0%,transparent_60%)]" />
        <div className="pointer-events-none parallax-layer absolute -left-20 -top-20 h-80 w-80 rounded-full bg-brand-soft blur-3xl" />
        <div className="pointer-events-none parallax-layer absolute -bottom-20 -right-20 h-96 w-96 rounded-full bg-brand-soft blur-3xl" />
        <div className="pointer-events-none parallax-layer absolute left-1/4 top-1/4 h-48 w-48 animate-float rounded-full bg-white/5 blur-2xl" />
        <div className="pointer-events-none parallax-layer absolute right-1/3 top-1/2 h-32 w-32 animate-float-delayed rounded-full bg-brand-soft blur-2xl" />
        <div className="pointer-events-none parallax-layer absolute bottom-1/4 left-1/2 h-24 w-24 animate-float-slow rounded-full bg-brand-soft blur-xl" />
        <div className="pointer-events-none parallax-layer absolute left-[10%] bottom-[15%] h-16 w-16 rounded-full bg-white/5 animate-float blur-xl" />
        <div className="pointer-events-none parallax-layer absolute right-[15%] top-[20%] h-20 w-20 rounded-full bg-brand-soft animate-float-delayed blur-2xl" />
        <svg className="pointer-events-none parallax-layer absolute right-[10%] bottom-[25%] h-12 w-12 animate-float-slow text-white/5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>

        <div className="relative w-full max-w-lg animate-in">
          <div className="mb-3 inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 px-5 py-3 shadow-lg shadow-black/5 backdrop-blur-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold text-white">Kundalik</span>
            <span className="rounded-lg bg-white/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">{t.auth_badge}</span>
          </div>

          <h1 className="mt-12 text-4xl font-bold leading-tight text-white lg:text-5xl">
            {t.auth_heading1}
            <br />
            <span className="bg-brand-soft bg-clip-text text-transparent">
              {t.auth_heading2}
            </span>
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-white/70">
            {t.auth_desc}
          </p>

          <div className="mt-10 space-y-3">
            {features.map(({ icon: Icon, text, desc }, i) => (
              <div key={i} className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.07] px-5 py-4 backdrop-blur-sm transition-all hover:border-white/20 hover:bg-white/[0.12]">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand transition-all group-hover:scale-110 group-hover:bg-brand-soft">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <span className="text-base font-medium text-white">{text}</span>
                  <p className="mt-0.5 text-sm text-white/60">{desc}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-white/30 transition-all group-hover:translate-x-1 group-hover:text-white" />
              </div>
            ))}
          </div>

          <div className="mt-10 flex items-center gap-4 rounded-2xl bg-brand-soft p-5 shadow-lg shadow-black/10 backdrop-blur-sm">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-rose-500 shadow-lg shadow-amber-500/20">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">{t.auth_cta1}</p>
              <p className="mt-0.5 text-sm text-white/70">{t.auth_cta2}</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10">
              <ShieldCheck className="h-4 w-4 text-brand" />
            </div>
          </div>

          <div className="mt-8 flex items-center gap-6 text-xs text-white/50">
            <span className="flex items-center gap-1.5"><div className="h-1 w-1 rounded-full bg-white/60" /> {t.auth_tag1}</span>
            <span className="flex items-center gap-1.5"><div className="h-1 w-1 rounded-full bg-white/60" /> {t.auth_tag2}</span>
            <span className="flex items-center gap-1.5"><div className="h-1 w-1 rounded-full bg-white/60" /> {t.auth_tag3}</span>
          </div>
        </div>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-[linear-gradient(135deg,color-mix(in_srgb,var(--c1)_8%,transparent),white,color-mix(in_srgb,var(--c2)_8%,transparent))] p-6">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-brand-soft blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-amber-200/20 blur-3xl" />

        <div className="relative w-full max-w-sm animate-in">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl gradient-brand shadow-xl shadow-brand ring-4 ring-white/80">
              <GraduationCap className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-stone-800">
              {view === 'form' && (mode === 'login' ? t.auth_welcome : t.auth_register_title)}
              {view === 'verify' && t.auth_verify_title}
              {view === 'forgot' && t.auth_forgot}
              {view === 'reset' && t.auth_reset_title}
            </h2>
            <p className="mt-1.5 text-sm text-stone-500">
              {view === 'form' && (mode === 'login' ? t.auth_login_subtitle : t.auth_register_subtitle)}
              {view === 'verify' && t.auth_verify_desc}
              {view === 'forgot' && t.auth_forgot_desc}
              {view === 'reset' && t.auth_forgot_desc}
            </p>
          </div>

          {view === 'form' && (
            <>
              <div className="mb-6 grid grid-cols-2 gap-1 rounded-2xl bg-stone-100 p-1.5 shadow-inner">
                <button type="button" onClick={() => switchMode('login')}
                  className={`h-11 rounded-xl text-sm font-semibold transition-all ${
                    mode === 'login' ? 'bg-white text-stone-800 shadow-md shadow-stone-900/5' : 'text-stone-500 hover:text-stone-700'
                  }`}>{t.auth_login_tab}</button>
                <button type="button" onClick={() => switchMode('register')}
                  className={`h-11 rounded-xl text-sm font-semibold transition-all ${
                    mode === 'register' ? 'bg-white text-stone-800 shadow-md shadow-stone-900/5' : 'text-stone-500 hover:text-stone-700'
                  }`}>{t.auth_register_tab}</button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'register' && (
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-stone-700">{t.auth_full_name}</label>
                    <div className="flex h-12 items-center gap-3 rounded-xl border border-stone-200 bg-white/80 px-4 transition-all duration-300 focus-within:border-brand focus-within:bg-white focus-within:shadow-xl focus-within:shadow-brand focus-within:ring-2 focus-within:ring-brand">
                      <UserRound className="h-4 w-4 text-stone-400 transition-colors duration-300 group-focus-within:text-brand" />
                      <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-full w-full bg-transparent text-sm text-stone-800 outline-none placeholder:text-stone-400" placeholder="Aliyev Alisher" required />
                    </div>
                  </div>
                )}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-stone-700">{t.auth_email}</label>
                  <div className="flex h-12 items-center gap-3 rounded-xl border border-stone-200 bg-white/80 px-4 transition-all duration-300 focus-within:border-brand focus-within:bg-white focus-within:shadow-xl focus-within:shadow-brand focus-within:ring-2 focus-within:ring-brand">
                    <Mail className="h-4 w-4 text-stone-400" />
                    <input value={email} onChange={(e) => setEmail(e.target.value)} className="h-full w-full bg-transparent text-sm text-stone-800 outline-none placeholder:text-stone-400" placeholder="email@example.com" type="text" required />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-stone-700">{t.auth_password}</label>
                  <div className="flex h-12 items-center gap-3 rounded-xl border border-stone-200 bg-white/80 px-4 transition-all duration-300 focus-within:border-brand focus-within:bg-white focus-within:shadow-xl focus-within:shadow-brand focus-within:ring-2 focus-within:ring-brand">
                    <KeyRound className="h-4 w-4 text-stone-400" />
                    <input value={password} onChange={(e) => setPassword(e.target.value)} className="h-full w-full bg-transparent text-sm text-stone-800 outline-none placeholder:text-stone-400" placeholder="••••••••" type="password" minLength={8} required />
                  </div>
                  {mode === 'login' && (
                    <button type="button" onClick={() => { setView('forgot'); setError(null); setNotice(null) }}
                      className="mt-1.5 text-xs font-semibold text-brand underline decoration-[var(--c3)] underline-offset-2 transition hover:text-brand">
                      {t.auth_forgot}
                    </button>
                  )}
                </div>

                {error && (
                  <div className="animate-in flex items-center gap-3 rounded-xl border border-red-200/80 bg-red-50/90 px-5 py-3.5 text-sm text-red-700 shadow-sm">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100"><span className="text-xs font-bold text-red-600">!</span></div>
                    {error}
                  </div>
                )}
                {notice && (
                  <div className="animate-in flex items-center gap-3 rounded-xl border border-emerald-200/80 bg-emerald-50/90 px-5 py-3.5 text-sm text-emerald-700 shadow-sm">
                    {notice}
                  </div>
                )}

                <button type="submit" disabled={loading} className="btn-primary w-full text-base">
                  {loading ? (
                    <span className="flex items-center gap-2"><div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> {t.auth_loading}</span>
                  ) : (
                    <>{mode === 'login' ? t.auth_login_btn : t.auth_register_btn} <ArrowRight className="h-4 w-4" /></>
                  )}
                </button>
              </form>

              {GOOGLE_CLIENT_ID && (
                <>
                  <div className="my-5 flex items-center gap-3">
                    <div className="h-px flex-1 bg-stone-200 dark:bg-slate-700" />
                    <span className="text-xs font-medium text-stone-400">{t.auth_or}</span>
                    <div className="h-px flex-1 bg-stone-200 dark:bg-slate-700" />
                  </div>
                  <div ref={googleBtnRef} className="flex justify-center" />
                </>
              )}

              <p className="mt-6 text-center text-xs text-stone-400">
                {mode === 'login' ? t.auth_no_account : t.auth_has_account}
                <button type="button" onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
                  className="font-semibold text-brand underline decoration-[var(--c3)] underline-offset-2 transition hover:text-brand">
                  {mode === 'login' ? t.auth_register_link : t.auth_login_link}
                </button>
              </p>
            </>
          )}

          {view === 'verify' && (
            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-stone-700">{t.auth_verify_code}</label>
                <div className="flex h-12 items-center gap-3 rounded-xl border border-stone-200 bg-white/80 px-4 transition-all duration-300 focus-within:border-brand focus-within:bg-white focus-within:shadow-xl focus-within:shadow-brand focus-within:ring-2 focus-within:ring-brand">
                  <KeyRound className="h-4 w-4 text-stone-400" />
                  <input value={code} onChange={(e) => setCode(e.target.value)} className="h-full w-full bg-transparent text-sm text-stone-800 outline-none placeholder:text-stone-400" placeholder="123456" inputMode="numeric" maxLength={6} required />
                </div>
              </div>

              {error && (
                <div className="animate-in flex items-center gap-3 rounded-xl border border-red-200/80 bg-red-50/90 px-5 py-3.5 text-sm text-red-700 shadow-sm">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100"><span className="text-xs font-bold text-red-600">!</span></div>
                  {error}
                </div>
              )}
              {notice && (
                <div className="animate-in flex items-center gap-3 rounded-xl border border-emerald-200/80 bg-emerald-50/90 px-5 py-3.5 text-sm text-emerald-700 shadow-sm">
                  {notice}
                </div>
              )}

              <button type="submit" disabled={loading} className="btn-primary w-full text-base">
                {loading ? (
                  <span className="flex items-center gap-2"><div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> {t.auth_loading}</span>
                ) : (
                  <>{t.auth_verify_btn} <ArrowRight className="h-4 w-4" /></>
                )}
              </button>
              <button type="button" onClick={() => { setView('form'); setError(null); setNotice(null) }}
                className="flex w-full items-center justify-center gap-1.5 text-xs font-semibold text-stone-500 transition hover:text-stone-700">
                <ChevronLeft className="h-3.5 w-3.5" /> {t.auth_back}
              </button>
            </form>
          )}

          {view === 'forgot' && (
            <form onSubmit={handleForgot} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-stone-700">{t.auth_email}</label>
                <div className="flex h-12 items-center gap-3 rounded-xl border border-stone-200 bg-white/80 px-4 transition-all duration-300 focus-within:border-brand focus-within:bg-white focus-within:shadow-xl focus-within:shadow-brand focus-within:ring-2 focus-within:ring-brand">
                  <Mail className="h-4 w-4 text-stone-400" />
                  <input value={email} onChange={(e) => setEmail(e.target.value)} className="h-full w-full bg-transparent text-sm text-stone-800 outline-none placeholder:text-stone-400" placeholder="email@example.com" type="text" required />
                </div>
              </div>

              {error && (
                <div className="animate-in flex items-center gap-3 rounded-xl border border-red-200/80 bg-red-50/90 px-5 py-3.5 text-sm text-red-700 shadow-sm">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100"><span className="text-xs font-bold text-red-600">!</span></div>
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading} className="btn-primary w-full text-base">
                {loading ? (
                  <span className="flex items-center gap-2"><div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> {t.auth_loading}</span>
                ) : (
                  <>{t.auth_forgot_btn} <ArrowRight className="h-4 w-4" /></>
                )}
              </button>
              <button type="button" onClick={() => { setView('form'); setError(null); setNotice(null) }}
                className="flex w-full items-center justify-center gap-1.5 text-xs font-semibold text-stone-500 transition hover:text-stone-700">
                <ChevronLeft className="h-3.5 w-3.5" /> {t.auth_back}
              </button>
            </form>
          )}

          {view === 'reset' && (
            <form onSubmit={handleReset} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-stone-700">{t.auth_reset_code}</label>
                <div className="flex h-12 items-center gap-3 rounded-xl border border-stone-200 bg-white/80 px-4 transition-all duration-300 focus-within:border-brand focus-within:bg-white focus-within:shadow-xl focus-within:shadow-brand focus-within:ring-2 focus-within:ring-brand">
                  <KeyRound className="h-4 w-4 text-stone-400" />
                  <input value={code} onChange={(e) => setCode(e.target.value)} className="h-full w-full bg-transparent text-sm text-stone-800 outline-none placeholder:text-stone-400" placeholder="123456" inputMode="numeric" maxLength={6} required />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-stone-700">{t.auth_reset_new_password}</label>
                <div className="flex h-12 items-center gap-3 rounded-xl border border-stone-200 bg-white/80 px-4 transition-all duration-300 focus-within:border-brand focus-within:bg-white focus-within:shadow-xl focus-within:shadow-brand focus-within:ring-2 focus-within:ring-brand">
                  <KeyRound className="h-4 w-4 text-stone-400" />
                  <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="h-full w-full bg-transparent text-sm text-stone-800 outline-none placeholder:text-stone-400" placeholder="••••••••" type="password" minLength={8} required />
                </div>
              </div>

              {error && (
                <div className="animate-in flex items-center gap-3 rounded-xl border border-red-200/80 bg-red-50/90 px-5 py-3.5 text-sm text-red-700 shadow-sm">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100"><span className="text-xs font-bold text-red-600">!</span></div>
                  {error}
                </div>
              )}
              {notice && (
                <div className="animate-in flex items-center gap-3 rounded-xl border border-emerald-200/80 bg-emerald-50/90 px-5 py-3.5 text-sm text-emerald-700 shadow-sm">
                  {notice}
                </div>
              )}

              <button type="submit" disabled={loading} className="btn-primary w-full text-base">
                {loading ? (
                  <span className="flex items-center gap-2"><div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> {t.auth_loading}</span>
                ) : (
                  <>{t.auth_reset_btn} <ArrowRight className="h-4 w-4" /></>
                )}
              </button>
              <button type="button" onClick={() => { setView('forgot'); setError(null); setNotice(null) }}
                className="flex w-full items-center justify-center gap-1.5 text-xs font-semibold text-stone-500 transition hover:text-stone-700">
                <ChevronLeft className="h-3.5 w-3.5" /> {t.auth_back}
              </button>
            </form>
          )}

          <div className="mt-8 rounded-2xl border border-stone-200/70 dark:border-slate-700/60 bg-white/60 dark:bg-slate-800/40 p-4">
            <p className="mb-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-stone-400 dark:text-slate-500">{t.contact_title}</p>
            <div className="flex flex-col items-center gap-1.5 text-xs text-stone-500 dark:text-slate-400">
              <a href="tel:+998951840751" className="flex items-center gap-1.5 font-medium transition-colors hover:text-brand"><Phone className="h-3 w-3" /> +998 95 184 07 51</a>
              <a href="mailto:toshmirzayevinomjon@gmail.com" className="flex items-center gap-1.5 font-medium transition-colors hover:text-brand"><Mail className="h-3 w-3" /> toshmirzayevinomjon@gmail.com</a>
              <a href="https://t.me/toshmirzayevinomjon" target="_blank" rel="noreferrer" className="flex items-center gap-1.5 font-medium transition-colors hover:text-brand"><Send className="h-3 w-3" /> @toshmirzayevinomjon</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
