const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const multer = require('multer');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const http = require('http');
const { WebSocketServer } = require('ws');
const rateLimit = require('express-rate-limit');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data.sqlite');
const UPLOADS_DIR = path.join(__dirname, '..', 'frontend', 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Rate limiting
const limiter = rateLimit({ windowMs: 60000, max: 200, message: { error: 'Too many requests' } });
app.use(limiter);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Multer
const storage = multer.diskStorage({ destination: (r, f, cb) => cb(null, UPLOADS_DIR), filename: (r, f, cb) => cb(null, Date.now() + '-' + crypto.randomBytes(4).toString('hex') + path.extname(f.originalname)) });
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (r, f, cb) => cb(null, /\.(jpg|jpeg|png|gif|webp)$/i.test(path.extname(f.originalname))) });

// DB
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, role TEXT DEFAULT 'teacher', name TEXT, lang TEXT DEFAULT 'uz', created_at TEXT DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS groups (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, user_id TEXT, created_at TEXT DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS students (id TEXT PRIMARY KEY, group_id TEXT NOT NULL, name TEXT NOT NULL, photo TEXT, sort_order INTEGER DEFAULT 0, FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE);
  CREATE TABLE IF NOT EXISTS attendance (student_id TEXT NOT NULL, date TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('present','absent','late','excused')), time TEXT, marked_by TEXT, FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE, UNIQUE(student_id, date));

  CREATE TABLE IF NOT EXISTS timetable (id TEXT PRIMARY KEY, group_id TEXT NOT NULL, day_of_week INTEGER NOT NULL, start_time TEXT NOT NULL, end_time TEXT, subject TEXT, FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE);
`);
try { db.exec("ALTER TABLE attendance ADD COLUMN time TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE students ADD COLUMN photo TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE students ADD COLUMN sort_order INTEGER DEFAULT 0"); } catch (_) {}
try { db.exec("ALTER TABLE groups ADD COLUMN user_id TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE attendance ADD COLUMN marked_by TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE students ADD COLUMN phone TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE students ADD COLUMN parent_name TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE students ADD COLUMN parent_phone TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE students ADD COLUMN address TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE students ADD COLUMN notes TEXT"); } catch (_) {}

function genId() { return Date.now().toString(36) + crypto.randomBytes(4).toString('hex'); }

// Swagger
const swaggerSpec = swaggerJsdoc({ definition: { openapi: '3.0.0', info: { title: 'Davomat API', version: '3.0.0' }, servers: [{ url: `http://localhost:${PORT}` }] }, apis: [__filename] });
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ===================== GROUPS =====================
app.get('/api/groups', (req, res) => {
  try { const groups = db.prepare(`SELECT g.id, g.name, (SELECT COUNT(*) FROM students WHERE group_id = g.id) AS student_count FROM groups g ORDER BY g.created_at DESC`).all(); res.json(groups); } catch(e) { res.status(500).json({error:e.message}); }
});
app.get('/api/groups/:id', (req, res) => {
  try { const g = db.prepare('SELECT g.id,g.name,(SELECT COUNT(*) FROM students WHERE group_id=g.id) AS student_count FROM groups g WHERE g.id=?').get(req.params.id);
    if (!g) return res.status(404).json({error:'Guruh topilmadi'}); res.json(g); } catch(e) { res.status(500).json({error:e.message}); }
});
app.post('/api/groups', (req, res) => {
  try { const { name } = req.body; if (!name||!name.trim()) return res.status(400).json({error:'Nom kiriting'});
    if (db.prepare('SELECT id FROM groups WHERE name=?').get(name.trim())) return res.status(400).json({error:'Bu nom mavjud'});
    const id = genId(); db.prepare('INSERT INTO groups (id,name,user_id) VALUES (?,?,?)').run(id, name.trim(), null);
    res.status(201).json(db.prepare('SELECT id,name,0 AS student_count FROM groups WHERE id=?').get(id)); } catch(e) { res.status(500).json({error:e.message}); }
});
app.put('/api/groups/:id', (req, res) => {
  try { const { name } = req.body; if (!name||!name.trim()) return res.status(400).json({error:'Nom kiriting'});
    if (db.prepare('SELECT id FROM groups WHERE name=? AND id!=?').get(name.trim(),req.params.id)) return res.status(400).json({error:'Bu nom mavjud'});
    if (!db.prepare('UPDATE groups SET name=? WHERE id=?').run(name.trim(),req.params.id).changes) return res.status(404).json({error:'Topilmadi'});
    res.json({success:true}); } catch(e) { res.status(500).json({error:e.message}); }
});
app.delete('/api/groups/:id', (req, res) => {
  try { if (!db.prepare('DELETE FROM groups WHERE id=?').run(req.params.id).changes) return res.status(404).json({error:'Topilmadi'});
    res.json({success:true}); } catch(e) { res.status(500).json({error:e.message}); }
});

