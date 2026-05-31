'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ParentTopBar from '@/components/ParentTopBar';
import { getSession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export default function ParentDashboardPage() {
  const router = useRouter();
  const [s, setS] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const sess = getSession();
    if (!sess) { router.replace('/'); return; }
    if (sess.role !== 'parent') { router.replace('/dashboard'); return; }
    setS(sess);
    loadStats(sess);
  }, [router]);

  async function loadStats(sess) {
    // ดึงสถิติย้อนหลังของลูก
    const [attRes, savRes] = await Promise.all([
      supabase.from('attendance')
        .select('status', { count: 'exact' })
        .eq('school_id', sess.schoolId).eq('student_id', sess.studentId),
      supabase.from('savings')
        .select('amount, type')
        .eq('school_id', sess.schoolId).eq('student_id', sess.studentId),
    ]);

    const attData = attRes.data || [];
    const savData = savRes.data || [];

    const totalSavings = savData.reduce((sum, r) => {
      const amt = Number(r.amount) || 0;
      return sum + (r.type === 'ฝาก' ? amt : -amt);
    }, 0);

    setStats({
      attTotal: attData.length,
      attPresent: attData.filter(r => r.status === 'มา').length,
      attAbsent: attData.filter(r => r.status === 'ขาด').length,
      savBalance: totalSavings,
      savCount: savData.length,
    });
  }

  if (!s) return null;

  const today = new Date().toLocaleDateString('th-TH', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', calendar: 'buddhist',
  });

  return (
    <>
      <ParentTopBar />
      <div className="wrap">
        <div className="card" style={{ background: 'linear-gradient(135deg, #9333ea, #6366f1)', color: '#fff' }}>
          <h2 style={{ color: '#fff', margin: '0 0 4px' }}>👪 ยินดีต้อนรับ ผู้ปกครองของ {s.name}</h2>
          <div style={{ opacity: 0.95, fontSize: 14 }}>
            🎓 ชั้น {s.class}{s.noInClass ? ` เลขที่ ${s.noInClass}` : ''} · เลขประจำตัว {s.studentId}
          </div>
          <div style={{ opacity: 0.85, fontSize: 13, marginTop: 4 }}>{today}</div>
        </div>

        {/* สถิติย้อนหลัง */}
        {stats && (
          <div className="row">
            <StatCard
              label="📝 เช็คชื่อสะสม"
              value={`${stats.attPresent} / ${stats.attTotal}`}
              sub={stats.attAbsent > 0 ? `ขาด ${stats.attAbsent} ครั้ง` : 'ไม่ขาดเรียน'}
              color="#16a34a"
              href="/parent/attendance"
            />
            <StatCard
              label="💰 ยอดเงินออม"
              value={`${stats.savBalance.toLocaleString()} บาท`}
              sub={`${stats.savCount} รายการ`}
              color="#f59e0b"
              href="/parent/savings"
            />
          </div>
        )}

        <div className="card">
          <h2>🎯 เมนูสำหรับผู้ปกครอง</h2>
          <div className="row">
            <MenuItem href="/parent/attendance" icon="📝" title="การมาเรียน" desc="ดูสถิติเช็คชื่อย้อนหลัง" />
            <MenuItem href="/parent/savings"    icon="💰" title="ออมทรัพย์"  desc="ประวัติฝาก-ถอน + ยอดสะสม" />
          </div>

          <div style={{ marginTop: 14, padding: 10, background: '#fef3c7', borderRadius: 8, fontSize: 12, color: '#92400e' }}>
            🚧 <b>กำลังพัฒนา:</b> ผลการเรียน · สุขภาพ · ตารางสอน · ทุน · เกียรติบัตร · ส่งงาน · บันทึกความดี · GPS บ้าน
          </div>
        </div>
      </div>
    </>
  );
}

function StatCard({ label, value, sub, color, href }) {
  return (
    <Link href={href} style={{ flex: 1, minWidth: 200, textDecoration: 'none' }}>
      <div className="card" style={{ textAlign: 'center', margin: 0 }}>
        <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 30, fontWeight: 800, color, marginTop: 4 }}>{value}</div>
        {sub && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{sub}</div>}
      </div>
    </Link>
  );
}

function MenuItem({ href, icon, title, desc }) {
  return (
    <Link href={href} style={{ flex: 1, minWidth: 220, textDecoration: 'none' }}>
      <div style={{
        background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 12,
        padding: 16, cursor: 'pointer', transition: 'transform 0.15s',
      }}>
        <div style={{ fontSize: 32 }}>{icon}</div>
        <div style={{ fontWeight: 700, color: '#1e293b', marginTop: 6 }}>{title}</div>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{desc}</div>
      </div>
    </Link>
  );
}
