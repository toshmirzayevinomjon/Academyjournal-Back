import React, { FormEvent, useEffect, useMemo, useState, useCallback } from 'react'
import {
  AlertCircle, Calendar, CalendarDays, CalendarX2, Check, ChevronLeft, ChevronRight, Clock3, DollarSign, FileSpreadsheet, Minus, X,
  Pencil, Play, RotateCcw, Save, Search, Trash2, Upload, UserPlus, Users, BarChart3, Download,
  Grid3X3, Eye, Phone,
} from 'lucide-react'
import { exportAttendanceCSV } from '../lib/export'
import { useKeyboard } from '../lib/useKeyboard'
import { useDebounce } from '../lib/useDebounce'
import { languages } from '../lib/i18n'
import { api } from '../lib/api'
import { useToast } from '../lib/toast'
import { getAvatarStyle } from '../lib/utils'
import ConfirmModal from './ConfirmModal'

type S = 'present'|'absent'|'excused'|null; type K = Exclude<S,null>|'none'
type St = { id:number; full_name:string; phone?:string|null; parent_name?:string|null; parent_phone?:string|null; birth_date?:string|null; status:'active'|'inactive' }
type Ar = { id:number; student_id:number; date:string; status:S; note?:string|null }
type P = { groupId:number; groupName:string; groupDays:string[]; groupFee?: number|null; token:string; lang?:string }

const MO = ['Yan','Fev','Mar','Apr','May','Iyun','Iyul','Avg','Sen','Okt','Noy','Dek']
const ss: Record<K,string> = { present:'K', absent:'Y', excused:'S', none:'-' }
const sd: Record<K,string> = { present:'bg-brand', absent:'bg-red-500', excused:'bg-amber-400', none:'bg-stone-200 dark:bg-slate-600' }
const sb: Record<K,string> = {
  present:'bg-brand text-white shadow-md shadow-brand',
  absent:'bg-red-500 text-white shadow-md shadow-red-500/20',
  excused:'bg-amber-400 text-stone-900 shadow-md shadow-amber-400/20',
  none:'bg-stone-100 dark:bg-slate-700 text-stone-500 dark:text-slate-400',
}
const sk = (s:S):K => s??'none'
const ns = (s:S):S => s===null?'present':s==='present'?'absent':s==='absent'?'excused':null
const fd = (r:string) => {const d=new Date(r+'T00:00:00');return `${d.getDate()}/${d.getMonth()+1}`}
const fw = (r:string) => ['Yak','Du','Se','Chor','Pay','Ju','Shan'][new Date(r+'T00:00:00').getDay()]
const td = (r:string) => {const n=new Date(),d=new Date(r+'T00:00:00');return d.getFullYear()===n.getFullYear()&&d.getMonth()===n.getMonth()&&d.getDate()===n.getDate()}