// ===================== STUDENTS =====================
app.get('/api/groups/:id/students', (req, res) => {
  try { const { date } = req.query; const students = db.prepare('SELECT * FROM students WHERE group_id=? ORDER BY sort_order, name').all(req.params.id);
    if (date) { const rows = db.prepare('SELECT student_id,status,time FROM attendance WHERE student_id IN (SELECT id FROM students WHERE group_id=?) AND date=?').all(req.params.id,date);
      const m={},t={}; rows.forEach(r=>{m[r.student_id]=r.status;t[r.student_id]=r.time}); students.forEach(s=>{s.attendance=m[s.id]||null;s.attendanceTime=t[s.id]||null}); }
    res.json(students); } catch(e) { res.status(500).json({error:e.message}); }
});
app.post('/api/groups/:id/students', (req, res) => {
  try { const { name } = req.body; if (!name||!name.trim()) return res.status(400).json({error:'Ism kiriting'});
    if (!db.prepare('SELECT id FROM groups WHERE id=?').get(req.params.id)) return res.status(404).json({error:'Guruh topilmadi'});
    if (db.prepare('SELECT id FROM students WHERE group_id=? AND name=?').get(req.params.id,name.trim())) return res.status(400).json({error:'Bu o\'quvchi mavjud'});
    const id = genId(); db.prepare('INSERT INTO students (id,group_id,name) VALUES (?,?,?)').run(id,req.params.id,name.trim());
    const s = db.prepare('SELECT * FROM students WHERE id=?').get(id); s.attendance=null;s.attendanceTime=null;
    res.status(201).json(s); } catch(e) { res.status(500).json({error:e.message}); }
});
app.put('/api/groups/:gid/students/:sid', (req, res) => {
  try { const { name,photo,sort_order } = req.body; const u={}; if(name)u.name=name.trim(); if(photo!==undefined)u.photo=photo; if(sort_order!==undefined)u.sort_order=sort_order;
    if(u.name&&db.prepare('SELECT id FROM students WHERE group_id=? AND name=? AND id!=?').get(req.params.gid,u.name,req.params.sid)) return res.status(400).json({error:'Bu nom mavjud'});
    const sets = Object.keys(u).map(k=>`${k}=?`).join(','); const vals = Object.values(u);
    if (!db.prepare(`UPDATE students SET ${sets} WHERE id=? AND group_id=?`).run(...vals,req.params.sid,req.params.gid).changes) return res.status(404).json({error:'Topilmadi'});
    res.json({success:true}); } catch(e) { res.status(500).json({error:e.message}); }
});
app.delete('/api/groups/:gid/students/:sid', (req, res) => {
  try { if (!db.prepare('DELETE FROM students WHERE id=? AND group_id=?').run(req.params.sid,req.params.gid).changes) return res.status(404).json({error:'Topilmadi'});
    res.json({success:true}); } catch(e) { res.status(500).json({error:e.message}); }
});
app.post('/api/groups/:id/students/import', (req, res) => {
  try { const { students:names } = req.body; if (!names||!names.length) return res.status(400).json({error:'Ro\'yxat kerak'});
    if (!db.prepare('SELECT id FROM groups WHERE id=?').get(req.params.id)) return res.status(404).json({error:'Guruh topilmadi'});
    const ins = db.prepare('INSERT OR IGNORE INTO students (id,group_id,name) VALUES (?,?,?)'); let added=0;
    db.transaction(()=>{names.forEach(n=>{if(n.trim()){ins.run(genId(),req.params.id,n.trim());added++}})})();
    res.json({success:true,added}); } catch(e) { res.status(500).json({error:e.message}); }
});

