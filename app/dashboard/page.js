'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import TopBar from '@/components/TopBar';
import { getSession } from '@/lib/auth';
import { useYear } from '@/lib/year';
import { supabase } from '@/lib/supabase';

export default function DashboardPage() {
  const router = useRouter();
  const [s, setS] = useState(null);
  const [year] = useYear();
  const [stats, setStats] = useState({ students: 0, teachers: 0, todayAtt: 0, todayPct: 0 });
  const [loadMs, setLoadMs] = useState(null);

  useEffect(() => {
    const sess = getSession();
    if (!sess) { router.replace('/'); return; }
    if (sess.role === 'parent') { router.replace('/parent/dashboard'); return; }
    setS(sess);
    loadStats(sess);
  }, [router]);

  async function loadStats(sess) {
    const t0 = performance.now();
    const today = new Date().toISOString().slice(0, 10);
    const [stu, tch, att] = await Promise.all([
      supabase.from('students').select('*', { count: 'exact', head: true }).eq('school_id', sess.schoolId),
      supabase.from('teachers').select('*', { count: 'exact', head: true }).eq('school_id', sess.schoolId).eq('hidden', false),
      supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('school_id', sess.schoolId).eq('attendance_date', today),
    ]);
    const total = stu.count || 0;
    const checked = att.count || 0;
    setStats({ students: total, teachers: tch.count || 0, todayAtt: checked, todayPct: total > 0 ? Math.round(checked / total * 100) : 0 });
    setLoadMs(Math.round(performance.now() - t0));
  }

  if (!s) return null;

  const todayStr = new Date().toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <>
      <TopBar />
      <div className="wrap">

        {/* Welcome card */}
        <div className="card" style={{ background: 'linear-gradient(135deg, #1e40af, #4f46e5)', color: '#fff', marginBottom: 16 }}>
          <h2 style={{ color: '#fff', margin: '0 0 4px', fontSize: 20 }}>👋 ยินดีต้อนรับ {s.name}</h2>
          <div style={{ opacity: 0.9, fontSize: 14 }}>{todayStr}</div>
          <div style={{ marginTop: 8, opacity: 0.8, fontSize: 13 }}>🏫 {s.school?.name}</div>
          {loadMs !== null && <div style={{ marginTop: 8 }}><span className="timing">⚡ {loadMs} ms</span></div>}
        </div>

        {/* Stats */}
        <div className="row" style={{ marginBottom: 16 }}>
          <StatCard label="👥 นักเรียนทั้งหมด" value={stats.students} unit="คน" color="#16a34a" href="/students" />
          <StatCard label="👨‍🏫 ครู / บุคลากร"  value={stats.teachers} unit="คน" color="#2563eb" href="/students" />
          <StatCard label="📋 เช็คชื่อวันนี้"   value={stats.todayAtt} unit={`คน (${stats.todayPct}%)`} color="#9333ea" href="/attendance" />
        </div>

        {/* Quick access */}
        <div className="card">
          <h3 style={{ margin: '0 0 12px', color: '#374151', fontSize: 15 }}>⭐ เมนูใช้บ่อย</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
            <MenuCard href="/attendance"  icon="📋" label="เช็คชื่อ"      bg="#eef2ff" bc="#6366f1" fc="#4338ca" />
            <MenuCard href="/savings"     icon="💰" label="ออมทรัพย์"    bg="#fffbeb" bc="#f59e0b" fc="#b45309" />
            <MenuCard href="/timetable"   icon="📅" label="ตารางสอน"    bg="#f5f3ff" bc="#a78bfa" fc="#6d28d9" />
            <MenuCard href="/calendar"    icon="📆" label="ปฏิทิน"       bg="#eff6ff" bc="#3b82f6" fc="#1d4ed8" />
          </div>
        </div>

        {/* นักเรียน */}
        <div className="card">
          <h3 style={{ margin: '0 0 12px', color: '#374151', fontSize: 15 }}>👧 ข้อมูลนักเรียน</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
            <MenuCard href="/students"    icon="👤" label="ข้อมูลนักเรียน" bg="#ecfeff" bc="#22d3ee" fc="#0e7490" />
            <MenuCard href="/attendance"  icon="📋" label="เช็คชื่อ"       bg="#eef2ff" bc="#6366f1" fc="#4338ca" />
            <MenuCard href="/savings"     icon="💰" label="ออมทรัพย์"     bg="#fffbeb" bc="#f59e0b" fc="#b45309" />
            <MenuCard href="/coop"        icon="🛒" label="สหกรณ์ร้านค้า" bg="#ecfdf5" bc="#10b981" fc="#065f46" />
          </div>
        </div>

        {/* วิชาการ */}
        <div className="card">
          <h3 style={{ margin: '0 0 12px', color: '#374151', fontSize: 15 }}>📚 วิชาการ</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
            <MenuCard href="/timetable"   icon="📅" label="ตารางสอน"     bg="#f5f3ff" bc="#a78bfa" fc="#6d28d9" />
            <MenuCard href="/calendar"    icon="📆" label="ปฏิทินวิชาการ" bg="#eff6ff" bc="#3b82f6" fc="#1d4ed8" />
            <MenuCard href="/assignments" icon="📚" label="ส่งงาน/การบ้าน" bg="#fdf4ff" bc="#e879f9" fc="#86198f" />
            <MenuCard href="/grades"      icon="📊" label="ผลการเรียน"    bg="#fef2f2" bc="#f87171" fc="#b91c1c" />
          </div>
        </div>

        {/* Admin */}
        {s.role === 'admin' && (
          <div className="card">
            <h3 style={{ margin: '0 0 12px', color: '#374151', fontSize: 15 }}>⚙️ ผู้ดูแลระบบ</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
              <MenuCard href="/admin/import"   icon="📥" label="นำเข้าข้อมูล"   bg="#fef2f2" bc="#fca5a5" fc="#dc2626" />
              <MenuCard href="/admin/rollover" icon="🔄" label="เลื่อนชั้น"     bg="#faf5ff" bc="#c084fc" fc="#9333ea" />
            </div>
          </div>
        )}

      </div>
    </>
  );
}

function StatCard({ label, value, unit, color, href }) {
  return (
    <Link href={href} style={{ flex: 1, minWidth: 180, textDecoration: 'none' }}>
      <div className="card" style={{ textAlign: 'center', margin: 0 }}>
        <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 34, fontWeight: 800, color, marginTop: 4, lineHeight: 1 }}>{value}</div>
        {unit && <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 2 }}>{unit}</div>}
      </div>
    </Link>
  );
}

function MenuCard({ href, icon, label, bg, bc, fc }) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <div style={{
        background: bg, border: `1px solid ${bc}`,
        borderRadius: 12, padding: '14px 10px',
        textAlign: 'center', cursor: 'pointer',
        transition: 'transform 0.1s, box-shadow 0.1s',
      }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
      >
        <div style={{ fontSize: 28, lineHeight: 1 }}>{icon}</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: fc, marginTop: 6, lineHeight: 1.3 }}>{label}</div>
      </div>
    </Link>
  );
}
