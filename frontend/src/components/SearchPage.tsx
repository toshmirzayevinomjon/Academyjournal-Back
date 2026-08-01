import { useEffect, useState } from 'react'
import { GraduationCap, Search, Users } from 'lucide-react'
import { api } from '../lib/api'
import { languages } from '../lib/i18n'
import { getAvatarStyle } from '../lib/utils'

type SearchResult = {
  groups: Array<{ id: number; name: string }>
  students: Array<{ id: number; full_name: string; phone?: string | null; group_id: number; group_name: string }>
}

export default function SearchPage({ token, lang: l, onNavigate }: { token: string; lang?: string; onNavigate: (path: string) => void }) {
  const t = languages[(l || 'uz') as keyof typeof languages] || languages.uz
  const [q, setQ] = useState(() => new URLSearchParams(window.location.search).get('q') || '')
  const [res, setRes] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const query = q.trim()
    if (!query) { setRes(null); setLoading(false); return }
    setLoading(true)
    api<SearchResult>(`/search?q=${encodeURIComponent(query)}`, { token })
      .then(setRes)
      .catch(() => setRes(null))
      .finally(() => setLoading(false))
  }, [q, token])

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand">{t.nav_search}</p>
        <h1 className="mt-1 text-2xl font-bold text-stone-800 dark:text-slate-200">{t.search_page_title}</h1>
      </div>

      <div className="flex h-12 items-center gap-3 rounded-2xl border border-stone-200/60 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 px-5 shadow-sm transition-all focus-within:border-brand focus-within:shadow-xl focus-within:shadow-brand focus-within:ring-2 focus-within:ring-brand">
        <Search className="h-4 w-4 shrink-0 text-stone-400 dark:text-slate-500" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.nav_search}
          className="h-full w-full bg-transparent text-sm text-stone-800 dark:text-slate-200 outline-none placeholder:text-stone-400 dark:placeholder:text-slate-500" />
      </div>

      {loading && (
        <div className="glass-card space-y-2 p-5">
          <div className="h-10 animate-pulse rounded-xl bg-stone-100 dark:bg-slate-700/60" />
          <div className="h-10 animate-pulse rounded-xl bg-stone-100 dark:bg-slate-700/60" />
          <div className="h-10 animate-pulse rounded-xl bg-stone-100 dark:bg-slate-700/60" />
        </div>
      )}

      {!loading && !q.trim() && (
        <div className="card-glow flex flex-col items-center gap-4 p-14 text-center">
          <Search className="h-10 w-10 text-stone-300 dark:text-slate-600" />
          <p className="text-sm font-medium text-stone-500 dark:text-slate-400">{t.search_start_hint}</p>
        </div>
      )}

      {!loading && res && res.groups.length === 0 && res.students.length === 0 && (
        <div className="card-glow flex flex-col items-center gap-4 p-14 text-center">
          <Search className="h-10 w-10 text-stone-300 dark:text-slate-600" />
          <p className="text-sm font-medium text-stone-500 dark:text-slate-400">{t.nav_search_empty}</p>
        </div>
      )}

      {res && res.groups.length > 0 && (
        <div className="glass-card overflow-hidden p-0">
          <div className="flex items-center gap-2 border-b border-stone-100 dark:border-slate-700 px-5 py-3">
            <Users className="h-4 w-4 text-brand" />
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-slate-400">{t.nav_search_groups}</p>
          </div>
          <div className="divide-y divide-stone-100 dark:divide-slate-700">
            {res.groups.map((g) => (
              <button key={g.id} type="button" onClick={() => onNavigate(`/groups/${g.id}`)}
                className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-brand-soft dark:hover:bg-brand-soft">
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${getAvatarStyle(g.name).gradient} text-sm font-bold text-white shadow-sm`}>{g.name.slice(0, 1)}</span>
                <span className="text-sm font-semibold text-stone-700 dark:text-slate-300">{g.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {res && res.students.length > 0 && (
        <div className="glass-card overflow-hidden p-0">
          <div className="flex items-center gap-2 border-b border-stone-100 dark:border-slate-700 px-5 py-3">
            <GraduationCap className="h-4 w-4 text-brand" />
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-slate-400">{t.nav_search_students}</p>
          </div>
          <div className="divide-y divide-stone-100 dark:divide-slate-700">
            {res.students.map((s) => (
              <button key={s.id} type="button" onClick={() => onNavigate(`/groups/${s.group_id}`)}
                className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-brand-soft dark:hover:bg-brand-soft">
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${getAvatarStyle(s.full_name).gradient} text-sm font-bold text-white shadow-sm`}>{s.full_name.slice(0, 1)}</span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-stone-700 dark:text-slate-300">{s.full_name}</span>
                  <span className="block truncate text-xs text-stone-400 dark:text-slate-500">{s.group_name}{s.phone ? ` · ${s.phone}` : ''}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