// Photo upload
app.post('/api/upload', upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({error:'Fayl kerak'});
  res.json({success:true,url:'/uploads/'+req.file.filename});
});

// ===================== ATTENDANCE =====================
app.put('/api/attendance', (req, res) => {
  try { const { studentId, date, status, time } = req.body; if (!studentId||!date||!status) return res.status(400).json({error:'Ma\'lumotlar to\'liq emas'});
    if (!['present','absent','late','excused'].includes(status)) return res.status(400).json({error:'Noto\'g\'ri status'});
    db.prepare('INSERT INTO attendance (student_id,date,status,time,marked_by) VALUES (?,?,?,?,?) ON CONFLICT(student_id,date) DO UPDATE SET status=excluded.status,time=excluded.time,marked_by=excluded.marked_by').run(studentId,date,status,time||null,null);
    broadcast({type:'attendance_update',studentId,date,status,time}); res.json({success:true}); } catch(e) { res.status(500).json({error:e.message}); }
});
app.delete('/api/attendance', (req, res) => {
  try { const { studentId, date } = req.body; if (!studentId||!date) return res.status(400).json({error:'Ma\'lumotlar to\'liq emas'});
    db.prepare('DELETE FROM attendance WHERE student_id=? AND date=?').run(studentId,date); res.json({success:true}); } catch(e) { res.status(500).json({error:e.message}); }
});

// QR attendance
app.post('/api/attendance/qr', (req, res) => {
  try { const { studentId, date } = req.body; if (!studentId) return res.status(400).json({error:'Student ID kerak'});
    const d = date||new Date().toISOString().slice(0,10);
    db.prepare('INSERT INTO attendance (student_id,date,status,time,marked_by) VALUES (?,?,?,?,?) ON CONFLICT(student_id,date) DO UPDATE SET status=excluded.status,time=excluded.time,marked_by=excluded.marked_by').run(studentId,d,'present',new Date().toTimeString().slice(0,5),null);
    broadcast({type:'attendance_update',studentId,date:d,status:'present'}); res.json({success:true}); } catch(e) { res.status(500).json({error:e.message}); }
});

// ===================== QR CODE =====================
app.get('/api/qr/:studentId', async (req, res) => {
  try { const s = db.prepare('SELECT s.*,g.name AS group_name FROM students s JOIN groups g ON s.group_id=g.id WHERE s.id=?').get(req.params.studentId);
    if (!s) return res.status(404).json({error:'Topilmadi'}); const url = `${req.protocol}://${req.get('host')}/qr/${s.id}`;
    const qr = await QRCode.toDataURL(url); res.json({qr,url,student:s}); } catch(e) { res.status(500).json({error:e.message}); }
});

// ===================== STUDENT PROFILE =====================
app.put('/api/students/:id/profile', (req, res) => {
  try { const { phone, parent_name, parent_phone, address, notes } = req.body;
    db.prepare('UPDATE students SET phone=?,parent_name=?,parent_phone=?,address=?,notes=? WHERE id=?').run(phone||null,parent_name||null,parent_phone||null,address||null,notes||null,req.params.id);
    res.json({success:true}); } catch(e) { res.status(500).json({error:e.message}); }
});
app.get('/api/students/:id/profile', (req, res) => {
  try { const s = db.prepare('SELECT s.*,g.name AS group_name FROM students s JOIN groups g ON s.group_id=g.id WHERE s.id=?').get(req.params.id);
    if (!s) return res.status(404).json({error:'Topilmadi'}); res.json(s); } catch(e) { res.status(500).json({error:e.message}); }
});

