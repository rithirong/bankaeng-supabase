'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ParentTopBar from '@/components/ParentTopBar';
import { getSession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export default function ParentSavingsPage() {
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
      .from('savings')
      .select('txn_date, type, amount, remark, class, academic_year')
      .eq('school_id', sess.schoolId).eq('student_id', sess.studentId)
      .order('txn_date', { ascending: false });
    setLoadMs(Math.round(performance.now() - t0));
    if (error) return alert(error.message);
    setRecords(data || []);
  }

  if (!s) return null;

  // คำนวณ running balance (ใช้ records ที่ sort desc → กลับเป็น asc ก่อนคำนวณ)
  const asc = [...records].reverse();
  let bal = 0;
  const withBalance = asc.map(r => {
    const amt = Number(r.amount) || 0;
    bal += r.type === 'ฝาก' ? amt : -amt;
    return { ...r, balance: bal };
  }).reverse(); // กลับเป็น desc สำหรับแสดง

  const totalIn  = records.filter(r => r.type === 'ฝาก').reduce((s, r) => s + Number(r.amount), 0);
  const totalOut = records.filter(r => r.type === 'ถอน').reduce((s, r) => s + Number(r.amount), 0);
  const current  = totalIn - totalOut;

  return (
    <>
      <ParentTopBar />
      <div className="wrap">
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0 }}>💰 ออมทรัพย์ — {s.name}</h2>
            {loadMs !== null && <span className="timing">⚡ {loadMs} ms</span>}
          </div>

          <div className="row" style={{ marginTop: 14 }}>
            <Box label="ยอดเงินสะสม" value={current} color="#16a34a" big />
            <Box label="รวมฝาก"     value={totalIn}  color="#2563eb" />
            <Box label="รวมถอน"     value={totalOut} color="#dc2626" />
          </div>

          <div style={{ overflowX: 'auto', marginTop: 14 }}>
            <table>
              <thead>
                <tr><th>วันที่</th><th>ปี</th><th>ประเภท</th><th style={{ textAlign: 'right' }}>จำนวนเงิน</th><th style={{ textAlign: 'right' }}>ยอดสะสม</th></tr>
              </thead>
              <tbody>
                {withBalance.map((r, i) => (
                  <tr key={i}>
                    <td>{new Date(r.txn_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', calendar: 'buddhist' })}</td>
                    <td>{r.academic_year}</td>
                    <td>
                      <span style={{
                        padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                        background: r.type === 'ฝาก' ? '#dcfce7' : '#fee2e2',
                        color:      r.type === 'ฝาก' ? '#166534' : '#991b1b',
                      }}>{r.type}</span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: r.type === 'ฝาก' ? '#16a34a' : '#dc2626' }}>
                      {r.type === 'ฝาก' ? '+' : '−'}{Number(r.amount).toLocaleString()}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#1e40af' }}>
                      {r.balance.toLocaleString()}
                    </td>
                  </tr>
                ))}
                {withBalance.length === 0 && (
                  <tr><td colSpan="5" style={{ textAlign: 'center', color: '#94a3b8', padding: 20 }}>— ยังไม่มีรายการ —</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

function Box({ label, value, color, big }) {
  return (
    <div className="card" style={{ margin: 0, textAlign: 'center', padding: 14 }}>
      <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: big ? 34 : 24, fontWeight: 800, color, marginTop: 4 }}>
        {value.toLocaleString()} <span style={{ fontSize: 14, color: '#94a3b8' }}>บาท</span>
      </div>
    </div>
  );
}