export default function AttendanceMatrix({ groupId, groupName, groupDays, groupFee, token, lang: l }: P) {
  const t = languages[(l || 'uz') as keyof typeof languages] || languages.uz
  const sl: Record<K,string> = { present:t.am_status_present, absent:t.am_status_absent, excused:t.am_status_excused, none:t.am_status_none }
  const op: Array<{v:S;k:K;l:string;ic:typeof Check}> = [
    {v:'present',k:'present',l:t.am_status_present,ic:Check},
    {v:'absent',k:'absent',l:t.am_status_absent,ic:X},
    {v:'excused',k:'excused',l:t.am_status_excused,ic:Clock3},
    {v:null,k:'none',l:t.am_status_none,ic:Minus},
  ]
  const now=new Date()
  const [year,setYear]=useState(now.getFullYear()); const [month,setMonth]=useState(now.getMonth())
  const [students,setStudents]=useState<St[]>([]); const [sDates,setSDates]=useState<string[]>([])
  const [attMap,setAttMap]=useState<Record<string,Record<number,S>>>({})
  const [pending,setPending]=useState<Record<string,Record<number,S>>>({})
  const [sName,setSName]=useState(''); const [sPhone,setSPhone]=useState('')
  const [sParent,setSParent]=useState(''); const [sParentPhone,setSParentPhone]=useState('')
  const [sBirth,setSBirth]=useState('')
  const [sStat,setSStat]=useState<'active'|'inactive'>('active')
  const [editS,setEditS]=useState<number|null>(null); const [selDate,setSelDate]=useState('')
  const [q,setQ]=useState(''); const dq=useDebounce(q,300); const [loading,setLoading]=useState(true)
  const [saving,setSaving]=useState(false); const [creating,setCreating]=useState(false)
  const [modalStudent,setModalStudent]=useState<St|null>(null)
  const [viewMode,setViewMode]=useState<'list'|'calendar'|'weekly'>('list')
  const [filterStatus,setFilterStatus]=useState<'all'|'active'|'inactive'>('all')
  const [batchMode,setBatchMode]=useState(false)
  const [selectedStudents,setSelectedStudents]=useState<Set<number>>(new Set())
  const [topics,setTopics]=useState<Record<string,string>>({})
  const [topicInput,setTopicInput]=useState('')
  const [topicLoading,setTopicLoading]=useState(false)
  const [excDays,setExcDays]=useState<Set<string>>(new Set())
  const [excReason,setExcReason]=useState('')
  const [excConfirm,setExcConfirm]=useState<{date:string}|null>(null)
  const [weekOffset,setWeekOffset]=useState(0)
  const [letterFilter,setLetterFilter]=useState('all')
  const [showPayReport,setShowPayReport]=useState(false)
  const [showImport,setShowImport]=useState(false)
  const [payments,setPayments]=useState<Record<number,Array<{id:number;amount:number;date:string;note?:string|null}>>>({})
  const [payAmount,setPayAmount]=useState('')
  const [payNote,setPayNote]=useState('')
  const [payLoading,setPayLoading]=useState(false)
  const [confetti,setConfetti]=useState<Array<{id:number;x:number;color:string}>>([])
  const [studentStatsData,setStudentStatsData]=useState<Record<number,{total_lessons:number;present:number;absent:number;excused:number;percentage:number;monthly:Array<{month:number;total:number;present:number}>}>>({})
  const [deleteTarget,setDeleteTarget]=useState<St|null>(null)
  const [deletePaymentTarget,setDeletePaymentTarget]=useState<{pid:number;sid:number}|null>(null)
  const { toast } = useToast()

  const ms=useMemo(()=>MO.map((l,i)=>({label:l,index:i})),[])
  const sorted=useMemo(()=>[...sDates].sort((a,b)=>new Date(a).getTime()-new Date(b).getTime()),[sDates])
  const fs=useMemo(()=>students.filter(s=>{
    if(filterStatus!=='all'&&s.status!==filterStatus)return false
    return s.full_name.toLowerCase().includes(dq.toLowerCase())||(s.phone??'').includes(dq)
  }),[students,dq,filterStatus])
  const cur=selDate||sorted[0]||''
  const pc=useMemo(()=>Object.values(pending).reduce((t,r)=>t+Object.keys(r).length,0),[pending])
  const letterOf=(n:string)=>n.trim().charAt(0).toUpperCase()||'#'
  const letters=useMemo(()=>[...new Set(fs.map(s=>letterOf(s.full_name)))].sort(),[fs])
  const ffs=useMemo(()=>letterFilter==='all'?fs:fs.filter(s=>letterOf(s.full_name)===letterFilter),[fs,letterFilter])
  const weekDays=useMemo(()=>{
    const today=new Date();const dow=today.getDay()===0?7:today.getDay()
    const monday=new Date(today.getFullYear(),today.getMonth(),today.getDate()-dow+1+weekOffset*7)
    const days:string[]=[]
    for(let i=0;i<7;i++){
      const d=new Date(monday.getFullYear(),monday.getMonth(),monday.getDate()+i)
      const ds=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
      if(sorted.includes(ds))days.push(ds)
    }
    return days
  },[sorted,weekOffset])
  const weekLabel=useMemo(()=>{
    const today=new Date();const dow=today.getDay()===0?7:today.getDay()
    const monday=new Date(today.getFullYear(),today.getMonth(),today.getDate()-dow+1+weekOffset*7)
    const sunday=new Date(monday.getFullYear(),monday.getMonth(),monday.getDate()+6)
    return `${monday.getDate()}.${monday.getMonth()+1} – ${sunday.getDate()}.${sunday.getMonth()+1}`
  },[weekOffset])

  useEffect(()=>{
    if(!sorted.length){setSelDate('');return}
    if(selDate&&sorted.includes(selDate))return
    const n=new Date();const t=`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`
    setSelDate(sorted.includes(t)?t:sorted[0])
  },[selDate,sorted])
  useEffect(()=>{setWeekOffset(0)},[year,month])
  useEffect(()=>{document.body.classList.toggle('modal-open',!!modalStudent);return()=>{document.body.classList.remove('modal-open')}},[modalStudent])

  async function load() {
    setLoading(true)
    try{    const[sd,sc,ad,td,pm,exc]=await Promise.all([api<St[]>(`/api/groups/${groupId}/students`,{token}),api<string[]>(`/api/groups/${groupId}/schedule?year=${year}&month=${month+1}`,{token}),api<Ar[]>(`/api/groups/${groupId}/attendance?year=${year}&month=${month+1}`,{token}),api<{id:number;date:string;topic:string}[]>(`/api/groups/${groupId}/topics?year=${year}&month=${month+1}`,{token}),api<Array<{id:number;student_id:number;amount:number;date:string;note?:string|null}>>(`/api/groups/${groupId}/payments?year=${year}&month=${month+1}`,{token}),api<Array<{id:number;date:string;reason?:string|null}>>(`/api/groups/${groupId}/exception-days?year=${year}&month=${month+1}`,{token})])
    const g:Record<string,Record<number,S>>={};ad.forEach(r=>{g[r.date]||={};g[r.date][r.student_id]=r.status})
    const t:Record<string,string>={};td.forEach(r=>{t[r.date]=r.topic})
    const p:Record<number,Array<{id:number;amount:number;date:string;note?:string|null}>>={};pm.forEach(r=>{p[r.student_id]||=[];p[r.student_id].push(r)})
    setExcDays(new Set(exc.map(e=>e.date.split('T')[0])));setStudents(sd);setSDates(sc);setAttMap(g);setTopics(t);setPayments(p);setPending({})}
    catch(e){toast('error',e instanceof Error?e.message:t.toast_load_error)}finally{setLoading(false)}
  }
  useEffect(()=>{load()},[groupId,year,month])

  const cs=(sid:number,d:string):S=>{const p=pending[d]?.[sid];return p!==undefined?p:(attMap[d]?.[sid]??null)}
  const mc=useMemo(()=>{const c:Record<K,number>={present:0,absent:0,excused:0,none:0};students.forEach(s=>sorted.forEach(d=>c[sk(cs(s.id,d))]++));return c},[attMap,pending,sorted,students])
  const dc=useMemo(()=>{const c:Record<K,number>={present:0,absent:0,excused:0,none:0};if(!cur)return c;fs.forEach(s=>c[sk(cs(s.id,cur))]++);return c},[attMap,cur,fs,pending])

  function chMon(o:number){const d=new Date(year,month+o,1);setYear(d.getFullYear());setMonth(d.getMonth())}
  function setCell(sid:number,d:string,st:S){if(!d)return;setPending(p=>({...p,[d]:{...(p[d]??{}),[sid]:st}}))}
  function toggle(sid:number,d:string){setCell(sid,d,ns(cs(sid,d)))}
  function qf(st:S){if(!cur)return;const r:Record<number,S>={};fs.forEach(s=>{r[s.id]=st});setPending(p=>({...p,[cur]:{...(p[cur]??{}),...r}}))}
  function rst(){setPending({})}
  function rsf(){setEditS(null);setSName('');setSPhone('');setSParent('');setSParentPhone('');setSBirth('');setSStat('active')}

  function openStudentModal(st: St) {
    const paidMonth=(payments[st.id]||[]).reduce((s,p)=>s+p.amount,0)
    const fee=groupFee||0
    const remaining=Math.max(fee-paidMonth,0)
    setPayAmount(String(remaining>0?remaining:fee))
    setModalStudent(st);loadStudentStats(st.id)
  }

  async function addPayment(){
    if(!modalStudent||!payAmount)return;setPayLoading(true)
    try{const r=await api<{id:number;student_id:number;amount:number;date:string;note?:string}>(`/api/groups/${groupId}/payments`,{method:'POST',body:JSON.stringify({student_id:modalStudent.id,amount:Number(payAmount),date:cur,note:payNote||null}),token})
    setPayments(p=>{const n={...p};n[r.student_id]||=[];n[r.student_id].push(r);return n});setPayAmount('');setPayNote('');toast('success',t.toast_payment_added)}
    catch(e){toast('error',e instanceof Error?e.message:t.toast_payment_error)}finally{setPayLoading(false)}
  }

  async function delPaymentConfirm(){
    if(!deletePaymentTarget)return
    try{await api(`/api/groups/${groupId}/payments/${deletePaymentTarget.pid}`,{method:'DELETE',token});setPayments(p=>{const n={...p};n[deletePaymentTarget.sid]=n[deletePaymentTarget.sid].filter(p=>p.id!==deletePaymentTarget.pid);return n});toast('success',t.toast_payment_deleted)}
    catch(e){toast('error',e instanceof Error?e.message:t.toast_payment_delete_error)}finally{setDeletePaymentTarget(null)}
  }

  async function addS(e:FormEvent){e.preventDefault();setCreating(true)
    try{await api(editS?`/api/groups/${groupId}/students/${editS}`:`/api/groups/${groupId}/students`,{method:editS?'PUT':'POST',body:JSON.stringify({full_name:sName,phone:sPhone||null,parent_name:sParent||null,parent_phone:sParentPhone||null,birth_date:sBirth||null,status:sStat}),token});rsf();await load();toast('success',editS?t.toast_student_updated:t.toast_student_added)}
    catch(e){toast('error',e instanceof Error?e.message:t.toast_student_save_error)}finally{setCreating(false)}}

  async function importCSV(e:React.ChangeEvent<HTMLInputElement>){const f=e.target.files?.[0];if(!f)return;setCreating(true)
    try{const fd=new FormData();fd.append('file',f);const r=await fetch(`/api/groups/${groupId}/students/import`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:fd})
    if(!r.ok){const b=await r.json().catch(()=>({}));throw new Error(b.detail||"Import xatolik")}await load();setShowImport(false);toast('success',t.toast_import_success)}catch(e){toast('error',e instanceof Error?e.message:t.toast_import_error)}finally{e.target.value='';setCreating(false)}}

  async function downloadTemplate(){
    try{
      const r=await fetch(`/api/groups/${groupId}/students/template`,{headers:{Authorization:`Bearer ${token}`}})
      if(!r.ok)throw new Error()
      const b=await r.blob()
      const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='students_template.csv';a.click()
    }catch{toast('error',t.toast_import_error)}
  }

  async function delSConfirm(){
    if(!deleteTarget)return
    setCreating(true)
    try{await api(`/api/groups/${groupId}/students/${deleteTarget.id}`,{method:'DELETE',token});if(editS===deleteTarget.id)rsf();await load();toast('success',t.toast_student_deleted)}
    catch(e){toast('error',e instanceof Error?e.message:t.toast_student_delete_error)}finally{setCreating(false);setDeleteTarget(null)}}

  async function batchDelete(){if(selectedStudents.size===0)return
    setCreating(true)
    try{await Promise.all([...selectedStudents].map(id=>api(`/api/groups/${groupId}/students/${id}`,{method:'DELETE',token})));setSelectedStudents(new Set());setBatchMode(false);await load();toast('success',t.toast_batch_deleted.replace('{n}',String(selectedStudents.size)))}
    catch(e){toast('error',e instanceof Error?e.message:t.toast_student_delete_error)}finally{setCreating(false)}}

  async function save(){setSaving(true)
    try{const nm:Record<string,Record<number,S>>={};Object.entries(attMap).forEach(([d,r])=>{nm[d]={...r}})
    for(const d of Object.keys(pending)){const recs=Object.entries(pending[d]).map(([sid,st])=>({student_id:Number(sid),status:st,note:null}))
    await api('/api/attendance/batch',{method:'POST',body:JSON.stringify({group_id:groupId,date:d,records:recs}),token})
    Object.entries(pending[d]).forEach(([sid,st])=>{const id=Number(sid);nm[d]||={};if(st===null){delete nm[d][id];if(!Object.keys(nm[d]).length)delete nm[d]}else nm[d][id]=st})}
    setAttMap(nm);setPending({})
    const cols=['#059669','#0d9488','#34d399','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899']
    const pieces=Array.from({length:20},(_,i)=>({id:Date.now()+i,x:Math.random()*100,color:cols[i%cols.length]}))
    setConfetti(pieces);setTimeout(()=>setConfetti([]),1500);toast('success',t.toast_attendance_saved)}
    catch(e){toast('error',e instanceof Error?e.message:t.toast_attendance_save_error)}finally{setSaving(false)}}

  async function removeExcDay(d:string){
    try{
      const exc=await api<Array<{id:number;date:string}>>(`/api/groups/${groupId}/exception-days?year=${year}&month=${month+1}`,{token})
      const found=exc.find(e=>e.date.split('T')[0]===d)
      if(found) await api(`/api/groups/${groupId}/exception-days/${found.id}`,{method:'DELETE',token})
      setExcDays(p=>{const n=new Set(p);n.delete(d);return n})
      toast('success',t.toast_exc_day_removed)
    }catch(e){toast('error',e instanceof Error?e.message:t.toast_exc_day_error)}
  }

  async function addExcDay(){
    if(!excConfirm)return;setCreating(true)
    try{
      await api(`/api/groups/${groupId}/exception-days`,{method:'POST',body:JSON.stringify({date:excConfirm.date,reason:excReason||null}),token})
      setExcDays(p=>new Set([...p,excConfirm.date]))
      toast('success',t.toast_exc_day_added)
    }catch(e){toast('error',e instanceof Error?e.message:t.toast_exc_day_error)}
    finally{setExcReason('');setExcConfirm(null);setCreating(false)}
  }

  async function batchSetStatus(st:'active'|'inactive'){
    if(!selectedStudents.size)return
    try{await api(`/api/groups/${groupId}/students/batch-status`,{method:'POST',body:JSON.stringify({student_ids:[...selectedStudents],status:st}),token});await load();toast('success',t.toast_batch_status.replace('{n}',String(selectedStudents.size)).replace('{status}',st==='active'?t.am_active:t.am_inactive));setSelectedStudents(new Set())}
    catch(e){toast('error',e instanceof Error?e.message:t.toast_batch_error)}
  }

  async function saveTopic(){
    if(!cur||!topicInput.trim())return;setTopicLoading(true)
    try{const r=await api<{date:string;topic:string}>(`/api/groups/${groupId}/topics`,{method:'PUT',body:JSON.stringify({date:cur,topic:topicInput.trim()}),token})
    setTopics(t=>({...t,[cur]:r.topic}));setTopicInput('');toast('success',t.toast_topic_saved)}
    catch(e){toast('error',e instanceof Error?e.message:t.toast_topic_error)}finally{setTopicLoading(false)}
  }

  async function loadStudentStats(sid: number) {
    if (studentStatsData[sid]) return
    try {
      const data = await api<{total_lessons:number;present:number;absent:number;excused:number;percentage:number;monthly:Array<{month:number;total:number;present:number}>}>(`/api/groups/${groupId}/students/${sid}/stats?year=${year}&month=${month+1}`, { token })
      setStudentStatsData(prev => ({...prev, [sid]: data}))
    } catch {}
  }

  function handleExport() {
    exportAttendanceCSV(groupName, month, year, students, sorted, attMap, pending)
  }

  const handleKey = useCallback((key: string) => {
    if (!cur || !fs.length) return
    switch (key) {
      case '1': qf('present'); break
      case '2': qf('absent'); break
      case '3': qf('excused'); break
      case '0': qf(null); break
      case 's': if (pc > 0) save(); break
      case 'escape': rst(); break
    }
  }, [cur, fs, pc])

  useKeyboard({
    '1': () => handleKey('1'),
    '2': () => handleKey('2'),
    '3': () => handleKey('3'),
    '0': () => handleKey('0'),
    's': () => handleKey('s'),
    'escape': () => handleKey('escape'),
  }, !modalStudent)

  const studentStats = useCallback((sid: number) => {
    let p = 0, a = 0, e = 0
    sorted.forEach(d => {
      const st = cs(sid, d)
      if (st === 'present') p++
      else if (st === 'absent') a++
      else if (st === 'excused') e++
    })
    return { present: p, absent: a, excused: e, total: sorted.length, pct: sorted.length ? Math.round(p/sorted.length*100) : 0 }
  }, [sorted, cs])

  async function moveStudent(idx:number,dir:number){
    const i=fs.findIndex(s=>s.id===idx);if(i===-1)return
    const s=[...students];const j=i+dir;if(j<0||j>=s.length)return
    [s[i],s[j]]=[s[j],s[i]];setStudents(s)
  }

  const SkeletonRow = () => (
    <div className="flex items-center gap-3 px-5 py-4">
      <div className="h-10 w-10 rounded-xl shimmer-enhanced bg-stone-200 dark:bg-slate-700" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-32 rounded shimmer-enhanced bg-stone-200 dark:bg-slate-700" />
        <div className="h-2 w-20 rounded shimmer-enhanced bg-stone-100 dark:bg-slate-800" />
      </div>
    </div>
  )

  const studentNameMap:Record<number,string>={};students.forEach(s=>{studentNameMap[s.id]=s.full_name})

  if (showPayReport) {
    const PayRpt = React.lazy(() => import('./PaymentReportPage'))
    return (
      <React.Suspense fallback={<div className="glass-card p-8 text-center"><div className="mx-auto h-8 w-8 animate-spin rounded-full border-[3px] border-stone-200 border-t-brand" /></div>}>
        <PayRpt groupId={groupId} groupName={groupName} token={token} year={year} month={month} onBack={() => setShowPayReport(false)} studentNameMap={studentNameMap} lang={l} />
      </React.Suspense>
    )
  }

  return (
    <section className="space-y-6 relative">
      {confetti.map(p=><div key={p.id} className="fixed pointer-events-none z-[999]" style={{left:`${p.x}%`,top:'50%'}}><div className="confetti-piece" style={{background:p.color}} /></div>)}


      <div className="glass-card overflow-hidden">
        <div className="grid lg:grid-cols-[1fr_280px]">
          <div className="border-b border-stone-200/60 dark:border-slate-700/60 p-6 lg:border-b-0 lg:border-r">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex h-7 items-center gap-1.5 rounded-lg gradient-brand-r px-3 text-xs font-semibold text-white shadow-md shadow-brand"><CalendarDays className="h-3.5 w-3.5" /> {t.am_badge}</span>
              <span className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 px-2.5 text-xs font-medium text-stone-600 dark:text-slate-400"><Clock3 className="h-3 w-3" /> {groupDays.join(' / ')}</span>
              <span className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 px-2.5 text-xs font-medium text-stone-600 dark:text-slate-400"><BarChart3 className="h-3 w-3" /> {students.length} {t.am_student.toLowerCase()}</span>
            </div>
            <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-stone-800 dark:text-slate-200">{groupName}</h2>
                <p className="mt-1 text-sm text-stone-500 dark:text-slate-400">{MO[month]} {year} &middot; {sorted.length} kun &middot; {students.length} {t.am_student.toLowerCase()}</p>
              </div>
              <div className="flex gap-1.5">
                {([
                  {k:'present' as K,l:'Kelgan',bg:'bg-brand-soft',tx:'text-brand',dot:'bg-brand'},
                  {k:'absent' as K,l:"Yo'q",bg:'bg-red-50 dark:bg-red-900/30',tx:'text-red-700 dark:text-red-400',dot:'bg-red-500'},
                  {k:'excused' as K,l:'Sababli',bg:'bg-amber-50 dark:bg-amber-900/30',tx:'text-amber-700 dark:text-amber-400',dot:'bg-amber-400'},
                  {k:'none' as K,l:"Bo'sh",bg:'bg-stone-100 dark:bg-slate-800',tx:'text-stone-600 dark:text-slate-400',dot:'bg-stone-400'},
                ]).map(({k,l,bg,tx,dot}) => (
                  <div key={k} className={`min-w-[60px] rounded-xl ${bg} px-3 py-2 text-center shadow-sm transition-all hover:-translate-y-0.5`}>
                    <div className={`text-lg font-bold ${tx}`}>{mc[k]}</div>
                    <div className="flex items-center justify-center gap-1 text-[10px] font-medium text-stone-500 dark:text-slate-400"><div className={`h-1.5 w-1.5 rounded-full ${dot}`} />{l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="p-5">
            <div className="flex items-center justify-between">
              <button type="button" onClick={()=>chMon(-1)} className="flex h-8 w-8 items-center justify-center rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-stone-600 dark:text-slate-400 shadow-sm transition-all hover:bg-brand-soft dark:hover:bg-brand-soft hover:border-brand hover:text-brand hover:-translate-y-0.5"><ChevronLeft className="h-4 w-4" /></button>
              <div className="text-center"><div className="text-xs font-medium text-stone-400 dark:text-slate-500">Oy</div><div className="text-sm font-bold gradient-text">{MO[month]} {year}</div></div>
              <button type="button" onClick={()=>chMon(1)} className="flex h-8 w-8 items-center justify-center rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-stone-600 dark:text-slate-400 shadow-sm transition-all hover:bg-brand-soft dark:hover:bg-brand-soft hover:border-brand hover:text-brand hover:-translate-y-0.5"><ChevronRight className="h-4 w-4" /></button>
            </div>
            <div className="mt-3 grid grid-cols-6 gap-1.5">
              {ms.map(({label,index}) => (
                <button key={label} type="button" onClick={()=>setMonth(index)}
                  className={`h-8 rounded-lg text-xs font-semibold transition-all ${index===month?'gradient-brand-r text-white shadow-md shadow-brand hover:-translate-y-0.5':'bg-stone-100 dark:bg-slate-800 text-stone-600 dark:text-slate-400 hover:bg-brand-soft dark:hover:bg-brand-soft hover:text-brand'}`}>{label}</button>
              ))}
            </div>
            <div className="mt-2 flex gap-1.5">
              <input value={year} onChange={e=>setYear(Number(e.target.value))} type="number" min="2020" max="2100" className="h-8 flex-1 rounded-lg border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs outline-none transition-all focus:border-brand focus:ring-2 focus:ring-brand dark:text-slate-200" />
              <button type="button" onClick={()=>{const d=new Date();setYear(d.getFullYear());setMonth(d.getMonth());setSelDate(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`)}} className="btn-ghost h-8 px-2.5 text-[10px]"><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-brand" />{t.am_today}</button>
            </div>
            <div className="mt-4 rounded-xl gradient-brand-dark p-4 shadow-xl shadow-brand">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1"><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70">Video qo'llanma</p><p className="mt-0.5 text-sm font-semibold text-white">2 daqiqada o'rganing</p><p className="mt-1 text-[11px] text-white/60">Davomatni qanday tez belgilash</p></div>
                <button type="button" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20 text-white shadow-lg backdrop-blur-sm transition-all hover:bg-white/30 hover:scale-110"><Play className="h-4 w-4 ml-0.5" /></button>
              </div>
              <div className="mt-3 flex gap-1.5">{['2 daqiqa','Vizual','Interaktiv'].map(t => <span key={t} className="rounded-lg bg-white/10 px-2.5 py-0.5 text-[10px] font-medium text-white/70">{t}</span>)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <form onSubmit={addS} className="flex-1 glass-card p-5">
          <div className="mb-3 flex items-center gap-2 border-b border-stone-100 dark:border-slate-700 pb-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg gradient-brand text-white text-xs font-bold shadow-sm">+</div>
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-slate-400">{editS ? t.am_edit_student : t.am_add_student}</p>
            {!editS && <span className="text-[10px] text-stone-400 dark:text-slate-500 ml-auto flex items-center gap-1"><span className="keyboard-hint">Enter</span> {t.am_add_btn.toLowerCase()}</span>}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[160px] flex-1"><p className="mb-1.5 text-xs font-medium text-stone-500 dark:text-slate-400">{t.am_name}</p><input value={sName} onChange={e=>setSName(e.target.value)} placeholder="Aliyev Alisher" className="input-premium" required /></div>
            <div className="w-[130px]"><p className="mb-1.5 text-xs font-medium text-stone-500 dark:text-slate-400">{t.am_phone}</p><input value={sPhone} onChange={e=>setSPhone(e.target.value)} placeholder="+998" className="input-premium" /></div>
            <div className="w-[140px]"><p className="mb-1.5 text-xs font-medium text-stone-500 dark:text-slate-400">{t.am_parent}</p><input value={sParent} onChange={e=>setSParent(e.target.value)} placeholder={t.am_parent} className="input-premium" /></div>
            <div className="w-[130px]"><p className="mb-1.5 text-xs font-medium text-stone-500 dark:text-slate-400">{t.am_parent_phone}</p><input value={sParentPhone} onChange={e=>setSParentPhone(e.target.value)} placeholder="+998" className="input-premium" /></div>
            <div className="w-[140px]"><p className="mb-1.5 text-xs font-medium text-stone-500 dark:text-slate-400">{t.am_birth_date}</p><input value={sBirth} onChange={e=>setSBirth(e.target.value)} type="date" className="input-premium" /></div>
            <div className="w-[100px]"><p className="mb-1.5 text-xs font-medium text-stone-500 dark:text-slate-400">{t.am_status_field}</p><select value={sStat} onChange={e=>setSStat(e.target.value==='inactive'?'inactive':'active')} className="input-premium"><option value="active">{t.am_active}</option><option value="inactive">{t.am_inactive}</option></select></div>
            <button type="submit" disabled={creating} className="btn-primary h-11 text-xs">{editS ? <Save className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}{creating ? t.dash_saving : editS ? t.am_save_btn : t.am_add_btn}</button>
            {editS && <button type="button" onClick={rsf} className="btn-ghost h-11 text-xs"><X className="h-3.5 w-3.5" /> {t.am_cancel_btn}</button>}
          </div>
        </form>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex h-12 w-full items-center gap-3 rounded-2xl border border-stone-200/60 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 px-5 shadow-sm transition-all focus-within:border-brand focus-within:shadow-xl focus-within:shadow-brand focus-within:ring-2 focus-within:ring-brand lg:w-44">
              <Search className="h-4 w-4 shrink-0 text-stone-400 dark:text-slate-500" />
              <input value={q} onChange={e=>setQ(e.target.value)} placeholder={t.am_search} className="h-full w-full bg-transparent text-sm outline-none dark:text-slate-200" />
            </div>
            <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value as typeof filterStatus)} className="btn-ghost h-12 px-3 text-xs cursor-pointer">
              <option value="all">{t.am_filter_all}</option><option value="active">{t.am_filter_active}</option><option value="inactive">{t.am_filter_inactive}</option>
            </select>
            <button type="button" onClick={() => setBatchMode(b=>!b)}
              className={`btn-ghost h-12 px-3 text-xs ${batchMode?'bg-brand-soft border-brand text-brand':''}`}>
              {batchMode ? t.am_select_cancel : t.am_select_mode}
            </button>
            {batchMode && <button type="button" onClick={batchDelete} disabled={selectedStudents.size===0} className="btn-ghost h-12 px-3 text-xs text-red-600 hover:text-red-700 disabled:opacity-40"><Trash2 className="h-3.5 w-3.5" /> {selectedStudents.size} ta</button>}
            {batchMode && selectedStudents.size>0 && <>
              <button type="button" onClick={()=>batchSetStatus('active')} className="btn-ghost h-12 px-3 text-xs text-brand hover:text-brand"><Users className="h-3.5 w-3.5" /> Aktiv</button>
              <button type="button" onClick={()=>batchSetStatus('inactive')} className="btn-ghost h-12 px-3 text-xs text-amber-600 hover:text-amber-700"><Users className="h-3.5 w-3.5" /> Nofaol</button>
            </>}
            <div className="flex gap-1">
              {(['list','calendar','weekly'] as const).map(m => (
                <button key={m} type="button" onClick={() => setViewMode(m)}
                  className={`btn-ghost h-12 w-12 p-0 ${viewMode===m?'bg-brand-soft border-brand text-brand':''}`}
                  title={m==='list'?t.am_view_list:m==='calendar'?t.am_view_calendar:t.am_view_weekly}>
                  {m==='list'?<Grid3X3 className="h-4 w-4"/>:m==='calendar'?<Calendar className="h-4 w-4"/>:<CalendarDays className="h-4 w-4"/>}
                </button>
              ))}
            </div>
            <button type="button" onClick={handleExport} className="btn-ghost h-12 px-3 text-xs" title={t.am_view_list}><Download className="h-4 w-4" /></button>
            <a href={`/api/groups/${groupId}/export/excel?year=${year}&month=${month+1}`} onClick={e => { if(!token){e.preventDefault();return}; const tk=token; const url=e.currentTarget.href; fetch(url,{headers:{Authorization:`Bearer ${tk}`}}).then(r=>{if(!r.ok)throw Error();return r.blob()}).then(b=>{const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=`${groupName}_${month+1}_${year}.xlsx`;a.click()}).catch(()=>toast('error',t.toast_excel_error)); e.preventDefault() }} className="btn-ghost h-12 px-3 text-xs" title={t.am_view_list}><FileSpreadsheet className="h-4 w-4" /></a>
            <a href={`/api/groups/${groupId}/export/pdf?year=${year}&month=${month+1}`} onClick={e => { const tk=token; const url=e.currentTarget.href; fetch(url,{headers:{Authorization:`Bearer ${tk}`}}).then(r=>{if(!r.ok)throw Error();return r.blob()}).then(b=>{const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=`${groupName}_${month+1}_${year}.pdf`;a.click()}).catch(()=>toast('error',t.toast_pdf_error)); e.preventDefault() }} className="btn-ghost h-12 px-3 text-xs" title={t.am_view_weekly}><FileSpreadsheet className="h-4 w-4" /></a>
            <button type="button" onClick={()=>setShowPayReport(b=>!b)} className={`btn-ghost h-12 px-3 text-xs ${showPayReport?'bg-brand-soft border-brand text-brand':''}`}><DollarSign className="h-4 w-4" /> {showPayReport?t.am_attendance_toggle:t.am_payment_toggle}</button>
            <button type="button" onClick={()=>setShowImport(true)} className="btn-ghost h-12 px-3 text-xs" title={t.am_import_title}><Upload className="h-4 w-4" /> CSV</button>
          </div>
      </div>

      {loading ? (
        <div className="glass-card divide-y divide-stone-100 dark:divide-slate-700">
          <SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow />
        </div>
      ) : sorted.length === 0 ? (
        <div className="glass-card border-dashed p-16 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-stone-100 dark:bg-slate-800"><CalendarDays className="h-8 w-8 text-stone-300 dark:text-slate-600" /></div>
          <p className="text-base font-semibold text-stone-700 dark:text-slate-300">{t.am_no_schedule}</p>
          <p className="mt-1 text-sm text-stone-500 dark:text-slate-400">{t.am_no_schedule_desc}</p>
        </div>
      ) : (
        <>
          <div className="hidden items-center gap-2 rounded-xl bg-stone-50 dark:bg-slate-800/50 px-5 py-2 text-xs text-stone-400 dark:text-slate-500 shadow-sm lg:flex">
            <KeyboardHint keys="1 2 3 0" label={t.am_keyboard_quick} />
            <KeyboardHint keys="S" label={t.am_keyboard_save} />
            <KeyboardHint keys="Esc" label={t.am_keyboard_cancel} />
          </div>

          <div className="grid gap-5 lg:grid-cols-[1fr_230px]">
            <div className="glass-card p-5">
              <div className="mb-4 flex items-center justify-between">
                <div><p className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-slate-400">{t.am_date_select}</p><p className="mt-0.5 text-lg font-bold gradient-text">{cur ? `${fd(cur)} ${fw(cur)}` : t.am_not_selected}</p></div>
                <div className="flex items-center gap-1.5 text-xs text-stone-400 dark:text-slate-500"><div className={`h-2 w-2 rounded-full ${pc>0?'bg-amber-400':'bg-brand'}`} />{fs.length} ta</div>
              </div>
              <div className="flex flex-wrap gap-2">
                {sorted.map(d => {
                  const isExc=excDays.has(d)
                  return (
                  <div key={d} className="relative">
                    <button type="button" onClick={()=>{setSelDate(d);setTopicInput(topics[d]||'')}}
                      className={`min-w-[52px] rounded-xl border px-2.5 py-1.5 text-center text-sm font-semibold transition-all ${
                        isExc ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 line-through'
                        : d===cur ? 'border-brand gradient-brand-r text-white shadow-lg shadow-brand hover:-translate-y-0.5'
                        : td(d) ? 'border-brand bg-brand-soft text-brand'
                        : 'border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-stone-600 dark:text-slate-400 hover:border-brand dark:hover:border-brand hover:bg-brand-soft dark:hover:bg-brand-soft hover:-translate-y-0.5'
                      }`}>
                      <span className="block text-sm">{fd(d)}</span>
                      <span className={`block text-[10px] font-medium ${d===cur?'text-white/70':'text-stone-500 dark:text-slate-500'}`}>{fw(d)}</span>
                    </button>
                    <button type="button" onClick={(e)=>{e.stopPropagation();isExc?removeExcDay(d):setExcConfirm({date:d})}} className={`absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-white text-[9px] font-bold shadow hover:scale-110 transition-all ${isExc?'bg-amber-400 hover:bg-red-500':'bg-stone-300 dark:bg-slate-600 hover:bg-brand'}`}>{isExc?'×':'+'}</button>
                  </div>
                )})}
                {cur && <div className="mt-3 flex items-center gap-2"><input value={topicInput} onChange={e=>setTopicInput(e.target.value)} placeholder={t.am_topic_placeholder} className="input-premium h-9 text-xs flex-1" /><button type="button" onClick={saveTopic} disabled={topicLoading||!topicInput.trim()} className="btn-primary h-9 text-xs disabled:opacity-50">{topicLoading ? '...' : t.am_topic_save}</button></div>}
                {excDays.size>0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-600">{t.am_exc_days}:</span>
                    {[...excDays].sort().map(d=>(
                      <span key={d} className="inline-flex items-center gap-1 rounded-lg bg-amber-50 dark:bg-amber-900/30 px-2 py-1 text-[10px] font-medium text-amber-700 dark:text-amber-400">{fd(d)} {fw(d)}
                        <button type="button" onClick={()=>removeExcDay(d)} className="hover:text-red-500"><X className="h-3 w-3" /></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="glass-card p-5">
              <div className="mb-4 flex items-center gap-2"><Users className="h-4 w-4 text-stone-400 dark:text-slate-500" /><p className="text-sm font-bold text-stone-800 dark:text-slate-200">{t.am_quick_set}</p></div>
              <div className="grid grid-cols-2 gap-2">
                {op.map(({v,k,l,ic:Icon}) => (
                  <button key={k} type="button" onClick={()=>qf(v)} disabled={!cur||fs.length===0}
                    className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-semibold shadow-sm transition-all disabled:cursor-not-allowed disabled:opacity-40 ${sb[k]} hover:-translate-y-0.5`}>
                    <Icon className="h-3.5 w-3.5" /> {l}
                  </button>
                ))}
              </div>
              <div className="mt-4 rounded-xl border border-stone-200/60 dark:border-slate-700 bg-stone-50/50 dark:bg-slate-800/50 p-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-stone-400 dark:text-slate-500">{t.am_today_title}</p>
                <div className="grid grid-cols-4 gap-1.5 text-center">
                  {(['present','absent','excused','none'] as K[]).map(k => (
                    <div key={k} className="rounded-lg bg-white dark:bg-slate-800 px-1.5 py-2 shadow-sm">
                      <div className="text-sm font-bold text-stone-800 dark:text-slate-200">{dc[k]}</div>
                      <div className="flex items-center justify-center gap-1 text-[10px] text-stone-500 dark:text-slate-400"><div className={`h-1.5 w-1.5 rounded-full ${sd[k]}`} />{ss[k]}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-stone-200/60 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 px-6 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5 text-sm">
              <div className={`h-2.5 w-2.5 rounded-full transition-all duration-500 ${pc>0?'bg-amber-400 shadow-sm shadow-amber-400/50 animate-pulse':'bg-brand shadow-sm shadow-brand-lg'}`} />
              <span className="text-stone-500 dark:text-slate-400">
                {pc>0 ? <span className="font-semibold text-amber-700 dark:text-amber-400">{pc} ta</span> : t.am_filter_all} {pc>0 ? t.am_not_selected : t.am_save_all}
              </span>
              {pc>0 && <span className="hidden text-xs text-stone-400 dark:text-slate-500 lg:inline">— <KeyboardHint keys="S" /> {t.am_keyboard_save}</span>}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={rst} disabled={pc===0} className="btn-ghost h-9 px-4 text-xs disabled:opacity-40 disabled:hover:translate-y-0"><RotateCcw className="h-3.5 w-3.5" /> {t.am_reset}</button>
              <button type="button" onClick={save} disabled={saving||pc===0} className="btn-primary h-9 px-5 text-xs disabled:opacity-50 disabled:hover:translate-y-0"><Save className="h-3.5 w-3.5" /> {saving ? t.dash_saving : t.am_save_all}</button>
            </div>
          </div>

          {viewMode === 'calendar' ? (
            <div className="glass-card overflow-hidden p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-slate-400">{t.am_calendar_view}</p>
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-brand-soft px-2.5 py-1 text-sm font-bold text-brand">{MO[month]} {year}</span>
                  <button type="button" onClick={()=>{const d=new Date();setYear(d.getFullYear());setMonth(d.getMonth());setSelDate(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`)}} className="btn-ghost h-8 px-2.5 text-[10px]"><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-brand" />{t.am_today}</button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {['Du','Se','Chor','Pay','Ju','Shan','Yak'].map(d => <div key={d} className="text-center text-[10px] font-semibold text-stone-400 dark:text-slate-500 py-1">{d}</div>)}
                {Array.from({length: new Date(year, month, 1).getDay() === 0 ? 6 : new Date(year, month, 1).getDay() - 1}).map((_, i) => <div key={`e-${i}`} />)}
                {Array.from({length: new Date(year, month + 1, 0).getDate()}).map((_, i) => {
                  const day = i + 1
                  const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
                  const isScheduleDay = sorted.includes(dateStr)
                  const dayStudents = isScheduleDay ? students.length : 0
                  const dayPresent = isScheduleDay ? students.filter(s => cs(s.id, dateStr) === 'present').length : 0
                  const pct = dayStudents ? Math.round(dayPresent/dayStudents*100) : 0
                  const isToday = new Date().getFullYear() === year && new Date().getMonth() === month && new Date().getDate() === day
                  return (
                    <button key={day} onClick={() => isScheduleDay && setSelDate(dateStr)}
                      className={`relative rounded-xl p-2 text-center transition-all ${
                        isScheduleDay ? 'hover:bg-brand-soft dark:hover:bg-brand-soft cursor-pointer' : 'opacity-40'
                      } ${isToday ? 'gradient-brand shadow-lg shadow-brand' : ''} ${dateStr === cur && !isToday ? 'bg-brand-soft' : ''}`}>
                      <div className={`text-xs font-bold ${isToday ? 'text-white' : 'text-stone-700 dark:text-slate-300'}`}>{day}</div>
                      {isScheduleDay && (
                        <div className="mt-1">
                          <div className="progress-bar">
                            <div className={`progress-bar-fill progress-animate ${pct >= 80 ? 'bg-brand' : pct >= 50 ? 'bg-amber-400' : 'bg-red-500'}`} style={{width:`${pct}%`}} />
                          </div>
                          <div className={`mt-0.5 text-[9px] ${isToday ? 'text-white/90' : 'text-stone-400 dark:text-slate-500'}`}>{dayPresent}/{dayStudents}</div>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : viewMode === 'weekly' ? (
            <div className="glass-card overflow-hidden p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-slate-400">{t.am_weekly_view}</p>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={()=>setWeekOffset(w=>w-1)} className="btn-ghost h-8 px-2.5 text-xs"><ChevronLeft className="h-4 w-4" /></button>
                  <span className="min-w-[110px] text-center text-xs font-bold text-stone-700 dark:text-slate-300">{weekLabel}</span>
                  <button type="button" onClick={()=>setWeekOffset(w=>w+1)} className="btn-ghost h-8 px-2.5 text-xs"><ChevronRight className="h-4 w-4" /></button>
                </div>
              </div>
              {weekDays.length === 0 ? (
                <p className="py-10 text-center text-sm text-stone-400 dark:text-slate-500">{t.am_week_empty}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr>
                        <th className="sticky left-0 z-10 border-b border-stone-200/60 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-slate-400">{t.am_student_header}</th>
                        {weekDays.map(d=>(
                          <th key={d} className={`border-b border-stone-200/60 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 px-1 py-2 text-center text-xs ${d===cur?'text-brand':''}`}>
                            <div className="font-bold">{fd(d)}</div><div className="text-[10px] font-medium text-stone-400 dark:text-slate-500">{fw(d)}</div>
                          </th>
                        ))}
                        <th className="border-b border-stone-200/60 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-slate-400">{t.am_week_summary}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fs.map(st=>{
                        const statuses=weekDays.map(d=>cs(st.id,d))
                        const present=statuses.filter(s=>s==='present').length
                        const total=weekDays.length
                        const sumCls=total>0&&present===total?'bg-brand-soft text-brand':present===0?'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400':'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                        return (
                          <tr key={st.id} className="border-b border-stone-100 dark:border-slate-700/60 transition-colors hover:bg-brand-soft dark:hover:bg-brand-soft">
                            <td className="sticky left-0 z-10 bg-white dark:bg-slate-800 px-3 py-2">
                              <span className="flex items-center gap-2">
                                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${getAvatarStyle(st.full_name).gradient} text-[10px] font-bold text-white`}>{st.full_name.slice(0,1).toUpperCase()}</span>
                                <span className="truncate font-medium text-stone-700 dark:text-slate-300">{st.full_name}</span>
                              </span>
                            </td>
                            {weekDays.map(d=>{
                              const k=sk(cs(st.id,d))
                              return (
                                <td key={d} className="px-1 py-1.5 text-center">
                                  <button type="button" onClick={()=>toggle(st.id,d)} className={`attendance-dot ${sd[k]} ${d===cur?'ring-2 ring-brand ring-offset-2 dark:ring-offset-slate-800':''}`} title={`${fd(d)} - ${sl[k]}`}>{ss[k]}</button>
                                </td>
                              )
                            })}
                            <td className="px-3 py-2 text-center">
                              <span className={`inline-flex min-w-[44px] items-center justify-center rounded-lg px-2 py-1 text-xs font-bold ${sumCls}`}>{present}/{total}</span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-stone-200/60 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg shadow-stone-900/5">
              <div className="hidden grid-cols-[minmax(180px,1fr)_minmax(190px,1fr)_1fr] border-b border-stone-200/60 dark:border-slate-700 bg-gradient-to-r from-stone-50 to-stone-100/50 dark:from-slate-800 dark:to-slate-800/50 px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-slate-400 lg:grid">
                <div>{t.am_student_header}</div><div>{t.am_status_header}</div><div>{t.am_monthly_header}</div>
              </div>

              {fs.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 border-b border-stone-100 dark:border-slate-700 px-5 py-3">
                  <button type="button" onClick={()=>setLetterFilter('all')} className={`flex h-7 min-w-[30px] items-center justify-center rounded-lg px-2 text-[11px] font-semibold transition-all ${letterFilter==='all'?'gradient-brand-r text-white shadow-md':'border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-stone-500 dark:text-slate-400 hover:border-brand dark:hover:border-brand hover:text-brand dark:hover:text-brand'}`}>{t.am_letter_all}</button>
                  {letters.map(l=>(
                    <button key={l} type="button" onClick={()=>setLetterFilter(l)} className={`flex h-7 min-w-[30px] items-center justify-center rounded-lg px-2 text-[11px] font-bold transition-all ${letterFilter===l?'gradient-brand-r text-white shadow-md':'border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-stone-500 dark:text-slate-400 hover:border-brand dark:hover:border-brand hover:text-brand dark:hover:text-brand'}`}>{l}</button>
                  ))}
                </div>
              )}

              {fs.length === 0 ? (
                <div className="flex flex-col items-center gap-4 p-12 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-100 dark:bg-slate-700"><Users className="h-7 w-7 text-stone-300 dark:text-slate-500" /></div>
                  <p className="text-sm font-medium text-stone-500 dark:text-slate-400">{q ? t.am_no_results : t.am_no_students}</p>
                </div>
              ) : (
                <div className="divide-y divide-stone-100 dark:divide-slate-700">
                  {ffs.map((st, si) => {
                    const letter = letterOf(st.full_name)
                    const showHeader = si === 0 || letterOf(ffs[si - 1].full_name) !== letter
                    const selS = cs(st.id, cur); const selK = sk(selS)
                    const stats = studentStats(st.id)
                    return (
                    <React.Fragment key={st.id}>
                      {showHeader && (
                        <div className="flex items-center gap-2 bg-stone-50 dark:bg-slate-800/70 px-5 py-1.5">
                          <span className="flex h-5 w-5 items-center justify-center rounded-md gradient-brand text-[10px] font-bold text-white">{letter}</span>
                          <span className="text-[10px] font-medium text-stone-400 dark:text-slate-500">{ffs.filter(s=>letterOf(s.full_name)===letter).length} ta</span>
                        </div>
                      )}
                      <article draggable onDragStart={e=>e.dataTransfer.setData('text/plain',String(st.id))} onDragOver={e=>e.preventDefault()} onDrop={e=>{const id=Number(e.dataTransfer.getData('text/plain'));moveStudent(id,students.findIndex(s=>s.id===st.id)>students.findIndex(s=>s.id===id)?-1:1)}}
                        className="stagger-enter group grid gap-3 px-5 py-4 transition-all hover:bg-brand-soft lg:grid-cols-[minmax(180px,1fr)_minmax(190px,1fr)_1fr] lg:items-center card-shine">
                        <div className="flex items-center gap-3">
                          {batchMode && <input type="checkbox" checked={selectedStudents.has(st.id)} onChange={()=>{const n=new Set(selectedStudents);n.has(st.id)?n.delete(st.id):n.add(st.id);setSelectedStudents(n)}} className="h-4 w-4 rounded border-stone-300 dark:border-slate-600 text-brand focus:ring-brand" />}
                          <button type="button" onClick={()=>openStudentModal(st)} className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${getAvatarStyle(st.full_name).gradient} text-base font-bold text-white shadow-sm transition-all group-hover:shadow-md group-hover:scale-110 hover:cursor-pointer`}>
                            {st.full_name.slice(0,1).toUpperCase()}
                          </button>
                          <div className="min-w-0 flex-1">
                            <button type="button" onClick={()=>openStudentModal(st)} className="truncate text-sm font-semibold text-stone-800 dark:text-slate-200 hover:text-brand dark:hover:text-brand transition-colors text-left">{st.full_name}</button>
                            <p className="truncate text-xs text-stone-400 dark:text-slate-500">
                              {st.phone ?? t.am_phone_missing}
                              <span className="mx-1.5">&middot;</span>
                              {st.status==='active' ? <span className="font-medium text-brand">{t.am_active}</span> : <span className="text-stone-400 dark:text-slate-500">{t.am_inactive}</span>}
                              {st.parent_name && <><span className="mx-1.5">&middot;</span>{st.parent_name}</>}
                            </p>
                          </div>
                          <div className="flex shrink-0 gap-1 opacity-0 transition-all group-hover:opacity-100">
                            <button type="button" onClick={()=>{setEditS(st.id);setSName(st.full_name);setSPhone(st.phone??'');setSParent(st.parent_name??'');setSParentPhone(st.parent_phone??'');setSBirth(st.birth_date??'');setSStat(st.status==='inactive'?'inactive':'active')}}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-stone-400 dark:text-slate-400 shadow-sm transition-all hover:border-brand hover:bg-brand-soft hover:text-brand dark:hover:bg-brand-soft dark:hover:text-brand" title={t.nav_edit}><Pencil className="h-3.5 w-3.5" /></button>
                            <button type="button" onClick={()=>setDeleteTarget(st)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-stone-400 dark:text-slate-400 shadow-sm transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/30 dark:hover:text-red-400" title={t.nav_delete}><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {op.map(({v,k,l,ic:Icon}) => {
                            const active = selK===k
                            return (
                              <button key={k} type="button" onClick={()=>setCell(st.id,cur,v)}
                                className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-all ${active ? sb[k]+' hover:-translate-y-0.5' : 'border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-stone-600 dark:text-slate-400 shadow-sm hover:border-brand dark:hover:border-brand hover:bg-brand-soft dark:hover:bg-brand-soft hover:text-brand hover:-translate-y-0.5 hover:shadow-md'}`}>
                                <Icon className="h-3.5 w-3.5" /> {l}
                              </button>
                            )
                          })}
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="flex flex-wrap gap-1">
                            {sorted.map(d => {
                              const k = sk(cs(st.id, d))
                              return (
                                <button key={`${st.id}-${d}`} type="button"
                                  onClick={()=>{setSelDate(d);toggle(st.id,d)}}
                                  className={`attendance-dot ${sd[k]} ${d===cur ? 'ring-2 ring-brand ring-offset-2 dark:ring-offset-slate-800' : ''}`}
                                  title={`${fd(d)} - ${sl[k]}`}>{ss[k]}
                                </button>
                              )
                            })}
                          </div>
                          <div className="hidden shrink-0 items-center gap-1.5 lg:flex">
                            <div className="h-5 w-16 overflow-hidden rounded-full bg-stone-100 dark:bg-slate-700 shadow-inner">
                              <div className={`h-full rounded-full transition-all duration-500 ${stats.pct >= 80 ? 'bg-brand' : stats.pct >= 50 ? 'bg-amber-400' : 'bg-red-500'}`} style={{width:`${stats.pct}%`}} />
                            </div>
                            <span className="text-[10px] font-semibold text-stone-500 dark:text-slate-400">{stats.pct}%</span>
                          </div>
                        </div>
                      </article>
                    </React.Fragment>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {modalStudent && (
        <div className="modal-overlay" onClick={()=>setModalStudent(null)} onKeyDown={e=>{if(e.key==='Escape')setModalStudent(null)}} tabIndex={-1}>
          <div className="modal-content" onClick={e=>e.stopPropagation()}>
            <div className="gradient-brand-r px-6 py-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${getAvatarStyle(modalStudent.full_name).gradient} text-2xl font-bold text-white shadow-lg`}>{modalStudent.full_name.slice(0,1).toUpperCase()}</div>
                  <div>
                    <h3 className="text-lg font-bold text-white">{modalStudent.full_name}</h3>
                    <p className="text-sm text-white/70">{modalStudent.phone || t.am_phone_missing}{modalStudent.parent_name && ` · ${modalStudent.parent_name}`}</p>
                  </div>
                </div>
                <button type="button" onClick={()=>setModalStudent(null)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 text-white hover:bg-white/30 transition-all"><X className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="p-6">
              {(() => {
                const apiStats = studentStatsData[modalStudent.id]
                const st = apiStats ? { present: apiStats.present, absent: apiStats.absent, excused: apiStats.excused, total: apiStats.total_lessons, pct: apiStats.percentage } : studentStats(modalStudent.id)
                return (
                  <div className="space-y-5">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-xl bg-brand-soft px-4 py-3 text-center">
                        <p className="text-2xl font-bold text-brand">{st.present}</p>
                        <p className="text-xs text-stone-500 dark:text-slate-400">{t.am_stats_present}</p>
                      </div>
                      <div className="rounded-xl bg-red-50 dark:bg-red-900/30 px-4 py-3 text-center">
                        <p className="text-2xl font-bold text-red-600 dark:text-red-400">{st.absent}</p>
                        <p className="text-xs text-stone-500 dark:text-slate-400">{t.am_stats_absent}</p>
                      </div>
                      <div className="rounded-xl bg-amber-50 dark:bg-amber-900/30 px-4 py-3 text-center">
                        <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{st.excused}</p>
                        <p className="text-xs text-stone-500 dark:text-slate-400">{t.am_stats_excused}</p>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-stone-500 dark:text-slate-400">{t.am_stats_percentage}</p>
                        <span className="text-sm font-bold text-stone-800 dark:text-slate-200">{st.pct}%</span>
                      </div>
                      <div className="progress-bar h-3">
                        <div className={`progress-bar-fill h-3 ${st.pct >= 80 ? 'bg-brand' : st.pct >= 50 ? 'bg-amber-400' : 'bg-red-500'}`} style={{width:`${st.pct}%`}} />
                      </div>
                    </div>

                    {apiStats?.monthly && (
                      <div>
                        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-slate-400">{t.am_stats_monthly}</p>
                        <div className="grid grid-cols-6 gap-1.5">
                          {apiStats.monthly.map(m => (
                            <div key={m.month} className="rounded-lg bg-stone-50 dark:bg-slate-800 p-2 text-center">
                              <div className="text-[9px] font-medium text-stone-400 dark:text-slate-500">{MO[m.month-1]}</div>
                              <div className="text-sm font-bold text-stone-700 dark:text-slate-300">{m.present}/{m.total}</div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-3">
                          <svg viewBox="0 0 220 60" className="w-full h-16">
                            {apiStats.monthly.map((m,i)=>{
                              const x=i*36+4;const h=m.total?(m.present/m.total)*50:0;const y=55-h
                              return <g key={m.month}>
                                <rect x={x} y={y} width={24} height={h} rx={3} fill={h>30?'#059669':h>15?'#f59e0b':'#ef4444'} opacity={0.8}/>
                                <text x={x+12} y={58} textAnchor="middle" fontSize="6" fill="#94a3b8">{MO[m.month-1].slice(0,2)}</text>
                                <text x={x+12} y={y-2} textAnchor="middle" fontSize="5" fill="#64748b">{m.present}</text>
                              </g>
                            })}
                          </svg>
                        </div>
                      </div>
                    )}

                    <div>
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-slate-400">{t.am_stats_by_day}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {sorted.map(d => {
                          const k = sk(cs(modalStudent.id, d))
                          return (
                            <div key={d} className={`attendance-dot h-7 min-w-[2rem] ${sd[k]}`} title={`${fd(d)} - ${sl[k]}`}>
                              {ss[k]}
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    <div>
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-slate-400">{t.am_payments_title}</p>
                      {(() => {
                        const paidMonth=(payments[modalStudent.id]||[]).reduce((s,p)=>s+p.amount,0)
                        const fee=groupFee||0
                        const remaining=Math.max(fee-paidMonth,0)
                        const state=fee>0?(paidMonth>=fee?'paid':paidMonth>0?'partial':'unpaid'):'none'
                        const stateCfg:{k:string;l:string;c:string}[]=[
                          {k:'paid',l:t.am_payment_paid,c:'bg-brand-soft text-brand'},
                          {k:'partial',l:t.am_payment_partial,c:'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'},
                          {k:'unpaid',l:t.am_payment_unpaid,c:'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400'},
                        ]
                        return (<>
                          {fee>0 && (
                            <div className="mb-3 grid grid-cols-3 gap-2">
                              <div className="rounded-xl bg-stone-50 dark:bg-slate-800 px-3 py-2 text-center">
                                <p className="text-[10px] text-stone-400 dark:text-slate-500">{t.am_payment_fee}</p>
                                <p className="text-sm font-bold text-stone-700 dark:text-slate-300">{fee.toLocaleString()}</p>
                              </div>
                              <div className="rounded-xl bg-stone-50 dark:bg-slate-800 px-3 py-2 text-center">
                                <p className="text-[10px] text-stone-400 dark:text-slate-500">{t.am_payment_paid_sum}</p>
                                <p className="text-sm font-bold text-brand">{paidMonth.toLocaleString()}</p>
                              </div>
                              <div className="rounded-xl bg-stone-50 dark:bg-slate-800 px-3 py-2 text-center">
                                <p className="text-[10px] text-stone-400 dark:text-slate-500">{t.am_payment_remaining}</p>
                                <p className="text-sm font-bold text-amber-600 dark:text-amber-400">{remaining.toLocaleString()}</p>
                              </div>
                            </div>
                          )}
                          {state!=='none' && stateCfg.filter(c=>c.k===state).map(c=>(
                            <span key={c.k} className={`mb-3 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold ${c.c}`}>{c.l}</span>
                          ))}
                          <div className="space-y-2">
                            {(payments[modalStudent.id]||[]).map(p => (
                              <div key={p.id} className="flex items-center justify-between rounded-xl bg-stone-50 dark:bg-slate-800 px-4 py-2.5">
                                <div className="flex items-center gap-3">
                                  <span className="text-sm font-bold text-brand">{p.amount.toLocaleString()} so'm</span>
                                  <span className="text-xs text-stone-400 dark:text-slate-500">{fd(p.date)}</span>
                                  {p.note && <span className="text-xs text-stone-500 dark:text-slate-400">— {p.note}</span>}
                                </div>
                                <button type="button" onClick={()=>setDeletePaymentTarget({pid:p.id,sid:modalStudent.id})} className="text-stone-400 hover:text-red-500 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                              </div>
                            ))}
                            {(!payments[modalStudent.id]||payments[modalStudent.id].length===0) && <p className="text-xs text-stone-400 dark:text-slate-500">{t.am_no_payments}</p>}
                          </div>
                          <div className="mt-3 flex items-center gap-2">
                            <input value={payAmount} onChange={e=>setPayAmount(e.target.value)} type="number" placeholder={t.am_payment_amount} className="input-premium h-9 w-28 text-xs" />
                            <input value={payNote} onChange={e=>setPayNote(e.target.value)} placeholder={t.am_payment_note} className="input-premium h-9 flex-1 text-xs" />
                            {fee>0 && remaining>0 && (
                              <button type="button" onClick={()=>setPayAmount(String(remaining))} className="btn-ghost h-9 shrink-0 text-xs" title={t.am_payment_paid}>{t.am_payment_paid} ({remaining.toLocaleString()})</button>
                            )}
                            <button type="button" onClick={addPayment} disabled={payLoading||!payAmount} className="btn-primary h-9 text-xs disabled:opacity-50">{payLoading ? '...' : t.am_payment_add}</button>
                          </div>
                        </>)
                      })()}
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title={t.am_confirm_delete_student}
        message={`${deleteTarget?.full_name} o'quvchisini o'chirasizmi?`}
        danger
        confirmLabel={t.am_confirm_delete_label}
        onConfirm={delSConfirm}
        onCancel={() => setDeleteTarget(null)}
        loading={creating}
      />
      <ConfirmModal
        open={!!deletePaymentTarget}
        title={t.am_confirm_delete_payment}
        message={t.am_confirm_delete_payment_msg}
        danger
        confirmLabel={t.am_confirm_delete_label}
        onConfirm={delPaymentConfirm}
        onCancel={() => setDeletePaymentTarget(null)}
      />
      <ConfirmModal
        open={batchMode && selectedStudents.size > 0}
        title={t.am_confirm_delete_student}
        message={`${selectedStudents.size} ta o'quvchini o'chirasizmi?`}
        danger
        confirmLabel={t.am_confirm_delete_label}
        onConfirm={batchDelete}
        onCancel={() => {}}
        loading={creating}
      />

      {excConfirm && (
        <div className="modal-overlay" onClick={()=>{setExcConfirm(null);setExcReason('')}}>
          <div className="modal-content max-w-sm" onClick={e=>e.stopPropagation()}>
            <div className="p-6">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-900/30">
                <CalendarX2 className="h-7 w-7 text-amber-500" />
              </div>
              <h3 className="text-center text-lg font-bold text-stone-800 dark:text-slate-200">{t.am_exc_confirm_title}</h3>
              <p className="mt-1 text-center text-xs font-semibold text-amber-600">{fd(excConfirm.date)} {fw(excConfirm.date)}</p>
              <p className="mt-2 text-center text-sm text-stone-500 dark:text-slate-400">{t.am_exc_confirm_msg}</p>
              <input value={excReason} onChange={e=>setExcReason(e.target.value)} placeholder={t.am_exc_reason} className="input-premium mt-4 w-full" />
              <div className="mt-5 flex gap-3">
                <button type="button" onClick={()=>{setExcConfirm(null);setExcReason('')}} className="btn-ghost flex-1" disabled={creating}>Bekor</button>
                <button type="button" onClick={addExcDay} disabled={creating} className="btn-primary flex-1">{creating ? t.dash_saving : t.am_exc_confirm_btn}</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showImport && (
        <div className="modal-overlay" onClick={()=>setShowImport(false)}>
          <div className="modal-content max-w-md" onClick={e=>e.stopPropagation()}>
            <div className="gradient-brand-r px-6 py-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20"><Upload className="h-5 w-5 text-white" /></div>
                  <h3 className="text-base font-bold text-white">{t.am_import_title}</h3>
                </div>
                <button type="button" onClick={()=>setShowImport(false)} className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20 text-white hover:bg-white/30 transition-all"><X className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="p-6">
              <p className="text-sm text-stone-500 dark:text-slate-400">{t.am_import_note}</p>
              <button type="button" onClick={downloadTemplate} className="btn-ghost mt-4 h-10 w-full text-xs">
                <FileSpreadsheet className="h-4 w-4 text-brand" /> {t.am_import_template}
              </button>
              <div className="mt-4 rounded-xl border-2 border-dashed border-stone-200 dark:border-slate-700 p-4 text-center">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl gradient-brand-r px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-brand transition-all hover:-translate-y-0.5">
                  <Upload className="h-3.5 w-3.5" /> {t.am_import_btn}
                  <input type="file" accept=".csv" onChange={importCSV} className="hidden" disabled={creating} />
                </label>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function KeyboardHint({ keys, label }: { keys: string; label?: string }) {
  return (
    <span className="flex items-center gap-1">
      {keys.split(' ').map(k => <span key={k} className="keyboard-hint">{k}</span>)}
      <span className="text-stone-400 dark:text-slate-500">{label}</span>
    </span>
  )
}