// ===================== TIMETABLE =====================
app.get('/api/groups/:id/timetable', (req, res) => {
  try { const rows = db.prepare('SELECT * FROM timetable WHERE group_id=? ORDER BY day_of_week,start_time').all(req.params.id); res.json(rows); } catch(e) { res.status(500).json({error:e.message}); }
});
app.post('/api/groups/:id/timetable', (req, res) => {
  try { const { day_of_week, start_time, end_time, subject } = req.body;
    if (!db.prepare('SELECT id FROM groups WHERE id=?').get(req.params.id)) return res.status(404).json({error:'Guruh topilmadi'});
    const id = genId(); db.prepare('INSERT INTO timetable (id,group_id,day_of_week,start_time,end_time,subject) VALUES (?,?,?,?,?,?)').run(id,req.params.id,day_of_week,start_time,end_time,subject);
    res.status(201).json({id,success:true}); } catch(e) { res.status(500).json({error:e.message}); }
});
app.delete('/api/timetable/:id', (req, res) => {
  try { if (!db.prepare('DELETE FROM timetable WHERE id=?').run(req.params.id).changes) return res.status(404).json({error:'Topilmadi'});
    res.json({success:true}); } catch(e) { res.status(500).json({error:e.message}); }
});

// ===================== STUDENT HISTORY =====================
app.get('/api/students/:id/history', (req, res) => {
  try { const s = db.prepare('SELECT s.*,g.name AS group_name FROM students s JOIN groups g ON s.group_id=g.id WHERE s.id=?').get(req.params.id);
    if (!s) return res.status(404).json({error:'Topilmadi'});
    const recs = db.prepare('SELECT date,status,time FROM attendance WHERE student_id=? ORDER BY date DESC').all(req.params.id);
    res.json({id:s.id,name:s.name,groupName:s.group_name,groupId:s.group_id,photo:s.photo,totalDays:recs.length,present:recs.filter(r=>r.status==='present').length,absent:recs.filter(r=>r.status==='absent').length,late:recs.filter(r=>r.status==='late').length,excused:recs.filter(r=>r.status==='excused').length,percentage:recs.length?Math.round((recs.filter(r=>r.status==='present'||r.status==='late').length/recs.length)*100):0,records:recs}); } catch(e) { res.status(500).json({error:e.message}); }
});

