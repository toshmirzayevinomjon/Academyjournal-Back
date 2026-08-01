type Student = { id: number; full_name: string; phone?: string | null; status: 'active' | 'inactive' }
type AttendanceStatus = 'present' | 'absent' | 'excused' | null

export function exportAttendanceCSV(
  groupName: string,
  month: number,
  year: number,
  students: Student[],
  dates: string[],
  attendanceMap: Record<string, Record<number, AttendanceStatus>>,
  pending: Record<string, Record<number, AttendanceStatus>>,
) {
  const MONTHS = ['Yan','Fev','Mar','Apr','May','Iyun','Iyul','Avg','Sen','Okt','Noy','Dek']

  const getStatus = (sid: number, date: string): string => {
    const p = pending[date]?.[sid]
    const status = p !== undefined ? p : (attendanceMap[date]?.[sid] ?? null)
    switch (status) {
      case 'present': return 'K'
      case 'absent': return 'Y'
      case 'excused': return 'S'
      default: return '-'
    }
  }

  const header = ['O\'quvchi', 'Telefon', ...dates.map((d) => {
    const date = new Date(d + 'T00:00:00')
    return `${date.getDate()}/${date.getMonth() + 1}`
  }), 'Kelgan', 'Kelmagan', 'Sababli', 'Jami']

  const rows = students.map((s) => {
    let present = 0, absent = 0, excused = 0
    const dayStatuses = dates.map((d) => {
      const st = getStatus(s.id, d)
      if (st === 'K') present++
      else if (st === 'Y') absent++
      else if (st === 'S') excused++
      return st
    })
    return [s.full_name, s.phone || '-', ...dayStatuses, present, absent, excused, dates.length]
  })

  const bom = '\uFEFF'
  const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n')

  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${groupName}_${MONTHS[month]}_${year}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
