'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { getSession } from '@/lib/auth';
import { useYear } from '@/lib/year';
import { sortByClassAndStudentId } from '@/lib/sort';
import { supabase } from '@/lib/supabase';

const CLASSES = ['อ.2','อ.3','ป.1','ป.2','ป.3','ป.4','ป.5','ป.6'];

export default function AssignmentsPage() {
  const router = useRouter();
  const [s, setS] = useState(null);
  const [year] = useYear();
  const [tab, setTab] = useState('list');

  useEffect(() => {
    const sess = getSession();
    if (!sess || sess.role === 'parent') { router.replace('/'); return; }
    setS(sess);
  }, [router]);

  if (!s) return null;

  return (
    <>
      <TopBar />
      <div className="wrap">
        <div className="card">
          <h2 style={{ margin: '0 0 14px' }}>📚 ระบบส่งงาน / การบ้าน ปีการศึกษา {year}</h2>

          <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', padding: 4, borderRadius: 10, marginBottom: 14 }}>
            <TabBtn active={tab === 'list'}   onClick={() => setTab('list')}>📝 งานทั้งหมด</TabBtn>
            <TabBtn active={tab === 'scores'} onClick={() => setTab('scores')}>✅ บันทึกคะแนน</TabBtn>
            <TabBtn active={tab === 'report'} onClick={() => setTab('report')}>📊 รายงาน</TabBtn>
          </div>

          {tab === 'list'   && <AssignmentListTab session={s} year={year} />}
          {tab === 'scores' && <ScoresTab session={s} year={year} />}
          {tab === 'report' && <ReportTab session={s} year={year} />}
        </div>
      </div>
    </>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button type="button" onClick={onClick} style={{
      flex: 1, padding: '10px 14px', border: 'none',
      background: active ? '#fff' : 'transparent',
      color: active ? '#1e40af' : '#64748b',
      borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer',
      boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
    }}>{children}</button>
  );
}

// ────────────────────────────────────────
// TAB 1: รายการงาน
// ────────────────────────────────────────
function AssignmentListTab({ session, year }) {
  const defaultCls = session.role === 'teacher' && session.class && session.class !== 'Admin' ? session.class : '';
  const [cls, setCls]           = useState(defaultCls);
  const [assignments, setAssignments] = useState([]);
  const [editing, setEditing]   = useState(null);
  const [toast, setToast]       = useState('');

  useEffect(() => { if (cls) load(); else setAssignments([]); }, [cls, year]);

  async function load() {
    const { data, error } = await supabase
      .from('assignments')
      .select('*')
      .eq('school_id', session.schoolId)
      .eq('academic_year', year)
      .eq('class', cls)
      .order('created_at', { ascending: false });
    if (error) { alert('❌ ' + error.message); return; }
    setAssignments(data || []);
  }

  function showToast(m) { setToast(m); setTimeout(() => setToast(''), 1800); }

  async function save(form) {
    const payload = {
      school_id:    session.schoolId,
      academic_year: year,
      class:        form.class,
      subject:      form.subject,
      title:        form.title,
      max_score:    parseFloat(form.max_score) || 35,
      assigned_date: form.assigned_date || null,
      due_date:     form.due_date || null,
      description:  form.description || null,
      created_by:   session.name,
    };
    let error;
    if (editing === 'new') ({ error } = await supabase.from('assignments').insert(payload));
    else                   ({ error } = await supabase.from('assignments').update(payload).eq('id', editing.id));
    if (error) { alert('❌ ' + error.message); return; }
    showToast(editing === 'new' ? '✅ เพิ่มงาน' : '✅ แก้ไขแล้ว');
    setEditing(null);
    setCls(form.class);
    load();
  }

  async function del(a) {
    if (!confirm(`ลบงาน "${a.title}"? (จะลบคะแนนทั้งหมดด้วย)`)) return;
    const { error } = await supabase.from('assignments').delete().eq('id', a.id);
    if (error) { alert('❌ ' + error.message); return; }
    showToast('🗑️ ลบแล้ว');
    load();
  }

  return (
    <>
      <div className="row">
        <div>
          <label style={{ fontSize: 12, fontWeight: 600 }}>ชั้นเรียน</label>
          <select value={cls} onChange={e => setCls(e.target.value)}>
            <option value="">-- เลือกชั้น --</option>
            {CLASSES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'end' }}>
          <button className="success" onClick={() => setEditing('new')}>➕ เพิ่มงาน</button>
        </div>
      </div>

      {cls && (
        <div style={{ overflowX: 'auto', marginTop: 14 }}>
          <table>
            <thead>
              <tr>
                <th>#</th><th>วิชา</th><th>ชื่องาน</th>
                <th style={{ textAlign: 'center' }}>คะแนนเต็ม</th>
                <th>วันมอบหมาย</th><th>กำหนดส่ง</th>
                <th>หมายเหตุ</th><th width="90"></th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a, i) => (
                <tr key={a.id}>
                  <td>{i + 1}</td>
                  <td><span style={{ background: '#eff6ff', color: '#1e40af', padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700 }}>{a.subject}</span></td>
                  <td><b>{a.title}</b></td>
                  <td style={{ textAlign: 'center', fontWeight: 700, color: '#9333ea' }}>{Number(a.max_score).toLocaleString()}</td>
                  <td style={{ fontSize: 12, color: '#64748b' }}>{a.assigned_date ? thDate(a.assigned_date) : '—'}</td>
                  <td style={{ fontSize: 12, color: a.due_date && new Date(a.due_date) < new Date() ? '#dc2626' : '#64748b' }}>
                    {a.due_date ? thDate(a.due_date) : '—'}
                  </td>
                  <td style={{ fontSize: 12, color: '#64748b' }}>{a.description || '—'}</td>
                  <td style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => setEditing(a)} style={{ padding: '4px 8px', fontSize: 12 }}>✏️</button>
                    <button onClick={() => del(a)} className="danger" style={{ padding: '4px 8px', fontSize: 12 }}>🗑️</button>
                  </td>
                </tr>
              ))}
              {assignments.length === 0 && (
                <tr><td colSpan="8" style={{ textAlign: 'center', color: '#94a3b8', padding: 30 }}>
                  {cls ? `ยังไม่มีงานสำหรับชั้น ${cls}` : '— เลือกชั้นเรียนก่อน —'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <AssignmentModal
          assignment={editing === 'new' ? { class: cls || CLASSES[2], subject: '', title: '', max_score: 35, assigned_date: new Date().toISOString().slice(0,10), due_date: '', description: '' } : editing}
          isNew={editing === 'new'}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      )}
      {toast && <div className="toast show">{toast}</div>}
    </>
  );
}

function thDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m-1, d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
}

function AssignmentModal({ assignment, isNew, onClose, onSave }) {
  const [f, setF] = useState({ ...assignment });
  function submit(e) {
    e.preventDefault();
    if (!f.subject?.trim() || !f.title?.trim()) return alert('กรอกวิชาและชื่องาน');
    onSave(f);
  }
  const fld = (label, key, type='text', placeholder='') => (
    <div style={{ marginBottom: 10 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>{label}</label>
      <input type={type} value={f[key] || ''} onChange={e => setF(p => ({ ...p, [key]: e.target.value }))} placeholder={placeholder} />
    </div>
  );
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <form onClick={e => e.stopPropagation()} onSubmit={submit} className="card" style={{ width: '100%', maxWidth: 500, margin: 0 }}>
        <h2 style={{ fontSize: 16, marginBottom: 14 }}>{isNew ? '➕ เพิ่มงาน' : '✏️ แก้ไขงาน'}</h2>
        <div className="row">
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>ชั้นเรียน *</label>
            <select value={f.class || ''} onChange={e => setF(p => ({ ...p, class: e.target.value }))}>
              {CLASSES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          {fld('วิชา *', 'subject', 'text', 'เช่น คณิตศาสตร์')}
        </div>
        {fld('ชื่องาน / การบ้าน *', 'title', 'text', 'เช่น แบบฝึกหัดบทที่ 3')}
        <div className="row">
          {fld('คะแนนเต็ม', 'max_score', 'number', '35')}
          {fld('กำหนดส่ง', 'due_date', 'date')}
        </div>
        {fld('หมายเหตุ', 'description', 'text', 'รายละเอียดเพิ่มเติม')}
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" className="success" style={{ flex: 1 }}>💾 บันทึก</button>
          <button type="button" className="secondary" onClick={onClose} style={{ flex: 1 }}>✖ ยกเลิก</button>
        </div>
      </form>
    </div>
  );
}

// ────────────────────────────────────────
// TAB 2: บันทึกคะแนน
// ────────────────────────────────────────
function ScoresTab({ session, year }) {
  const defaultCls = session.role === 'teacher' && session.class && session.class !== 'Admin' ? session.class : '';
  const [cls, setCls]             = useState(defaultCls);
  const [assignments, setAssignments] = useState([]);
  const [selAssignment, setSelAssignment] = useState(null);
  const [students, setStudents]   = useState([]);
  const [scoreMap, setScoreMap]   = useState({});
  const [loadMs, setLoadMs]       = useState(null);
  const [saveMs, setSaveMs]       = useState(null);
  const [toast, setToast]         = useState('');

  useEffect(() => { if (cls) loadAssignments(); else setAssignments([]); }, [cls, year]);

  async function loadAssignments() {
    const { data, error } = await supabase
      .from('assignments')
      .select('id, subject, title, max_score, due_date')
      .eq('school_id', session.schoolId)
      .eq('academic_year', year)
      .eq('class', cls)
      .order('created_at', { ascending: false });
    if (error) { alert('❌ ' + error.message); return; }
    setAssignments(data || []);
    setSelAssignment(null);
    setStudents([]);
  }

  async function loadStudents(ass) {
    setSelAssignment(ass);
    const t0 = performance.now();
    const [enrRes, scoreRes] = await Promise.all([
      supabase.from('enrollments')
        .select('students!inner(student_id, prefix, first_name, last_name)')
        .eq('school_id', session.schoolId)
        .eq('academic_year', year)
        .eq('class', cls)
        .in('status', ['ปกติ','ย้ายเข้า']),
      supabase.from('assignment_scores')
        .select('student_id, score, submitted')
        .eq('assignment_id', ass.id),
    ]);
    setLoadMs(Math.round(performance.now() - t0));
    if (enrRes.error || scoreRes.error) { alert('❌ ' + (enrRes.error || scoreRes.error).message); return; }

    const existing = {};
    (scoreRes.data || []).forEach(r => { existing[r.student_id] = r; });

    const list = (enrRes.data || []).map(e => ({
      ...e.students,
      class: cls,
      name: `${e.students.prefix || ''}${e.students.first_name || ''} ${e.students.last_name || ''}`.trim(),
      score: existing[e.students.student_id]?.score ?? '',
      submitted: existing[e.students.student_id]?.submitted ?? false,
    }));
    setStudents(sortByClassAndStudentId(list));

    const sm = {};
    list.forEach(s => { sm[s.student_id] = String(s.score); });
    setScoreMap(sm);
  }

  function showToast(m) { setToast(m); setTimeout(() => setToast(''), 1800); }

  async function save() {
    if (!selAssignment) return;
    const t0 = performance.now();
    const records = students.map(s => ({
      assignment_id: selAssignment.id,
      school_id: session.schoolId,
      student_id: s.student_id,
      score: scoreMap[s.student_id] !== '' && scoreMap[s.student_id] !== undefined
        ? parseFloat(scoreMap[s.student_id]) : null,
      submitted: scoreMap[s.student_id] !== '' && scoreMap[s.student_id] !== undefined,
      recorded_by: session.name,
      recorded_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from('assignment_scores')
      .upsert(records, { onConflict: 'assignment_id,student_id' });
    setSaveMs(Math.round(performance.now() - t0));
    if (error) { alert('❌ ' + error.message); return; }
    showToast(`✅ บันทึก ${records.length} รายการ`);
    loadStudents(selAssignment);
  }

  function printScores() {
    if (!selAssignment || !students.length) return;
    const rows = students.map((s, i) => {
      const sc = scoreMap[s.student_id];
      const v = sc !== '' && sc !== undefined ? parseFloat(sc) : null;
      return `<tr>
        <td>${i+1}</td><td>${s.student_id}</td><td>${s.name}</td>
        <td style="text-align:center">${v !== null ? v : '—'}</td>
        <td style="text-align:center">${selAssignment.max_score}</td>
        <td style="text-align:center">${v !== null ? ((v/selAssignment.max_score)*100).toFixed(1)+'%' : '—'}</td>
      </tr>`;
    }).join('');
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
      <style>body{font-family:'Sarabun',sans-serif;margin:10mm;font-size:12px}h2,h3{text-align:center;margin:2px 0}
      table{width:100%;border-collapse:collapse;margin-top:10px}th,td{border:1px solid #000;padding:4px 8px}th{background:#e2e8f0}
      @media print{button{display:none}}</style></head><body>
      <h2>รายงานคะแนน: ${selAssignment.title}</h2>
      <h3>วิชา ${selAssignment.subject} ชั้น ${cls} ปีการศึกษา ${year}</h3>
      <button onclick="window.print()" style="margin:8px auto;display:block;padding:6px 20px;cursor:pointer">🖨️ พิมพ์</button>
      <table><tr><th>#</th><th>เลขประจำตัว</th><th>ชื่อ-สกุล</th><th>คะแนน</th><th>เต็ม</th><th>%</th></tr>${rows}</table>
      </body></html>`);
    w.document.close();
  }

  return (
    <>
      <div className="row">
        <div>
          <label style={{ fontSize: 12, fontWeight: 600 }}>ชั้นเรียน</label>
          <select value={cls} onChange={e => setCls(e.target.value)}>
            <option value="">-- เลือก --</option>
            {CLASSES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {cls && assignments.length === 0 && (
        <div style={{ textAlign: 'center', color: '#94a3b8', padding: 24, marginTop: 14 }}>
          ยังไม่มีงานสำหรับชั้น {cls} — ไปที่ tab "งานทั้งหมด" เพื่อเพิ่มงาน
        </div>
      )}

      {cls && assignments.length > 0 && !selAssignment && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>เลือกงานที่ต้องการบันทึกคะแนน:</div>
          {assignments.map(a => (
            <div key={a.id} onClick={() => loadStudents(a)}
              style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid #e2e8f0', marginBottom: 8,
                background: '#fff', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ background: '#eff6ff', color: '#1e40af', padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700, marginRight: 8 }}>{a.subject}</span>
                <b>{a.title}</b>
                {a.due_date && <span style={{ fontSize: 12, color: '#64748b', marginLeft: 8 }}>กำหนดส่ง {thDate(a.due_date)}</span>}
              </div>
              <span style={{ fontWeight: 700, color: '#9333ea' }}>/ {Number(a.max_score).toLocaleString()} คะแนน</span>
            </div>
          ))}
        </div>
      )}

      {selAssignment && (
        <>
          <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <button onClick={() => { setSelAssignment(null); setStudents([]); }} style={{ background: '#64748b', fontSize: 13, padding: '6px 12px' }}>◀ เลือกงานอื่น</button>
              <span style={{ marginLeft: 12, fontWeight: 700 }}>
                📚 {selAssignment.subject}: {selAssignment.title}
                <span style={{ marginLeft: 8, color: '#9333ea' }}>/ {selAssignment.max_score} คะแนน</span>
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="success" onClick={save}>💾 บันทึกคะแนน</button>
              <button onClick={printScores} style={{ background: '#64748b' }}>🖨️ พิมพ์</button>
              {loadMs !== null && <span className="timing">⚡ {loadMs} ms</span>}
              {saveMs !== null && <span className="timing">💾 {saveMs} ms</span>}
            </div>
          </div>

          <div style={{ background: '#eff6ff', borderRadius: 8, padding: '8px 14px', marginTop: 10, fontSize: 13, color: '#1e40af' }}>
            💡 ใส่คะแนนในช่อง (0-{selAssignment.max_score}) แล้วกด "บันทึกคะแนน" · ปล่อยว่าง = ยังไม่ได้บันทึก
          </div>

          <div style={{ overflowX: 'auto', marginTop: 10 }}>
            <table>
              <thead>
                <tr>
                  <th>#</th><th>เลขประจำตัว</th><th>ชื่อ-สกุล</th>
                  <th style={{ textAlign: 'center', width: 120 }}>คะแนน (/{selAssignment.max_score})</th>
                  <th style={{ textAlign: 'center' }}>%</th>
                </tr>
              </thead>
              <tbody>
                {students.map((stu, i) => {
                  const sc = scoreMap[stu.student_id];
                  const v = sc !== '' && sc !== undefined ? parseFloat(sc) : null;
                  const pct = v !== null && selAssignment.max_score > 0 ? ((v / selAssignment.max_score) * 100).toFixed(1) : '—';
                  const color = v === null ? '#94a3b8' : v >= selAssignment.max_score * 0.8 ? '#16a34a' : v >= selAssignment.max_score * 0.5 ? '#d97706' : '#dc2626';
                  return (
                    <tr key={stu.student_id}>
                      <td>{i+1}</td>
                      <td><b>{stu.student_id}</b></td>
                      <td>{stu.name}</td>
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="number" min="0" max={selAssignment.max_score} step="0.5"
                          value={scoreMap[stu.student_id] ?? ''}
                          onChange={e => setScoreMap(p => ({ ...p, [stu.student_id]: e.target.value }))}
                          style={{ width: 90, textAlign: 'center', padding: '5px 8px', borderColor: v !== null && v > selAssignment.max_score ? '#dc2626' : undefined }}
                          placeholder="—"
                        />
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color }}>{pct}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      {toast && <div className="toast show">{toast}</div>}
    </>
  );
}

// ────────────────────────────────────────
// TAB 3: รายงาน
// ────────────────────────────────────────
function ReportTab({ session, year }) {
  const defaultCls = session.role === 'teacher' && session.class && session.class !== 'Admin' ? session.class : '';
  const [cls, setCls]     = useState(defaultCls);
  const [rows, setRows]   = useState([]); // [{subject, title, max_score, submitted, avg}]
  const [loadMs, setLoadMs] = useState(null);

  async function load() {
    if (!cls) return;
    const t0 = performance.now();
    const { data, error } = await supabase
      .from('assignments')
      .select('id, subject, title, max_score, due_date, assignment_scores(score, submitted)')
      .eq('school_id', session.schoolId)
      .eq('academic_year', year)
      .eq('class', cls)
      .order('subject').order('created_at');
    setLoadMs(Math.round(performance.now() - t0));
    if (error) { alert('❌ ' + error.message); return; }

    const result = (data || []).map(a => {
      const scores = (a.assignment_scores || []).filter(s => s.submitted && s.score !== null).map(s => parseFloat(s.score));
      const submitted = a.assignment_scores?.filter(s => s.submitted).length || 0;
      const avg = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length) : null;
      return { ...a, submittedCount: submitted, avg };
    });
    setRows(result);
  }

  useEffect(() => { if (cls) load(); }, [cls, year]);

  return (
    <>
      <div className="row">
        <div>
          <label style={{ fontSize: 12, fontWeight: 600 }}>ชั้นเรียน</label>
          <select value={cls} onChange={e => setCls(e.target.value)}>
            <option value="">-- เลือก --</option>
            {CLASSES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        {loadMs !== null && <div style={{ display: 'flex', alignItems: 'end' }}><span className="timing">⚡ {loadMs} ms</span></div>}
      </div>

      {rows.length > 0 && (
        <div style={{ overflowX: 'auto', marginTop: 14 }}>
          <table>
            <thead>
              <tr>
                <th>#</th><th>วิชา</th><th>ชื่องาน</th><th style={{ textAlign: 'center' }}>คะแนนเต็ม</th>
                <th style={{ textAlign: 'center' }}>ส่งแล้ว</th>
                <th style={{ textAlign: 'right' }}>คะแนนเฉลี่ย</th>
                <th style={{ textAlign: 'right' }}>% เฉลี่ย</th>
                <th>กำหนดส่ง</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id}>
                  <td>{i+1}</td>
                  <td><span style={{ background: '#eff6ff', color: '#1e40af', padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700 }}>{r.subject}</span></td>
                  <td>{r.title}</td>
                  <td style={{ textAlign: 'center', fontWeight: 700, color: '#9333ea' }}>{Number(r.max_score).toLocaleString()}</td>
                  <td style={{ textAlign: 'center', color: r.submittedCount > 0 ? '#16a34a' : '#94a3b8', fontWeight: 700 }}>
                    {r.submittedCount} คน
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#1e40af' }}>
                    {r.avg !== null ? r.avg.toFixed(1) : '—'}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: r.avg !== null ? (r.avg/r.max_score >= 0.8 ? '#16a34a' : r.avg/r.max_score >= 0.5 ? '#d97706' : '#dc2626') : '#94a3b8' }}>
                    {r.avg !== null ? ((r.avg/r.max_score)*100).toFixed(1)+'%' : '—'}
                  </td>
                  <td style={{ fontSize: 12, color: r.due_date && new Date(r.due_date) < new Date() ? '#dc2626' : '#64748b' }}>
                    {r.due_date ? thDate(r.due_date) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {cls && rows.length === 0 && <div style={{ textAlign: 'center', color: '#94a3b8', padding: 30 }}>ยังไม่มีงานสำหรับชั้น {cls}</div>}
    </>
  );
}
