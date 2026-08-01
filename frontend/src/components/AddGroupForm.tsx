import { useState } from 'react'
import { Clock3, Plus, BookOpen, Wallet } from 'lucide-react'
import { WEEKDAYS } from '../lib/constants'
import { languages } from '../lib/i18n'
import { useToast } from '../lib/toast'

type Props = {
  onSubmit: (data: { name: string; days_of_week: string[]; lesson_time?: string | null; monthly_fee?: number | null }) => void
  loading?: boolean
  lang?: string
}

const suggestions = ['Matematika', 'Ingliz tili', 'Fizika', 'Ona tili', 'Kimyo', 'Biologiya']

export default function AddGroupForm({ onSubmit, loading, lang: l }: Props) {
  const t = languages[(l || 'uz') as keyof typeof languages] || languages.uz
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [lessonTime, setLessonTime] = useState('09:00')
  const [monthlyFee, setMonthlyFee] = useState('')
  const [selectedDays, setSelectedDays] = useState<string[]>(['MON', 'WED', 'FRI'])

  function toggleDay(day: string) {
    setSelectedDays((cur) => (cur.includes(day) ? cur.filter((d) => d !== day) : [...cur, day]))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (selectedDays.length === 0) return toast('error', t.add_min_days)
    onSubmit({ name: name || 'New group', days_of_week: selectedDays, lesson_time: lessonTime || null, monthly_fee: Number(monthlyFee) || 0 })
  }

  return (
    <form onSubmit={handleSubmit} className="animate-in glass-card overflow-hidden p-0">
      <div className="gradient-brand-r px-7 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
            <BookOpen className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-base font-bold text-white">{t.add_title}</p>
            <p className="text-sm text-white/70">{t.add_desc}</p>
          </div>
        </div>
      </div>

      <div className="space-y-6 p-7">
        <div>
          <label className="mb-2 block text-sm font-medium text-stone-700">{t.add_name_label}</label>
          <div className="flex h-12 items-center gap-3 rounded-xl border border-stone-200 bg-white/80 px-4 transition-all duration-300 focus-within:border-brand focus-within:bg-white focus-within:shadow-xl focus-within:shadow-brand focus-within:ring-2 focus-within:ring-brand">
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="h-full w-full bg-transparent text-sm text-stone-800 outline-none placeholder:text-stone-400"
              placeholder={t.add_name_placeholder} />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {suggestions.map(s => (
              <button key={s} type="button" onClick={() => setName(s + ' guruhi')}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all ${
                  name.includes(s)
                    ? 'bg-brand-soft text-brand'
                    : 'bg-stone-100 text-stone-500 hover:bg-brand-soft hover:text-brand'
                }`}>{s}</button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-stone-700">{t.add_time_label}</label>
          <div className="flex h-12 items-center gap-3 rounded-xl border border-stone-200 bg-white/80 px-4 transition-all duration-300 focus-within:border-brand focus-within:bg-white focus-within:shadow-xl focus-within:shadow-brand focus-within:ring-2 focus-within:ring-brand">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-stone-100">
              <Clock3 className="h-3.5 w-3.5 text-stone-500" />
            </div>
            <input value={lessonTime} onChange={(e) => setLessonTime(e.target.value)} type="time"
              className="h-full w-full bg-transparent text-sm text-stone-800 outline-none" />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-stone-700">{t.group_fee}</label>
          <div className="flex h-12 items-center gap-3 rounded-xl border border-stone-200 bg-white/80 px-4 transition-all duration-300 focus-within:border-brand focus-within:bg-white focus-within:shadow-xl focus-within:shadow-brand focus-within:ring-2 focus-within:ring-brand">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-stone-100">
              <Wallet className="h-3.5 w-3.5 text-stone-500" />
            </div>
            <input value={monthlyFee} onChange={(e) => setMonthlyFee(e.target.value)} type="number" min="0" step="1000" placeholder="0"
              className="h-full w-full bg-transparent text-sm text-stone-800 outline-none placeholder:text-stone-400" />
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-stone-700">{t.add_days_label}</p>
            <p className="text-xs text-stone-400">{t.add_days_count.replace('{n}', String(selectedDays.length))}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((d) => (
              <button key={d.value} type="button" onClick={() => toggleDay(d.value)}
                className={`flex h-11 min-w-[48px] items-center justify-center rounded-xl px-5 text-sm font-semibold transition-all ${
                  selectedDays.includes(d.value)
                    ? 'gradient-brand-r text-white shadow-lg shadow-brand hover:-translate-y-0.5'
                    : 'border border-stone-200 bg-white/80 text-stone-600 shadow-sm hover:border-brand hover:bg-brand-soft hover:text-brand hover:-translate-y-0.5 hover:shadow-md'
                }`}>{d.label}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-stone-100 bg-stone-50/50 px-7 py-4">
        <p className="text-xs text-stone-400">{t.add_footer}</p>
        <button type="submit" disabled={loading} className="btn-primary hover-lift">
          <Plus className="h-4 w-4" /> {loading ? t.add_saving : t.add_submit}
        </button>
      </div>
    </form>
  )
}
