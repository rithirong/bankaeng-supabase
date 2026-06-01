'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { getSession } from '@/lib/auth';
import { useYear } from '@/lib/year';
import { sortByClassAndStudentId } from '@/lib/sort';
import { supabase } from '@/lib/supabase';
import { makePrintWindow, makePrintHeader, makeSignature2, makeNoteBox } from '@/lib/printTemplate';

const CLASSES = ['อ.2','อ.3','ป.1','ป.2','ป.3','ป.4','ป.5','ป.6'];
const DEFAULT_SUBJECTS = ['ภาษาไทย','คณิตศาสตร์','วิทยาศาสตร์','สังคมศึกษา','ประวัติศาสตร์','ศาสนาและวัฒนธรรม','สุขศึกษา','พลศึกษา','ศิลปะ','การงานอาชีพ','ภาษาอังกฤษ'];

export default function GradesPage() {
  const router = useRouter();
  const [s, setS] = useState(null);
  const [year] = useYear();
  const [tab, setTab] = useState('entry');

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
          <h2 style={{ margin: '0 0 14px' }}>📊 บันทึกผลการเรียน ปีการศึกษา {year}</h2>

          <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', padding: 4, borderRadius: 10, marginBottom: 14 }}>
            <TabBtn active={tab === 'entry'}   onClick={() => setTab('entry')}>✏️ กรอกคะแนน</TabBtn>
            <TabBtn active={tab === 'summary'} onClick={() => setTab('summary')}>📊 สรุปผล</TabBtn>
          </div>

          {tab === 'entry'   && <EntryTab session={s} year={year} />}
          {tab === 'summary' && <SummaryTab session={s} year={year} />}
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
// TAB 1: กรอกคะแนน (grid: students × subjects)
// ────────────────────────────────────────
function EntryTab({ session, year }) {
  const defaultCls = session.role === 'teacher' && session.class && session.class !== 'Admin' ? session.class : '';
  const [cls, setCls]         = useState(defaultCls);
  const [semester, setSemester] = useState(1);
  const [subjects, setSubjects] = useState([...DEFAULT_SUBJECTS]);
  const [students, setStudents] = useState([]);
  const [grid, setGrid]        = useState({}); // {student_id: {subject: score}}
  const [loaded, setLoaded]    = useState(false);
  const [loadMs, setLoadMs]    = useState(null);
  const [saveMs, setSaveMs]    = useState(null);
  const [toast, setToast]      = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [showAddSub, setShowAddSub] = useState(false);

  useEffect(() => { if (cls) load(); else { setStudents([]); setGrid({}); setLoaded(false); } }, [cls, semester, year]);

  async function load() {
    setLoaded(false);
    const t0 = performance.now();
    const [enrRes, gradeRes] = await Promise.all([
      supabase.from('enrollments')
        .select('students!inner(student_id, prefix, first_name, last_name)')
        .eq('school_id', session.schoolId)
        .eq('academic_year', year)
        .eq('class', cls)
        .in('status', ['ปกติ','ย้ายเข้า']),
      supabase.from('grades')
        .select('student_id, subject, score, max_score')
        .eq('school_id', session.schoolId)
        .eq('academic_year', year)
        .eq('class', cls)
        .eq('semester', semester),
    ]);
    setLoadMs(Math.round(performance.now() - t0));
    if (enrRes.error || gradeRes.error) { alert('❌ ' + (enrRes.error || gradeRes.error).message); return; }

    const list = (enrRes.data || []).map(e => ({
      ...e.students,
      class: cls,
      name: `${e.students.prefix || ''}${e.students.first_name || ''} ${e.students.last_name || ''}`.trim(),
    }));
    setStudents(sortByClassAndStudentId(list));

    const g = {};
    const subjSet = new Set(subjects);
    (gradeRes.data || []).forEach(r => {
      if (!g[r.student_id]) g[r.student_id] = {};
      g[r.student_id][r.subject] = r.score !== null ? String(r.score) : '';
      if (r.subject) subjSet.add(r.subject);
    });
    setSubjects([...DEFAULT_SUBJECTS.filter(s => subjSet.has(s)), ...([...subjSet].filter(s => !DEFAULT_SUBJECTS.includes(s)))]);
    setGrid(g);
    setLoaded(true);
  }

  function setScore(sid, subj, val) {
    setGrid(p => ({ ...p, [sid]: { ...(p[sid] || {}), [subj]: val } }));
  }

  function showToast(m) { setToast(m); setTimeout(() => setToast(''), 1800); }

  async function save() {
    if (!students.length) return alert('⚠️ ยังไม่ได้โหลดรายชื่อ');
    const records = [];
    students.forEach(stu => {
      subjects.forEach(subj => {
        const raw = grid[stu.student_id]?.[subj];
        if (raw === undefined || raw === '') return;
        const v = parseFloat(raw);
        if (isNaN(v)) return;
        records.push({
          school_id: session.schoolId, academic_year: year,
          class: cls, student_id: stu.student_id, subject: subj,
          semester: semester, score: v, max_score: 100,
          updated_by: session.name, updated_at: new Date().toISOString(),
        });
      });
    });
    if (!records.length) return showToast('⚠️ ไม่มีข้อมูลให้บันทึก');
    const t0 = performance.now();
    const { error } = await supabase.from('grades')
      .upsert(records, { onConflict: 'school_id,academic_year,student_id,subject,semester' });
    setSaveMs(Math.round(performance.now() - t0));
    if (error) { alert('❌ ' + error.message); return; }
    showToast(`✅ บันทึก ${records.length} รายการ`);
  }

  function addSubject() {
    const s = newSubject.trim();
    if (!s || subjects.includes(s)) return;
    setSubjects(p => [...p, s]);
    setNewSubject('');
    setShowAddSub(false);
  }

  function printGrades() {
    if (!students.length) return;
    const schoolName = session.school?.name || 'โรงเรียนบ้านแก่ง';
    const hdr = subjects.map(s => `<th class="nowrap">${s}</th>`).join('');
    const body = students.map((stu, i) => {
      const cells = subjects.map(subj => {
        const v = grid[stu.student_id]?.[subj];
        const n = v !== undefined && v !== '' ? parseFloat(v) : null;
        return `<td>${n !== null ? n : '—'}</td>`;
      }).join('');
      return `<tr><td>${i+1}</td><td>${stu.student_id}</td><td class="text-left">${stu.name}</td>${cells}</tr>`;
    }).join('');
    const html = `
      ${makePrintHeader(schoolName, 'บันทึกผลการเรียน', `ชั้น ${cls} ภาคเรียนที่ ${semester} ปีการศึกษา ${year}`)}
      <table><thead><tr><th>#</th><th>เลขประจำตัว</th><th>ชื่อ-สกุล</th>${hdr}</tr></thead>
      <tbody>${body}</tbody></table>
      ${makeSignature2(session.name, session.school?.director, schoolName)}
    `;
    makePrintWindow(html, 'landscape');
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
        <div>
          <label style={{ fontSize: 12, fontWeight: 600 }}>ภาคเรียน</label>
          <select value={semester} onChange={e => setSemester(parseInt(e.target.value))}>
            <option value={1}>ภาคเรียนที่ 1</option>
            <option value={2}>ภาคเรียนที่ 2</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'end' }}>
          <button onClick={load} disabled={!cls}>📋 โหลด</button>
        </div>
      </div>

      {loadMs !== null && <div style={{ marginTop: 8 }}><span className="timing">⚡ {students.length} คน · {loadMs} ms</span></div>}

      {loaded && (
        <>
          {/* วิชา management */}
          <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>วิชา:</span>
            {subjects.map((s, i) => (
              <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#eff6ff', color: '#1e40af', padding: '2px 8px', borderRadius: 999, fontSize: 12, fontWeight: 600 }}>
                {s}
                {!DEFAULT_SUBJECTS.includes(s) && (
                  <span onClick={() => setSubjects(p => p.filter(x => x !== s))} style={{ cursor: 'pointer', color: '#dc2626', fontWeight: 900, lineHeight: 1 }}>×</span>
                )}
              </span>
            ))}
            {!showAddSub ? (
              <button onClick={() => setShowAddSub(true)} style={{ padding: '2px 10px', fontSize: 12, background: '#64748b' }}>+ เพิ่มวิชา</button>
            ) : (
              <div style={{ display: 'flex', gap: 4 }}>
                <input value={newSubject} onChange={e => setNewSubject(e.target.value)} onKeyDown={e => e.key === 'Enter' && addSubject()}
                  placeholder="ชื่อวิชา" style={{ width: 130, fontSize: 12, padding: '4px 8px' }} autoFocus />
                <button onClick={addSubject} style={{ padding: '4px 10px', fontSize: 12 }}>✓</button>
                <button onClick={() => { setShowAddSub(false); setNewSubject(''); }} className="secondary" style={{ padding: '4px 10px', fontSize: 12 }}>✕</button>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 14, marginBottom: 4 }}>
            <button className="success" onClick={save}>💾 บันทึกทั้งหมด</button>
            <button onClick={printGrades} style={{ background: '#64748b' }}>🖨️ พิมพ์</button>
            {saveMs !== null && <span className="timing">💾 {saveMs} ms</span>}
          </div>

          <div style={{ overflowX: 'auto', marginTop: 6 }}>
            <table style={{ fontSize: 12, minWidth: subjects.length * 80 + 300 }}>
              <thead>
                <tr>
                  <th style={{ position: 'sticky', left: 0, background: '#f1f5f9', minWidth: 40 }}>#</th>
                  <th style={{ position: 'sticky', left: 40, background: '#f1f5f9', minWidth: 80 }}>เลขประจำตัว</th>
                  <th style={{ position: 'sticky', left: 120, background: '#f1f5f9', minWidth: 150 }}>ชื่อ-สกุล</th>
                  {subjects.map(s => <th key={s} style={{ textAlign: 'center', minWidth: 76 }}>{s}</th>)}
                </tr>
              </thead>
              <tbody>
                {students.map((stu, i) => (
                  <tr key={stu.student_id}>
                    <td style={{ position: 'sticky', left: 0, background: '#fff' }}>{i+1}</td>
                    <td style={{ position: 'sticky', left: 40, background: '#fff' }}><b>{stu.student_id}</b></td>
                    <td style={{ position: 'sticky', left: 120, background: '#fff' }}>{stu.name}</td>
                    {subjects.map(subj => {
                      const val = grid[stu.student_id]?.[subj] ?? '';
                      const n = val !== '' ? parseFloat(val) : null;
                      return (
                        <td key={subj} style={{ textAlign: 'center', padding: '4px' }}>
                          <input
                            type="number" min="0" max="100" step="0.5"
                            value={val}
                            onChange={e => setScore(stu.student_id, subj, e.target.value)}
                            style={{
                              width: 68, textAlign: 'center', padding: '4px',
                              fontSize: 12, borderRadius: 6,
                              borderColor: n !== null && (n < 0 || n > 100) ? '#dc2626' : '#cbd5e1',
                              background: n !== null ? (n >= 80 ? '#dcfce7' : n >= 50 ? '#fef3c7' : '#fee2e2') : '#fff',
                            }}
                            placeholder="—"
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
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
// TAB 2: สรุปผลการเรียน
// ────────────────────────────────────────
function SummaryTab({ session, year }) {
  const defaultCls = session.role === 'teacher' && session.class && session.class !== 'Admin' ? session.class : '';
  const [cls, setCls]       = useState(defaultCls);
  const [semester, setSemester] = useState(1);
  const [rows, setRows]     = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loadMs, setLoadMs] = useState(null);

  async function load() {
    if (!cls) return;
    const t0 = performance.now();
    const [enrRes, gradeRes] = await Promise.all([
      supabase.from('enrollments')
        .select('students!inner(student_id, prefix, first_name, last_name)')
        .eq('school_id', session.schoolId)
        .eq('academic_year', year)
        .eq('class', cls)
        .in('status', ['ปกติ','ย้ายเข้า']),
      supabase.from('grades')
        .select('student_id, subject, score')
        .eq('school_id', session.schoolId)
        .eq('academic_year', year)
        .eq('class', cls)
        .eq('semester', semester),
    ]);
    setLoadMs(Math.round(performance.now() - t0));
    if (enrRes.error || gradeRes.error) { alert('❌ ' + (enrRes.error || gradeRes.error).message); return; }

    const list = (enrRes.data || []).map(e => ({
      ...e.students, class: cls,
      name: `${e.students.prefix || ''}${e.students.first_name || ''} ${e.students.last_name || ''}`.trim(),
    }));
    const students = sortByClassAndStudentId(list);

    const gradeMap = {};
    const subjectSet = new Set();
    (gradeRes.data || []).forEach(r => {
      if (!gradeMap[r.student_id]) gradeMap[r.student_id] = {};
      gradeMap[r.student_id][r.subject] = r.score;
      if (r.subject) subjectSet.add(r.subject);
    });
    const subjs = [...DEFAULT_SUBJECTS.filter(s => subjectSet.has(s)), ...[...subjectSet].filter(s => !DEFAULT_SUBJECTS.includes(s))];
    setSubjects(subjs);

    const result = students.map(stu => {
      const scores = subjs.map(s => gradeMap[stu.student_id]?.[s] ?? null);
      const filled = scores.filter(v => v !== null);
      const avg = filled.length > 0 ? filled.reduce((a, b) => a + b, 0) / filled.length : null;
      return { ...stu, scores, avg };
    });
    setRows(result);
  }

  useEffect(() => { if (cls) load(); }, [cls, semester, year]);

  function grade(v) {
    if (v === null) return { g: '—', color: '#94a3b8' };
    if (v >= 80) return { g: '4', color: '#16a34a' };
    if (v >= 75) return { g: '3.5', color: '#22c55e' };
    if (v >= 70) return { g: '3', color: '#84cc16' };
    if (v >= 65) return { g: '2.5', color: '#ca8a04' };
    if (v >= 60) return { g: '2', color: '#d97706' };
    if (v >= 55) return { g: '1.5', color: '#ea580c' };
    if (v >= 50) return { g: '1', color: '#f97316' };
    return { g: '0', color: '#dc2626' };
  }

  function printSummary() {
    const hdr = subjects.map(s => `<th style="font-size:10px;writing-mode:vertical-rl;transform:rotate(180deg);height:60px">${s}</th>`).join('');
    const body = rows.map((stu, i) => {
      const cells = stu.scores.map(v => {
        const { g } = grade(v);
        return `<td style="text-align:center">${v !== null ? v : '—'} (${g})</td>`;
      }).join('');
      const { g: avgG, color: avgC } = grade(stu.avg);
      return `<tr><td>${i+1}</td><td>${stu.student_id}</td><td>${stu.name}</td>${cells}<td style="text-align:center;font-weight:700">${stu.avg?.toFixed(1) ?? '—'} (${avgG})</td></tr>`;
    }).join('');
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
      <style>body{font-family:'Sarabun',sans-serif;margin:8mm;font-size:11px}h2,h3{text-align:center;margin:2px 0}
      table{width:100%;border-collapse:collapse}th,td{border:1px solid #000;padding:3px 4px;vertical-align:middle}
      th{background:#e2e8f0}@page{size:A4 landscape;margin:8mm}@media print{button{display:none}}</style></head><body>
      <h2>สรุปผลการเรียน ชั้น ${cls} ภาคเรียนที่ ${semester} ปีการศึกษา ${year}</h2>
      <button onclick="window.print()" style="margin:8px auto;display:block;padding:6px 20px;cursor:pointer">🖨️ พิมพ์</button>
      <table><tr><th>#</th><th>เลขประจำตัว</th><th>ชื่อ-สกุล</th>${hdr}<th>เฉลี่ย</th></tr>${body}</table>
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
        <div>
          <label style={{ fontSize: 12, fontWeight: 600 }}>ภาคเรียน</label>
          <select value={semester} onChange={e => setSemester(parseInt(e.target.value))}>
            <option value={1}>ภาคเรียนที่ 1</option>
            <option value={2}>ภาคเรียนที่ 2</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'end' }}>
          <button onClick={printSummary} style={{ background: '#64748b' }}>🖨️ พิมพ์</button>
          {loadMs !== null && <span className="timing">⚡ {loadMs} ms</span>}
        </div>
      </div>

      {rows.length > 0 && (
        <div style={{ overflowX: 'auto', marginTop: 14 }}>
          <table style={{ fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ position: 'sticky', left: 0, background: '#f1f5f9' }}>#</th>
                <th style={{ position: 'sticky', left: 40, background: '#f1f5f9', minWidth: 80 }}>เลข</th>
                <th style={{ position: 'sticky', left: 120, background: '#f1f5f9', minWidth: 150 }}>ชื่อ-สกุล</th>
                {subjects.map(s => <th key={s} style={{ textAlign: 'center', minWidth: 80 }}>{s}</th>)}
                <th style={{ textAlign: 'center', background: '#fef3c7', minWidth: 80 }}>เฉลี่ย</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((stu, i) => {
                const { g: avgG, color: avgC } = grade(stu.avg);
                return (
                  <tr key={stu.student_id}>
                    <td style={{ position: 'sticky', left: 0, background: '#fff' }}>{i+1}</td>
                    <td style={{ position: 'sticky', left: 40, background: '#fff' }}><b>{stu.student_id}</b></td>
                    <td style={{ position: 'sticky', left: 120, background: '#fff' }}>{stu.name}</td>
                    {stu.scores.map((v, si) => {
                      const { g, color } = grade(v);
                      return (
                        <td key={si} style={{ textAlign: 'center' }}>
                          {v !== null ? (
                            <div>
                              <div style={{ fontWeight: 700 }}>{v}</div>
                              <div style={{ fontSize: 10, color, fontWeight: 700 }}>{g}</div>
                            </div>
                          ) : <span style={{ color: '#cbd5e1' }}>—</span>}
                        </td>
                      );
                    })}
                    <td style={{ textAlign: 'center', background: '#fef9c3' }}>
                      {stu.avg !== null ? (
                        <div>
                          <div style={{ fontWeight: 800 }}>{stu.avg.toFixed(1)}</div>
                          <div style={{ fontSize: 11, color: avgC, fontWeight: 700 }}>เกรด {avgG}</div>
                        </div>
                      ) : <span style={{ color: '#cbd5e1' }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {cls && rows.length === 0 && <div style={{ textAlign: 'center', color: '#94a3b8', padding: 30 }}>ยังไม่มีข้อมูลผลการเรียน — ไปที่ tab "กรอกคะแนน" เพื่อเริ่มต้น</div>}
    </>
  );
}
