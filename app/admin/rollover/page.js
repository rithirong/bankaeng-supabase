'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { getSession } from '@/lib/auth';
import { useYear } from '@/lib/year';
import { sortByClassAndStudentId } from '@/lib/sort';
import { supabase } from '@/lib/supabase';

const STATUSES = ['ปกติ', 'ย้ายเข้า', 'ย้ายออก', 'ลาออก', 'จบ', 'ซ้ำชั้น'];
const CLASS_ORDER = ['อ.2','อ.3','ป.1','ป.2','ป.3','ป.4','ป.5','ป.6'];

export default function RolloverPage() {
  const router = useRouter();
  const [s, setS] = useState(null);
  const [year] = useYear();
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState('ทั้งหมด');
  const [loadMs, setLoadMs] = useState(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    const sess = getSession();
    if (!sess) { router.replace('/'); return; }
    if (sess.role !== 'admin') { alert('เฉพาะ admin'); router.replace('/dashboard'); return; }
    setS(sess);
  }, [router]);

  useEffect(() => { if (s) load(); }, [s, year]);

  async function load() {
    const t0 = performance.now();
    const { data, error } = await supabase
      .from('enrollments')
      .select('id, class, no_in_class, status, students!inner(student_id, prefix, first_name, last_name)')
      .eq('school_id', s.schoolId).eq('academic_year', year);
    setLoadMs(Math.round(performance.now() - t0));
    if (error) return alert(error.message);
    const list = (data || []).map(e => ({
      enrId: e.id, class: e.class, no_in_class: e.no_in_class, status: e.status,
      ...e.students,
    }));
    // เรียงตามชั้น (อ.2 → ป.6) แล้วเลขประจำตัวภายในชั้น
    setRows(sortByClassAndStudentId(list));
  }

  async function updateRow(enrId, patch) {
    const { error } = await supabase.from('enrollments').update(patch).eq('id', enrId);
    if (error) return alert(error.message);
    showToast('✅ อัปเดตแล้ว');
    load();
  }

  function showToast(m) { setToast(m); setTimeout(() => setToast(''), 1500); }

  if (!s) return null;

  const filtered = filter === 'ทั้งหมด' ? rows : rows.filter(r => r.class === filter);
  const byStatus = STATUSES.map(st => ({ st, n: rows.filter(r => r.status === st).length }));

  return (
    <>
      <TopBar />
      <div className="wrap">
        <div className="card" style={{ background: '#fef3c7', borderColor: '#fcd34d' }}>
          <h2 style={{ color: '#92400e' }}>📅 จัดการเลื่อนชั้น / สถานะ — ปี {year}</h2>
          <div style={{ fontSize: 13, color: '#78350f', marginBottom: 10 }}>
            • คลิกที่ <b>ชั้น</b>, <b>เลขที่</b>, <b>สถานะ</b> เพื่อแก้ไข<br/>
            • เลื่อนชั้นแบบ bulk ทั้งโรงเรียน → ใช้ SQL ใน Supabase (อยู่ใน Step 54)
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            {byStatus.map(({ st, n }) => (
              <span key={st} style={{
                padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                background: '#fff', border: '1px solid #fcd34d',
              }}>{st}: {n}</span>
            ))}
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="row" style={{ flex: 1 }}>
              <select value={filter} onChange={e => setFilter(e.target.value)} style={{ maxWidth: 180 }}>
                <option>ทั้งหมด</option>
                {CLASS_ORDER.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            {loadMs !== null && <span className="timing">⚡ {loadMs} ms</span>}
          </div>

          <div style={{ marginTop: 10, fontSize: 13, color: '#64748b' }}>
            แสดง {filtered.length} จาก {rows.length} คน
          </div>

          <div style={{ overflowX: 'auto', marginTop: 10 }}>
            <table>
              <thead>
                <tr>
                  <th>#</th><th>เลขประจำตัว</th><th>ชื่อ-สกุล</th>
                  <th>ชั้น</th><th>เลขที่</th><th>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.enrId}>
                    <td>{i + 1}</td>
                    <td><b>{r.student_id}</b></td>
                    <td>{r.prefix}{r.first_name} {r.last_name}</td>
                    <td>
                      <select value={r.class} onChange={e => updateRow(r.enrId, { class: e.target.value })}
                              style={{ padding: '4px 8px', minWidth: 80 }}>
                        {CLASS_ORDER.map(c => <option key={c}>{c}</option>)}
                      </select>
                    </td>
                    <td>
                      <input type="number" value={r.no_in_class || ''}
                             onBlur={e => updateRow(r.enrId, { no_in_class: parseInt(e.target.value) || null })}
                             onChange={e => {
                               const v = parseInt(e.target.value) || null;
                               setRows(prev => prev.map(x => x.enrId === r.enrId ? { ...x, no_in_class: v } : x));
                             }}
                             style={{ padding: '4px 8px', width: 70 }} />
                    </td>
                    <td>
                      <select value={r.status} onChange={e => updateRow(r.enrId, { status: e.target.value })}
                              style={{
                                padding: '4px 8px',
                                background: r.status === 'จบ' ? '#dcfce7' : ['ย้ายออก','ลาออก'].includes(r.status) ? '#fee2e2' : '#fff',
                              }}>
                        {STATUSES.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {toast && <div className="toast show">{toast}</div>}
    </>
  );
}