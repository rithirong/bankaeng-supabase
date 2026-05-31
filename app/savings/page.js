'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { getSession } from '@/lib/auth';
import { useYear } from '@/lib/year';
import { sortByClassAndStudentId } from '@/lib/sort';
import { supabase } from '@/lib/supabase';

const CLASSES = ['อ.2','อ.3','ป.1','ป.2','ป.3','ป.4','ป.5','ป.6'];

export default function SavingsPage() {
  const router = useRouter();
  const [s, setS] = useState(null);
  const [year] = useYear();
  const [tab, setTab] = useState('daily'); // daily | monthly | total

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
          <h2 style={{ margin: '0 0 14px' }}>💰 ออมทรัพย์ ปีการศึกษา {year}</h2>

          {/* Tab switcher */}
          <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', padding: 4, borderRadius: 10, marginBottom: 14 }}>
            <TabBtn active={tab === 'daily'}   onClick={() => setTab('daily')}>📝 รายวัน</TabBtn>
            <TabBtn active={tab === 'monthly'} onClick={() => setTab('monthly')}>📅 รายเดือน</TabBtn>
            <TabBtn active={tab === 'total'}   onClick={() => setTab('total')}>📊 ยอดรวม</TabBtn>
          </div>

          {tab === 'daily'   && <DailyTab   session={s} year={year} />}
          {tab === 'monthly' && <MonthlyTab session={s} year={year} />}
          {tab === 'total'   && <TotalTab   session={s} year={year} />}
        </div>
      </div>
    </>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button
      type="button" onClick={onClick}
      style={{
        flex: 1, padding: '10px 14px', border: 'none',
        background: active ? '#fff' : 'transparent',
        color: active ? '#1e40af' : '#64748b',
        borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer',
        boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
      }}
    >{children}</button>
  );
}

