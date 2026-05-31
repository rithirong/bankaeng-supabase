'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ParentTopBar from '@/components/ParentTopBar';
import { getSession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

const STATUS_COLORS = {
  'มา':   { bg: '#dcfce7', fg: '#166534' },
  'ขาด':  { bg: '#fee2e2', fg: '#991b1b' },
  'ลา':   { bg: '#fef3c7', fg: '#92400e' },
  'ป่วย': { bg: '#dbeafe', fg: '#1e40af' },
};

export default function ParentAttendancePage() {
  const router = useRouter();
  const [s, setS] = useState(null);
  const [records, setRecords] = useState([]);
  const [loadMs, setLoadMs] = useState(null);

  useEffect(() => {
    const sess = getSession();
    if (!sess || sess.role !== 'parent') { router.replace('/'); return; }
    setS(sess);
    load(sess);
  }, [router]);

  async function load(sess) {
    const t0 = performance.now();
    const { data, error } = await supabase
      .from('attendance')
      .select('attendance_date, status, remark, class')
      .eq('school_id', sess.schoolId).eq('student_id', sess.studentId)
      .order('attendance_date', { ascending: false });
    setLoadMs(Math.round(performance.now() - t0));
    if (error) return alert(error.message);
    setRecords(data || []);
  }

  if (!s) return null;

  // สรุป
  const summary = { 'มา': 0, 'ขาด': 0, 'ลา': 0, 'ป่วย': 0 };
  records.forEach(r => { if (summary[r.status] !== undefined) summary[r.status]++; });

  return (
    <>
      <ParentTopBar />
      <div className="wrap">
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0 }}>📝 ประวัติการมาเรียน — {s.name}</h2>
            {loadMs !== null && <span className="timing">⚡ {loadMs} ms</span>}
          </div>

          <div className="row" style={{ marginTop: 14 }}>
            {Object.entries(summary).map(([st, n]) => {
              const c = STATUS_COLORS[st];
              return (
                <div key={st} className="card" style={{ margin: 0, background: c.bg, color: c.fg, textAlign: 'center', padding: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{st}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, marginTop: 2 }}>{n}</div>
                </div>
              );
            })}
          </div>

          <div style={{ overflowX: 'auto', marginTop: 14 }}>
            <table>
              <thead>
                <tr><th>วันที่</th><th>ชั้น</th><th>สถานะ</th><th>หมายเหตุ</th></tr>
              </thead>
              <tbody>
                {records.map((r, i) => {
                  const c = STATUS_COLORS[r.status] || { bg: '#f1f5f9', fg: '#475569' };
                  return (
                    <tr key={i}>
                      <td>{new Date(r.attendance_date).toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', calendar: 'buddhist' })}</td>
                      <td>{r.class || '—'}</td>
                      <td>
                        <span style={{
                          padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                          background: c.bg, color: c.fg,
                        }}>{r.status}</span>
                      </td>
                      <td style={{ color: '#64748b', fontSize: 13 }}>{r.remark || ''}</td>
                    </tr>
                  );
                })}
                {records.length === 0 && (
                  <tr><td colSpan="4" style={{ textAlign: 'center', color: '#94a3b8', padding: 20 }}>— ยังไม่มีข้อมูล —</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