// ===================== EXPORT EXCEL =====================
app.get('/api/groups/:id/export/excel', async (req, res) => {
  try { const g = db.prepare('SELECT * FROM groups WHERE id=?').get(req.params.id); if (!g) return res.status(404).json({error:'Topilmadi'});
    const { from, to } = req.query;
    let df='',dp=[req.params.id]; if(from&&to){df=' AND a.date>=? AND a.date<=?';dp.push(from,to);}
    const students = db.prepare('SELECT * FROM students WHERE group_id=? ORDER BY name').all(req.params.id);
    const dates = db.prepare(`SELECT DISTINCT a.date FROM attendance a JOIN students s ON a.student_id=s.id WHERE s.group_id=?${df} ORDER BY a.date`).all(...dp).map(r=>r.date);
    const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet(g.name);
    ws.columns = [{header:'O\'quvchi',key:'name',width:25},...dates.map(d=>({header:d,key:d,width:12}))];
    const rows = students.map(s=>{const row={name:s.name};let sf='',sp=[s.id];if(from&&to){sf=' AND date>=? AND date<=?';sp.push(from,to);}db.prepare(`SELECT date,status FROM attendance WHERE student_id=?${sf}`).all(...sp).forEach(r=>{row[r.date]=r.status==='present'?'+':r.status==='absent'?'-':r.status==='late'?'~':'s'});return row});
    ws.addRows(rows); ws.getRow(1).font={bold:true};
    res.set('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.set('Content-Disposition',`attachment; filename="${g.name}.xlsx"`);
    await wb.xlsx.write(res); res.end(); } catch(e) { res.status(500).json({error:e.message}); }
});

// ===================== EXPORT PDF =====================
app.get('/api/groups/:id/export/pdf', async (req, res) => {
  try { const g = db.prepare('SELECT * FROM groups WHERE id=?').get(req.params.id); if (!g) return res.status(404).json({error:'Topilmadi'});
    const { from, to } = req.query;
    const students = db.prepare('SELECT * FROM students WHERE group_id=? ORDER BY name').all(req.params.id);
    const doc = new PDFDocument({margin:30}); res.set('Content-Type','application/pdf');
    res.set('Content-Disposition',`attachment; filename="${g.name}.pdf"`); doc.pipe(res);
    doc.fontSize(18).text(`Davomat: ${g.name}${from&&to?` (${from} - ${to})`:''}`,{align:'center'}); doc.moveDown();
    students.forEach(s=>{let sf='',sp=[s.id];if(from&&to){sf=' AND date>=? AND date<=?';sp.push(from,to);}const r=db.prepare(`SELECT status,time FROM attendance WHERE student_id=?${sf}`).all(...sp);const p=r.filter(x=>x.status==='present').length;
      doc.fontSize(12).text(`${s.name}: ${p}/${r.length} (${r.length?Math.round(p/r.length*100):0}%)`);});
    doc.end(); } catch(e) { res.status(500).json({error:e.message}); }
});

// ===================== STATISTICS =====================
app.get('/api/groups/:id/stats', (req, res) => {
  try { const { from, to } = req.query; const g = db.prepare('SELECT * FROM groups WHERE id=?').get(req.params.id); if (!g) return res.status(404).json({error:'Topilmadi'});
    const students = db.prepare('SELECT * FROM students WHERE group_id=? ORDER BY name').all(req.params.id);
    let df='',p=[req.params.id]; if(from&&to){df=' AND a.date>=? AND a.date<=?';p.push(from,to);}
    const dates = db.prepare(`SELECT DISTINCT a.date FROM attendance a JOIN students s ON a.student_id=s.id WHERE s.group_id=?${df} ORDER BY a.date`).all(...p).map(r=>r.date);
    const stats = students.map(s=>{const sp=[s.id];let sf='';if(from&&to){sf=' AND date>=? AND date<=?';sp.push(from,to);}const recs=db.prepare(`SELECT status FROM attendance WHERE student_id=?${sf}`).all(...sp);
      return{id:s.id,name:s.name,present:recs.filter(r=>r.status==='present').length,absent:recs.filter(r=>r.status==='absent').length,late:recs.filter(r=>r.status==='late').length,excused:recs.filter(r=>r.status==='excused').length,total:recs.length,percentage:recs.length?Math.round((recs.filter(r=>r.status==='present'||r.status==='late').length/recs.length)*100):0};});
    res.json({groupName:g.name,totalDates:dates.length,allDates:dates,stats}); } catch(e) { res.status(500).json({error:e.message}); }
});

app.get('/api/dashboard', (req, res) => {
  try { const groups = db.prepare(`SELECT g.id,g.name,(SELECT COUNT(*) FROM students WHERE group_id=g.id) AS student_count,(SELECT COUNT(*) FROM attendance WHERE student_id IN (SELECT id FROM students WHERE group_id=g.id)) AS attendance_count,(SELECT COUNT(DISTINCT date) FROM attendance WHERE student_id IN (SELECT id FROM students WHERE group_id=g.id)) AS day_count FROM groups g ORDER BY g.created_at DESC`).all();
    res.json({totalGroups:groups.length,totalStudents:groups.reduce((s,g)=>s+g.student_count,0),totalAttendance:groups.reduce((s,g)=>s+g.attendance_count,0),groups}); } catch(e) { res.status(500).json({error:e.message}); }
});

app.get('/api/groups/:id/ranking', (req, res) => {
  try { const { from, to } = req.query; const g = db.prepare('SELECT * FROM groups WHERE id=?').get(req.params.id); if (!g) return res.status(404).json({error:'Topilmadi'});
    const students = db.prepare('SELECT * FROM students WHERE group_id=?').all(req.params.id); let sf='',sp=[]; if(from&&to){sf=' WHERE date>=? AND date<=?';sp.push(from,to);}
    const stats = students.map(s=>{const recs=db.prepare(`SELECT status FROM attendance WHERE student_id=?${sf}`).all(s.id,...sp);const p=recs.filter(r=>r.status==='present').length,l=recs.filter(r=>r.status==='late').length,t=recs.length;return{id:s.id,name:s.name,present:p+l,absent:recs.filter(r=>r.status==='absent').length,total:t,score:t?Math.round((p+l)/t*100):0};});
    stats.sort((a,b)=>b.score-a.score); res.json({groupName:g.name,ranking:stats}); } catch(e) { res.status(500).json({error:e.message}); }
});

app.get('/api/groups/:id/worst-days', (req, res) => {
  try { const g = db.prepare('SELECT * FROM groups WHERE id=?').get(req.params.id); if (!g) return res.status(404).json({error:'Topilmadi'});
    const days = db.prepare(`SELECT a.date,SUM(CASE WHEN a.status='absent' THEN 1 ELSE 0 END) AS absent_count,SUM(CASE WHEN a.status='present' OR a.status='late' THEN 1 ELSE 0 END) AS present_count,COUNT(*) AS total FROM attendance a JOIN students s ON a.student_id=s.id WHERE s.group_id=? AND a.status IN ('present','absent') GROUP BY a.date HAVING absent_count>0 ORDER BY absent_count DESC,a.date DESC`).all(req.params.id);
    res.json({groupName:g.name,days}); } catch(e) { res.status(500).json({error:e.message}); }
});

app.get('/api/groups/:id/trend', (req, res) => {
  try { const { from, to } = req.query; const g = db.prepare('SELECT * FROM groups WHERE id=?').get(req.params.id); if (!g) return res.status(404).json({error:'Topilmadi'});
    let sf='',sp=[req.params.id]; if(from&&to){sf=' AND a.date>=? AND a.date<=?';sp.push(from,to);}
    const days = db.prepare(`SELECT a.date,SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END) AS present,SUM(CASE WHEN a.status='absent' THEN 1 ELSE 0 END) AS absent,SUM(CASE WHEN a.status='late' THEN 1 ELSE 0 END) AS late,SUM(CASE WHEN a.status='excused' THEN 1 ELSE 0 END) AS excused,COUNT(*) AS total FROM attendance a JOIN students s ON a.student_id=s.id WHERE s.group_id=?${sf} GROUP BY a.date ORDER BY a.date`).all(...sp);
    res.json({groupName:g.name,days}); } catch(e) { res.status(500).json({error:e.message}); }
});

app.get('/api/students/:id/monthly', (req, res) => {
  try { const s = db.prepare('SELECT s.*,g.name AS group_name FROM students s JOIN groups g ON s.group_id=g.id WHERE s.id=?').get(req.params.id); if (!s) return res.status(404).json({error:'Topilmadi'});
    const recs = db.prepare('SELECT date,status FROM attendance WHERE student_id=? ORDER BY date').all(req.params.id); const months={};
    recs.forEach(r=>{const m=r.date.slice(0,7);if(!months[m])months[m]={present:0,absent:0,late:0,excused:0,total:0};months[m][r.status]++;months[m].total++;});
    const report = Object.entries(months).map(([month,data])=>({month,...data,percentage:data.total?Math.round(((data.present+data.late)/data.total)*100):0})).sort((a,b)=>a.month.localeCompare(b.month));
    res.json({id:s.id,name:s.name,groupName:s.group_name,report}); } catch(e) { res.status(500).json({error:e.message}); }
});

// ===================== CALENDAR =====================
app.get('/api/groups/:id/calendar', (req, res) => {
  try { const { year, month } = req.query; if (!year||!month) return res.status(400).json({error:'year va month kerak'});
    const ym = `${year}-${String(parseInt(month)).padStart(2,'0')}`;
    const days = db.prepare(`SELECT a.date,a.status,a.time,s.id AS student_id,s.name AS student_name FROM attendance a JOIN students s ON a.student_id=s.id WHERE s.group_id=? AND a.date LIKE ?`).all(req.params.id,ym+'%');
    res.json({year:parseInt(year),month:parseInt(month),days}); } catch(e) { res.status(500).json({error:e.message}); }
});





// ===================== WEBSOCKET =====================
const wss = new WebSocketServer({ server, path: '/ws' });
const clients = new Set();
wss.on('connection', ws => { clients.add(ws); ws.on('close', () => clients.delete(ws)); });
function broadcast(data) { clients.forEach(c => { try { c.send(JSON.stringify(data)); } catch(_) {} }); }

// ===================== SWAGGER =====================
app.get('/api/docs.json', (req, res) => res.json(swaggerSpec));

// ===================== START =====================
server.listen(PORT, () => { console.log(`Server on :${PORT}`); console.log(`Swagger: http://localhost:${PORT}/api-docs`); console.log(`WS: ws://localhost:${PORT}/ws`); });
