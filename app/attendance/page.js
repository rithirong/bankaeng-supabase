'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { getSession } from '@/lib/auth';
import { useYear } from '@/lib/year';
import { sortByClassAndStudentId } from '@/lib/sort';
import { supabase } from '@/lib/supabase';

const CLASSES = ['อ.2','อ.3','ป.1','ป.2','ป.3','ป.4','ป.5','ป.6'];
const STATUSES = ['มา', 'ขาด', 'ลา', 'ป่วย'];
const STATUS_COLORS = {
  'มา':   { bg: '#dcfce7', fg: '#166534' },
  'ขาด':  { bg: '#fee2e2', fg: '#991b1b' },
  'ลา':   { bg: '#fef3c7', fg: '#92400e' },
  'ป่วย': { bg: '#dbeafe', fg: '#1e40af' },
};

export default function AttendancePage() {
  const router = useRouter();
  const [s, setS] = useState(null);
  const [year] = useYear();
  const [tab, setTab] = useState('daily');

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
          <h2 style={{ margin: '0 0 14px' }}>📝 เช็คชื่อ ปีการศึกษา {year}</h2>

          <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', padding: 4, borderRadius: 10, marginBottom: 14 }}>
            <TabBtn active={tab === 'daily'}    onClick={() => setTab('daily')}>📝 รายวัน (เช็คชื่อ)</TabBtn>
            <TabBtn active={tab === 'monthly'}  onClick={() => setTab('monthly')}>📅 รายเดือน</TabBtn>
            <TabBtn active={tab === 'school'}   onClick={() => setTab('school')}>🏫 ทั้งโรงเรียน + พิมพ์</TabBtn>
          </div>

          {tab === 'daily'   && <DailyTab   session={s} year={year} />}
          {tab === 'monthly' && <MonthlyTab session={s} year={year} />}
          {tab === 'school'  && <SchoolTab  session={s} year={year} />}
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
// TAB 1: รายวัน (เช็คชื่อ)
// ────────────────────────────────────────
function DailyTab({ session, year }) {
  const [cls, setCls] = useState(session.role === 'teacher' && session.class ? session.class : '');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [students, setStudents] = useState([]);
  const [statusMap, setStatusMap] = useState({});
  const [loadMs, setLoadMs] = useState(null);
  const [saveMs, setSaveMs] = useState(null);
  const [toast, setToast] = useState('');

  async function load() {
    if (!cls || !date) return alert('⚠️ เลือกชั้นและวันที่');
    const t0 = performance.now();
    const [enrRes, attRes] = await Promise.all([
      supabase.from('enrollments')
        .select('no_in_class, students!inner(student_id, prefix, first_name, last_name)')
        .eq('school_id', session.schoolId).eq('academic_year', year).eq('class', cls)
        .in('status', ['ปกติ', 'ย้ายเข้า']),
      supabase.from('attendance')
        .select('student_id, status, remark')
        .eq('school_id', session.schoolId).eq('class', cls).eq('attendance_date', date),
    ]);
    setLoadMs(Math.round(performance.now() - t0));
    if (enrRes.error) return alert('❌ ' + enrRes.error.message);

    const list = (enrRes.data || []).map(e => ({
      ...e.students,
      class: cls,
      no_in_class: e.no_in_class,
    }));
    setStudents(sortByClassAndStudentId(list));

    const map = {};
    (attRes.data || []).forEach(r => { map[r.student_id] = { status: r.status, remark: r.remark || '' }; });
    setStatusMap(map);
  }

  function setStat(sid, key, val) {
    setStatusMap(p => ({ ...p, [sid]: { ...(p[sid] || { status: 'มา', remark: '' }), [key]: val } }));
  }
  function markAll() {
    const m = {};
    students.forEach(stu => { m[stu.student_id] = { status: 'มา', remark: statusMap[stu.student_id]?.remark || '' }; });
    setStatusMap(m);
  }
  function showToast(m) { setToast(m); setTimeout(() => setToast(''), 2000); }

  async function save() {
    if (!students.length) return alert('⚠️ ยังไม่มีรายชื่อ');
    const rows = students.map(stu => ({
      school_id: session.schoolId, attendance_date: date, student_id: stu.student_id, class: cls,
      status: statusMap[stu.student_id]?.status || 'มา',
      remark: statusMap[stu.student_id]?.remark || null,
      recorded_by: session.name,
      updated_at: new Date().toISOString(),
    }));
    const t0 = performance.now();
    const { error } = await supabase.from('attendance').upsert(rows, { onConflict: 'school_id,attendance_date,student_id' });
    setSaveMs(Math.round(performance.now() - t0));
    if (error) return alert('❌ ' + error.message);
    showToast(`✅ บันทึก ${rows.length} record`);
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
          <label style={{ fontSize: 12, fontWeight: 600 }}>วันที่</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'end' }}>
          <button onClick={load}>📋 โหลด</button>
          <button className="secondary" onClick={markAll}>✅ มาทั้งห้อง</button>
        </div>
      </div>

      {loadMs !== null && <div style={{ marginTop: 10 }}><span className="timing">⚡ โหลด {students.length} คน ใน {loadMs} ms</span></div>}

      {students.length > 0 && (
        <>
          <div style={{ overflowX: 'auto', marginTop: 14 }}>
            <table>
              <thead>
                <tr><th>#</th><th>เลขประจำตัว</th><th>ชื่อ-สกุล</th><th>สถานะ</th><th>หมายเหตุ</th></tr>
              </thead>
              <tbody>
                {students.map((stu, i) => {
                  const cur = statusMap[stu.student_id] || { status: 'มา', remark: '' };
                  return (
                    <tr key={stu.student_id}>
                      <td>{i + 1}</td>
                      <td><b>{stu.student_id}</b></td>
                      <td>{stu.prefix}{stu.first_name} {stu.last_name}</td>
                      <td>
                        <select value={cur.status} onChange={e => setStat(stu.student_id, 'status', e.target.value)}>
                          {STATUSES.map(s => <option key={s}>{s}</option>)}
                        </select>
                      </td>
                      <td><input value={cur.remark} onChange={e => setStat(stu.student_id, 'remark', e.target.value)} placeholder="(ไม่มี)" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center' }}>
            <button className="success" onClick={save}>💾 บันทึกเช็คชื่อ</button>
            {saveMs !== null && <span className="timing">✅ บันทึก {saveMs} ms</span>}
          </div>
        </>
      )}

      {toast && <div className="toast show">{toast}</div>}
    </>
  );
}

// ────────────────────────────────────────
// TAB 2: รายเดือน (grid วันที่ × ชื่อ)
// ────────────────────────────────────────
function MonthlyTab({ session, year }) {
  const [cls, setCls] = useState(session.role === 'teacher' && session.class ? session.class : '');
  const [yearMonth, setYearMonth] = useState(new Date().toISOString().slice(0, 7));
  const [grid, setGrid] = useState(null);
  const [loadMs, setLoadMs] = useState(null);

  async function load() {
    if (!cls || !yearMonth) return alert('⚠️ เลือกชั้นและเดือน');
    const t0 = performance.now();
    const [yy, mm] = yearMonth.split('-').map(Number);
    const startDate = `${yy}-${String(mm).padStart(2, '0')}-01`;
    const endMonth = mm === 12 ? `${yy + 1}-01-01` : `${yy}-${String(mm + 1).padStart(2, '0')}-01`;

    const [enrRes, attRes] = await Promise.all([
      supabase.from('enrollments')
        .select('students!inner(student_id, prefix, first_name, last_name)')
        .eq('school_id', session.schoolId).eq('academic_year', year).eq('class', cls)
        .in('status', ['ปกติ', 'ย้ายเข้า']),
      supabase.from('attendance')
        .select('student_id, status, attendance_date')
        .eq('school_id', session.schoolId).eq('class', cls)
        .gte('attendance_date', startDate).lt('attendance_date', endMonth),
    ]);
    setLoadMs(Math.round(performance.now() - t0));
    if (enrRes.error || attRes.error) return alert('❌ ' + (enrRes.error || attRes.error).message);

    const list = (enrRes.data || []).map(e => ({
      ...e.students,
      name: `${e.students.prefix || ''}${e.students.first_name || ''} ${e.students.last_name || ''}`.trim(),
      class: cls,
    }));
    const studentsSorted = sortByClassAndStudentId(list);

    const lastDay = new Date(yy, mm, 0).getDate();
    const days = [];
    for (let d = 1; d <= lastDay; d++) {
      const dObj = new Date(yy, mm - 1, d);
      const dow = dObj.getDay();
      days.push({ day: d, dow, isWeekend: dow === 0 || dow === 6 });
    }

    // dataMap[sid][day] = status
    const dataMap = {};
    (attRes.data || []).forEach(r => {
      const d = parseInt(r.attendance_date.slice(8, 10));
      if (!dataMap[r.student_id]) dataMap[r.student_id] = {};
      dataMap[r.student_id][d] = r.status;
    });

    setGrid({ students: studentsSorted, days, dataMap });
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
          <label style={{ fontSize: 12, fontWeight: 600 }}>เดือน</label>
          <input type="month" value={yearMonth} onChange={e => setYearMonth(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'end' }}>
          <button onClick={load}>📋 โหลด</button>
        </div>
      </div>

      {loadMs !== null && <div style={{ marginTop: 10 }}><span className="timing">⚡ {loadMs} ms</span></div>}

      {grid && (
        <div style={{ overflowX: 'auto', marginTop: 14 }}>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>
            สัญลักษณ์: <b style={{color:'#166534'}}>✓</b> มา · <b style={{color:'#991b1b'}}>X</b> ขาด · <b style={{color:'#92400e'}}>ล</b> ลา · <b style={{color:'#1e40af'}}>ป</b> ป่วย
          </div>
          <table style={{ fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ position: 'sticky', left: 0, background: '#f1f5f9', minWidth: 80 }}>เลขประจำตัว</th>
                <th style={{ position: 'sticky', left: 80, background: '#f1f5f9', minWidth: 140 }}>ชื่อ</th>
                {grid.days.map(d => (
                  <th key={d.day} style={{
                    minWidth: 30, textAlign: 'center',
                    background: d.isWeekend ? '#fef2f2' : '#f1f5f9',
                    color: d.isWeekend ? '#991b1b' : '#1e293b',
                  }}>{d.day}</th>
                ))}
                <th style={{ textAlign: 'center', minWidth: 50, background: '#dcfce7' }}>มา</th>
                <th style={{ textAlign: 'center', minWidth: 50, background: '#fee2e2' }}>ขาด</th>
              </tr>
            </thead>
            <tbody>
              {grid.students.map(stu => {
                let countPresent = 0, countAbsent = 0;
                return (
                  <tr key={stu.student_id}>
                    <td style={{ position: 'sticky', left: 0, background: '#fff' }}><b>{stu.student_id}</b></td>
                    <td style={{ position: 'sticky', left: 80, background: '#fff' }}>{stu.name}</td>
                    {grid.days.map(d => {
                      const status = grid.dataMap[stu.student_id]?.[d.day];
                      if (status === 'มา') countPresent++;
                      else if (status === 'ขาด') countAbsent++;
                      const symbol = status === 'มา' ? '✓' : status === 'ขาด' ? 'X' : status === 'ลา' ? 'ล' : status === 'ป่วย' ? 'ป' : '·';
                      const c = STATUS_COLORS[status];
                      return (
                        <td key={d.day} style={{
                          textAlign: 'center', fontWeight: status ? 700 : 400,
                          color: c ? c.fg : '#cbd5e1',
                          background: d.isWeekend ? '#fef9f9' : 'transparent',
                        }}>{symbol}</td>
                      );
                    })}
                    <td style={{ textAlign: 'center', fontWeight: 700, color: '#166534' }}>{countPresent}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: '#991b1b' }}>{countAbsent}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ────────────────────────────────────────
// TAB 3: ทั้งโรงเรียน + พิมพ์รายงาน
// ────────────────────────────────────────
function SchoolTab({ session, year }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [stats, setStats] = useState(null);
  const [loadMs, setLoadMs] = useState(null);

  async function load() {
    if (!date) return;
    const t0 = performance.now();
    // โหลด enrollments ทุกห้อง + เพศจาก students + attendance ของวันนั้น
    const [enrRes, attRes] = await Promise.all([
      supabase.from('enrollments')
        .select('class, students!inner(student_id, gender)')
        .eq('school_id', session.schoolId).eq('academic_year', year)
        .in('status', ['ปกติ', 'ย้ายเข้า']),
      supabase.from('attendance')
        .select('class, student_id, status')
        .eq('school_id', session.schoolId).eq('attendance_date', date),
    ]);
    setLoadMs(Math.round(performance.now() - t0));
    if (enrRes.error || attRes.error) return alert('❌ ' + (enrRes.error || attRes.error).message);

    // สร้างสถิติ
    const result = {};
    CLASSES.forEach(c => {
      result[c] = { total: { m: 0, f: 0, all: 0 } };
      STATUSES.forEach(st => { result[c][st] = { m: 0, f: 0, all: 0 }; });
    });

    // index attendance by student_id
    const attBySid = {};
    (attRes.data || []).forEach(r => { attBySid[r.student_id] = r.status; });

    // นับ
    (enrRes.data || []).forEach(e => {
      const c = e.class;
      const stu = e.students;
      if (!result[c]) return;
      const g = stu.gender === 'ญ' ? 'f' : 'm';
      result[c].total[g]++;
      result[c].total.all++;
      const status = attBySid[stu.student_id];
      if (status && result[c][status]) {
        result[c][status][g]++;
        result[c][status].all++;
      }
      // ถ้าไม่มี record = ไม่นับ (เหมือนยังไม่เช็คชื่อ)
    });

    setStats(result);
  }

  function doPrint() {
    window.print();
  }

  // คำนวณ grand total
  let grandTotal = null;
  if (stats) {
    grandTotal = { total: { m: 0, f: 0, all: 0 } };
    STATUSES.forEach(st => { grandTotal[st] = { m: 0, f: 0, all: 0 }; });
    CLASSES.forEach(c => {
      ['total', ...STATUSES].forEach(k => {
        grandTotal[k].m += stats[c][k].m;
        grandTotal[k].f += stats[c][k].f;
        grandTotal[k].all += stats[c][k].all;
      });
    });
  }

  const dateLabel = date ? new Date(date).toLocaleDateString('th-TH', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', calendar: 'buddhist',
  }) : '';

  return (
    <>
      <div className="no-print">
        <div className="row">
          <div>
            <label style={{ fontSize: 12, fontWeight: 600 }}>วันที่</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'end' }}>
            <button onClick={load}>📋 โหลดสถิติ</button>
            {stats && <button className="success" onClick={doPrint}>🖨️ พิมพ์</button>}
          </div>
        </div>

        {loadMs !== null && <div style={{ marginTop: 10 }}><span className="timing">⚡ {loadMs} ms</span></div>}
      </div>

      {stats && (
        <div className="print-area" style={{ marginTop: 14 }}>
          <div className="print-header" style={{ textAlign: 'center', marginBottom: 14, display: 'none' }}>
            <h2 style={{ margin: 0 }}>📊 รายงานสถิตินักเรียน {session.school?.name}</h2>
            <div style={{ fontSize: 14, color: '#475569' }}>ประจำ{dateLabel}</div>
          </div>
          <div className="screen-header" style={{ marginBottom: 10 }}>
            <h3 style={{ margin: 0, color: '#1e40af' }}>สถิติประจำ{dateLabel}</h3>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f1f5f9' }}>
                  <th rowSpan="2" style={{ textAlign: 'center' }}>ชั้น</th>
                  <th colSpan="3" style={{ textAlign: 'center' }}>จำนวนนักเรียน</th>
                  <th colSpan="3" style={{ textAlign: 'center', background: '#dcfce7' }}>มา</th>
                  <th colSpan="3" style={{ textAlign: 'center', background: '#fee2e2' }}>ขาด</th>
                  <th colSpan="3" style={{ textAlign: 'center', background: '#fef3c7' }}>ลา</th>
                  <th colSpan="3" style={{ textAlign: 'center', background: '#dbeafe' }}>ป่วย</th>
                  <th rowSpan="2" style={{ textAlign: 'center', background: '#e0e7ff' }}>%มา</th>
                </tr>
                <tr style={{ background: '#f8fafc' }}>
                  {['ช','ญ','รวม','ช','ญ','รวม','ช','ญ','รวม','ช','ญ','รวม','ช','ญ','รวม'].map((h, i) => (
                    <th key={i} style={{ textAlign: 'center', fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CLASSES.map(c => {
                  const s = stats[c];
                  const pct = s.total.all > 0 ? ((s['มา'].all / s.total.all) * 100).toFixed(1) : '—';
                  return (
                    <tr key={c}>
                      <td style={{ fontWeight: 700 }}>{c}</td>
                      <Cells data={s.total} />
                      <Cells data={s['มา']}   color="#166534" />
                      <Cells data={s['ขาด']}  color="#991b1b" />
                      <Cells data={s['ลา']}   color="#92400e" />
                      <Cells data={s['ป่วย']} color="#1e40af" />
                      <td style={{ textAlign: 'center', fontWeight: 700, color: '#4338ca' }}>{pct}%</td>
                    </tr>
                  );
                })}
                {grandTotal && (
                  <tr style={{ background: '#f1f5f9', fontWeight: 700 }}>
                    <td>รวม</td>
                    <Cells data={grandTotal.total} />
                    <Cells data={grandTotal['มา']}   color="#166534" />
                    <Cells data={grandTotal['ขาด']}  color="#991b1b" />
                    <Cells data={grandTotal['ลา']}   color="#92400e" />
                    <Cells data={grandTotal['ป่วย']} color="#1e40af" />
                    <td style={{ textAlign: 'center', color: '#4338ca' }}>
                      {grandTotal.total.all > 0 ? ((grandTotal['มา'].all / grandTotal.total.all) * 100).toFixed(1) + '%' : '—'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style jsx>{`
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          :global(body > *) { display: none !important; }
          :global(body > .print-root) { display: block !important; }
          :global(.no-print) { display: none !important; }
          .print-area { display: block !important; }
          .print-header { display: block !important; }
          .screen-header { display: none !important; }
        }
      `}</style>
    </>
  );
}

function Cells({ data, color }) {
  return (
    <>
      <td style={{ textAlign: 'center', color }}>{data.m || ''}</td>
      <td style={{ textAlign: 'center', color }}>{data.f || ''}</td>
      <td style={{ textAlign: 'center', fontWeight: 700, color }}>{data.all || ''}</td>
    </>
  );
}