// ────────────────────────────────────────
// TAB 1: รายวัน — ฝาก/ถอน ทีละห้อง
// ────────────────────────────────────────
function DailyTab({ session, year }) {
  const [cls, setCls] = useState(session.role === 'teacher' && session.class ? session.class : '');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [students, setStudents] = useState([]); // [{student_id, name, balance, amount, txnId}]
  const [loadMs, setLoadMs] = useState(null);
  const [saveMs, setSaveMs] = useState(null);
  const [toast, setToast] = useState('');

  async function load() {
    if (!cls || !date) return alert('⚠️ เลือกชั้นและวันที่');
    const t0 = performance.now();
    const [enrRes, allSavRes, dayRes] = await Promise.all([
      supabase.from('enrollments')
        .select('students!inner(student_id, prefix, first_name, last_name)')
        .eq('school_id', session.schoolId).eq('academic_year', year).eq('class', cls)
        .in('status', ['ปกติ', 'ย้ายเข้า']),
      // savings ทั้งหมดของทุกคนในห้องนี้ (สำหรับคำนวณ balance สะสม)
      supabase.from('savings')
        .select('student_id, type, amount, txn_date')
        .eq('school_id', session.schoolId)
        .lte('txn_date', date), // ≤ วันที่เลือก
      // savings วันนี้ (เผื่อแก้รายการเดิม)
      supabase.from('savings')
        .select('id, student_id, type, amount')
        .eq('school_id', session.schoolId).eq('txn_date', date),
    ]);
    setLoadMs(Math.round(performance.now() - t0));
    if (enrRes.error || allSavRes.error || dayRes.error) {
      return alert('❌ ' + (enrRes.error || allSavRes.error || dayRes.error).message);
    }

    // คำนวณ balance สะสม ≤ date ของแต่ละ student
    const balMap = {};
    (allSavRes.data || []).forEach(r => {
      const amt = Number(r.amount) || 0;
      balMap[r.student_id] = (balMap[r.student_id] || 0) + (r.type === 'ฝาก' ? amt : -amt);
    });
    // หักรายการของวันนี้ออกก่อน → balance สะสมจะเป็น "ก่อนวันนี้"
    const todayMap = {};
    (dayRes.data || []).forEach(r => {
      todayMap[r.student_id] = r;
      const amt = Number(r.amount) || 0;
      balMap[r.student_id] = (balMap[r.student_id] || 0) - (r.type === 'ฝาก' ? amt : -amt);
    });

    const list = (enrRes.data || []).map(e => {
      const stu = e.students;
      const today = todayMap[stu.student_id];
      const todayAmt = today ? (today.type === 'ฝาก' ? Number(today.amount) : -Number(today.amount)) : '';
      return {
        student_id: stu.student_id,
        name: `${stu.prefix || ''}${stu.first_name || ''} ${stu.last_name || ''}`.trim(),
        balanceBefore: balMap[stu.student_id] || 0,
        amount: todayAmt === '' ? '' : String(todayAmt),
        txnId: today?.id || null,
      };
    });
    setStudents(sortByClassAndStudentId(list.map(x => ({ ...x, class: cls }))));
  }

  function setAmount(sid, val) {
    setStudents(prev => prev.map(s => s.student_id === sid ? { ...s, amount: val } : s));
  }

  async function save() {
    if (!students.length) return alert('⚠️ ยังไม่มีรายชื่อ');
    const records = [];
    const toDelete = [];
    students.forEach(s => {
      const numAmt = parseFloat(s.amount);
      if (isNaN(numAmt) || numAmt === 0) {
        // ถ้ามี record เดิมในวันนี้ + ใส่เป็นค่าว่าง/0 → ลบ
        if (s.txnId) toDelete.push(s.txnId);
        return;
      }
      records.push({
        school_id: session.schoolId,
        academic_year: year,
        student_id: s.student_id,
        class: cls,
        txn_date: date,
        type: numAmt > 0 ? 'ฝาก' : 'ถอน',
        amount: Math.abs(numAmt),
        recorded_by: session.name,
      });
    });

    const t0 = performance.now();
    // ลบของเก่าก่อน (ทั้งของวันนี้) แล้วค่อย insert ใหม่ → กัน duplicate
    const sidList = records.map(r => r.student_id).concat(toDelete.length ? students.filter(s => toDelete.includes(s.txnId)).map(s => s.student_id) : []);
    if (sidList.length > 0) {
      await supabase.from('savings').delete()
        .eq('school_id', session.schoolId).eq('txn_date', date)
        .in('student_id', sidList);
    }
    if (records.length > 0) {
      const { error } = await supabase.from('savings').insert(records);
      if (error) return alert('❌ ' + error.message);
    }
    setSaveMs(Math.round(performance.now() - t0));
    setToast(`✅ บันทึก ${records.length} รายการ${toDelete.length ? `, ลบ ${toDelete.length}` : ''}`);
    setTimeout(() => setToast(''), 2500);
    load();
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
          <button onClick={load}>📋 โหลดรายชื่อ</button>
        </div>
      </div>

      {loadMs !== null && <div style={{ marginTop: 10 }}><span className="timing">⚡ {students.length} คน · {loadMs} ms</span></div>}

      {students.length > 0 && (
        <>
          <div style={{ marginTop: 14, padding: 10, background: '#eff6ff', borderRadius: 8, fontSize: 13, color: '#1e40af' }}>
            💡 <b>วิธีใช้:</b> พิมพ์จำนวนเงิน → กดบันทึก<br/>
            • <b>เลขบวก</b> (เช่น <code>50</code>) = ฝาก<br/>
            • <b>เลขลบ</b> (เช่น <code>-30</code>) = ถอน<br/>
            • <b>ว่าง</b> หรือ <code>0</code> = ไม่มีรายการวันนี้ (ลบรายการเดิมถ้ามี)
          </div>

          <div style={{ overflowX: 'auto', marginTop: 14 }}>
            <table>
              <thead>
                <tr>
                  <th>#</th><th>เลขประจำตัว</th><th>ชื่อ-สกุล</th>
                  <th style={{ textAlign: 'right' }}>ยอดสะสม (ก่อน)</th>
                  <th style={{ textAlign: 'right' }}>ฝาก/ถอนวันนี้</th>
                </tr>
              </thead>
              <tbody>
                {students.map((stu, i) => (
                  <tr key={stu.student_id}>
                    <td>{i + 1}</td>
                    <td><b>{stu.student_id}</b></td>
                    <td>{stu.name}</td>
                    <td style={{ textAlign: 'right', color: '#475569' }}>{stu.balanceBefore.toLocaleString()}</td>
                    <td style={{ textAlign: 'right' }}>
                      <input
                        type="number" step="1" value={stu.amount}
                        onChange={e => setAmount(stu.student_id, e.target.value)}
                        placeholder="0"
                        style={{ width: 100, textAlign: 'right', padding: '5px 8px' }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center' }}>
            <button className="success" onClick={save}>💾 บันทึก</button>
            {saveMs !== null && <span className="timing">✅ {saveMs} ms</span>}
          </div>
        </>
      )}

      {toast && <div className="toast show">{toast}</div>}
    </>
  );
}

// ────────────────────────────────────────
// TAB 2: รายเดือน — grid (วันที่ × ชื่อ)
// ────────────────────────────────────────
function MonthlyTab({ session, year }) {
  const [cls, setCls] = useState(session.role === 'teacher' && session.class ? session.class : '');
  const [yearMonth, setYearMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [grid, setGrid] = useState(null); // {students, days, dataMap}
  const [loadMs, setLoadMs] = useState(null);

  async function load() {
    if (!cls || !yearMonth) return alert('⚠️ เลือกชั้นและเดือน');
    const t0 = performance.now();
    const [yy, mm] = yearMonth.split('-').map(Number);
    const startDate = `${yy}-${String(mm).padStart(2, '0')}-01`;
    const endMonth = mm === 12 ? `${yy + 1}-01-01` : `${yy}-${String(mm + 1).padStart(2, '0')}-01`;

    const [enrRes, savRes] = await Promise.all([
      supabase.from('enrollments')
        .select('students!inner(student_id, prefix, first_name, last_name)')
        .eq('school_id', session.schoolId).eq('academic_year', year).eq('class', cls)
        .in('status', ['ปกติ', 'ย้ายเข้า']),
      supabase.from('savings')
        .select('student_id, type, amount, txn_date')
        .eq('school_id', session.schoolId).eq('class', cls)
        .gte('txn_date', startDate).lt('txn_date', endMonth),
    ]);
    setLoadMs(Math.round(performance.now() - t0));
    if (enrRes.error || savRes.error) return alert('❌ ' + (enrRes.error || savRes.error).message);

    // students sorted
    const list = (enrRes.data || []).map(e => ({
      ...e.students,
      name: `${e.students.prefix || ''}${e.students.first_name || ''} ${e.students.last_name || ''}`.trim(),
      class: cls,
    }));
    const studentsSorted = sortByClassAndStudentId(list);

    // วันในเดือน
    const lastDay = new Date(yy, mm, 0).getDate();
    const days = [];
    for (let d = 1; d <= lastDay; d++) days.push(d);

    // grid: dataMap[sid][day] = signed amount
    const dataMap = {};
    (savRes.data || []).forEach(r => {
      const d = parseInt(r.txn_date.slice(8, 10));
      const amt = (Number(r.amount) || 0) * (r.type === 'ฝาก' ? 1 : -1);
      if (!dataMap[r.student_id]) dataMap[r.student_id] = {};
      dataMap[r.student_id][d] = (dataMap[r.student_id][d] || 0) + amt;
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
          <table style={{ fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ position: 'sticky', left: 0, background: '#f1f5f9' }}>เลขประจำตัว</th>
                <th style={{ position: 'sticky', left: 80, background: '#f1f5f9' }}>ชื่อ</th>
                {grid.days.map(d => <th key={d} style={{ minWidth: 38, textAlign: 'center' }}>{d}</th>)}
                <th style={{ textAlign: 'right' }}>รวมเดือน</th>
              </tr>
            </thead>
            <tbody>
              {grid.students.map(stu => {
                let monthTotal = 0;
                return (
                  <tr key={stu.student_id}>
                    <td style={{ position: 'sticky', left: 0, background: '#fff' }}><b>{stu.student_id}</b></td>
                    <td style={{ position: 'sticky', left: 80, background: '#fff' }}>{stu.name}</td>
                    {grid.days.map(d => {
                      const v = grid.dataMap[stu.student_id]?.[d];
                      if (v !== undefined) monthTotal += v;
                      return (
                        <td key={d} style={{
                          textAlign: 'center',
                          color: v > 0 ? '#16a34a' : v < 0 ? '#dc2626' : '#cbd5e1',
                          fontWeight: v ? 700 : 400,
                        }}>
                          {v === undefined ? '·' : Math.abs(v)}
                        </td>
                      );
                    })}
                    <td style={{ textAlign: 'right', fontWeight: 700, color: monthTotal >= 0 ? '#16a34a' : '#dc2626' }}>
                      {monthTotal.toLocaleString()}
                    </td>
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
// TAB 3: ยอดรวมต่อคน
// ────────────────────────────────────────
function TotalTab({ session, year }) {
  const [cls, setCls] = useState(session.role === 'teacher' && session.class ? session.class : '');
  const [rows, setRows] = useState([]);
  const [loadMs, setLoadMs] = useState(null);

  async function load() {
    if (!cls) return alert('⚠️ เลือกชั้น');
    const t0 = performance.now();
    const [enrRes, savRes] = await Promise.all([
      supabase.from('enrollments')
        .select('students!inner(student_id, prefix, first_name, last_name)')
        .eq('school_id', session.schoolId).eq('academic_year', year).eq('class', cls)
        .in('status', ['ปกติ', 'ย้ายเข้า']),
      // นับจากทุกปี (cumulative)
      supabase.from('savings')
        .select('student_id, type, amount')
        .eq('school_id', session.schoolId),
    ]);
    setLoadMs(Math.round(performance.now() - t0));
    if (enrRes.error || savRes.error) return alert('❌ ' + (enrRes.error || savRes.error).message);

    const balMap = {};
    const cntMap = {};
    (savRes.data || []).forEach(r => {
      const amt = (Number(r.amount) || 0) * (r.type === 'ฝาก' ? 1 : -1);
      balMap[r.student_id] = (balMap[r.student_id] || 0) + amt;
      cntMap[r.student_id] = (cntMap[r.student_id] || 0) + 1;
    });

    const list = (enrRes.data || []).map(e => ({
      ...e.students,
      class: cls,
      name: `${e.students.prefix || ''}${e.students.first_name || ''} ${e.students.last_name || ''}`.trim(),
      balance: balMap[e.students.student_id] || 0,
      count: cntMap[e.students.student_id] || 0,
    }));
    setRows(sortByClassAndStudentId(list));
  }

  const totalSum = rows.reduce((s, r) => s + r.balance, 0);

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
        <div style={{ display: 'flex', gap: 8, alignItems: 'end' }}>
          <button onClick={load}>📋 โหลด</button>
        </div>
      </div>

      {loadMs !== null && <div style={{ marginTop: 10 }}><span className="timing">⚡ {loadMs} ms</span></div>}

      {rows.length > 0 && (
        <>
          <div className="card" style={{ marginTop: 14, marginBottom: 0, background: '#dcfce7', textAlign: 'center', padding: 14 }}>
            <div style={{ fontSize: 13, color: '#166534', fontWeight: 600 }}>💰 ยอดรวมเงินออม ห้อง {cls}</div>
            <div style={{ fontSize: 34, fontWeight: 800, color: '#16a34a', marginTop: 4 }}>
              {totalSum.toLocaleString()} <span style={{ fontSize: 16, color: '#94a3b8' }}>บาท</span>
            </div>
          </div>

          <div style={{ overflowX: 'auto', marginTop: 14 }}>
            <table>
              <thead>
                <tr>
                  <th>#</th><th>เลขประจำตัว</th><th>ชื่อ-สกุล</th>
                  <th style={{ textAlign: 'center' }}>รายการ</th>
                  <th style={{ textAlign: 'right' }}>ยอดสะสม</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.student_id}>
                    <td>{i + 1}</td>
                    <td><b>{r.student_id}</b></td>
                    <td>{r.name}</td>
                    <td style={{ textAlign: 'center', color: '#64748b' }}>{r.count}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: r.balance >= 0 ? '#16a34a' : '#dc2626' }}>
                      {r.balance.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
