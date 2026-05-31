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
  const [tab, setTab] = useState('general'); // general | academic | other

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

  const tabStyle = (t) => ({
    padding: '10px 18px', border: 'none', cursor: 'pointer', fontWeight: 700,
    fontSize: 14, borderRadius: 8,
    background: tab === t ? '#1e40af' : 'transparent',
    color: tab === t ? '#fff' : '#475569',
  });

  return (
    <>
      <TopBar />
      <div className="wrap">

        {/* Welcome */}
        <div className="card" style={{ background: 'linear-gradient(135deg, #1e40af, #4f46e5)', color: '#fff', marginBottom: 16 }}>
          <h2 style={{ color: '#fff', margin: '0 0 4px', fontSize: 20 }}>👋 ยินดีต้อนรับ {s.name}</h2>
          <div style={{ opacity: 0.9, fontSize: 14 }}>{todayStr}</div>
          <div style={{ marginTop: 8, opacity: 0.8, fontSize: 13 }}>🏫 {s.school?.name || 'โรงเรียนบ้านแก่ง'}</div>
          {loadMs !== null && <div style={{ marginTop: 6 }}><span className="timing">⚡ {loadMs} ms</span></div>}
        </div>

        {/* Stats */}
        <div className="row" style={{ marginBottom: 16 }}>
          <StatCard label="👥 นักเรียนทั้งหมด" value={stats.students} unit="คน"            color="#16a34a" href="/students" />
          <StatCard label="👨‍🏫 ครู / บุคลากร"  value={stats.teachers} unit="คน"            color="#2563eb" href="/students" />
          <StatCard label="📋 เช็คชื่อวันนี้"   value={stats.todayAtt} unit={`คน (${stats.todayPct}%)`} color="#9333ea" href="/attendance" />
        </div>

        {/* Quick Access */}
        <div className="card">
          <h3 style={{ margin: '0 0 12px', color: '#374151', fontSize: 15 }}>⭐ เมนูใช้บ่อย</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
            <MenuCard href="/attendance"  icon="📋" label="เช็คชื่อ"      bg="#eef2ff" bc="#6366f1" fc="#4338ca" />
            <MenuCard href="/savings"     icon="💰" label="ออมทรัพย์"    bg="#fffbeb" bc="#f59e0b" fc="#b45309" />
            <MenuCard href="/timetable"   icon="📅" label="ตารางสอน"    bg="#f5f3ff" bc="#a78bfa" fc="#6d28d9" />
            <MenuCard href="/calendar"    icon="📆" label="ปฏิทินวิชาการ" bg="#eff6ff" bc="#3b82f6" fc="#1d4ed8" />
          </div>
        </div>

        {/* Tab เมนูหลัก */}
        <div className="card">
          <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', padding: 4, borderRadius: 10, marginBottom: 14 }}>
            <button style={tabStyle('general')}  onClick={() => setTab('general')}>🏫 งานทั่วไป</button>
            <button style={tabStyle('academic')} onClick={() => setTab('academic')}>📚 วิชาการ</button>
            <button style={tabStyle('other')}    onClick={() => setTab('other')}>🗂️ อื่นๆ</button>
          </div>

          {/* Tab 1: งานทั่วไป */}
          {tab === 'general' && (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 8, marginTop: 4 }}>👧 นักเรียน</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10, marginBottom: 18 }}>
                <MenuCard href="/students"    icon="👤" label="ข้อมูลนักเรียน" bg="#ecfeff" bc="#22d3ee" fc="#0e7490" />
                <MenuCard href="/attendance"  icon="📋" label="เช็คชื่อ"       bg="#eef2ff" bc="#6366f1" fc="#4338ca" />
                <MenuCard href="/health"      icon="🩺" label="น้ำหนัก-ส่วนสูง" bg="#fef2f2" bc="#f87171" fc="#b91c1c" />
                <MenuCard href="/savings"     icon="💰" label="ออมทรัพย์"     bg="#fffbeb" bc="#f59e0b" fc="#b45309" />
                <MenuCard href="/coop"        icon="🛒" label="สหกรณ์ร้านค้า" bg="#ecfdf5" bc="#10b981" fc="#065f46" />
                <MenuCard href="/homevisit"   icon="🏠" label="เยี่ยมบ้าน"   bg="#fff7ed" bc="#f97316" fc="#c2410c" />
              </div>
            </>
          )}

          {/* Tab 2: วิชาการ */}
          {tab === 'academic' && (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 8, marginTop: 4 }}>📚 การเรียนการสอน</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10, marginBottom: 18 }}>
                <MenuCard href="/timetable"   icon="📅" label="ตารางสอน"     bg="#f5f3ff" bc="#a78bfa" fc="#6d28d9" />
                <MenuCard href="/calendar"    icon="📆" label="ปฏิทินวิชาการ" bg="#eff6ff" bc="#3b82f6" fc="#1d4ed8" />
                <MenuCard href="/grades"      icon="📊" label="ผลการเรียน"    bg="#f0fdf4" bc="#4ade80" fc="#15803d" />
                <MenuCard href="/assignments" icon="📚" label="ส่งงาน/การบ้าน" bg="#fdf4ff" bc="#e879f9" fc="#86198f" />
                <MenuCard href="/curriculum" icon="📑" label="จัดการหลักสูตร" bg="#f0fdfa" bc="#2dd4bf" fc="#0f766e" />
                <MenuCard href="/eval-attr"        icon="⭐" label="คุณลักษณะ"    bg="#fefce8" bc="#facc15" fc="#a16207" />
                <MenuCard href="/eval-reading"     icon="📖" label="อ่าน-คิดวิเคราะห์" bg="#fff1f2" bc="#fb7185" fc="#be123c" />
                <MenuCard href="/eval-competency"  icon="💡" label="สมรรถนะ"     bg="#f3e8ff" bc="#a855f7" fc="#6b21a8" />
                <MenuCard href="/papol6"  icon="📗" label="ระบบ ปพ.6"     bg="#ecfdf5" bc="#34d399" fc="#047857" />
                <MenuCard href="/papol1"  icon="📄" label="ทะเบียนคุม ปพ.1" bg="#f8fafc" bc="#94a3b8" fc="#475569" />
              </div>
            </>
          )}

          {/* Tab 3: อื่นๆ */}
          {tab === 'other' && (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 8, marginTop: 4 }}>🏆 ผลงาน & เอกสาร</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10, marginBottom: 18 }}>
                <MenuCard href="/certificates" icon="🏆" label="เกียรติบัตร"     bg="#fffbeb" bc="#fbbf24" fc="#b45309" />
                <MenuCard href="/trainings"    icon="🎓" label="วุฒิบัตรอบรม"   bg="#fff7ed" bc="#fb923c" fc="#c2410c" />
                <MenuCard href="/scholarships" icon="💸" label="ทุนการศึกษา"    bg="#f0fdf4" bc="#4ade80" fc="#15803d" />
                <MenuCard href="/documents"    icon="📝" label="งานสารบรรณ"    bg="#f1f5f9" bc="#64748b" fc="#334155" />
                <MenuCard href="/deeds"        icon="📖" label="สมุดบันทึกความดี" bg="#faf5ff" bc="#e9d5ff" fc="#7c3aed" />
              </div>
            </>
          )}
        </div>

        {/* Admin */}
        {s.role === 'admin' && (
          <div className="card">
            <h3 style={{ margin: '0 0 12px', color: '#374151', fontSize: 15 }}>⚙️ ผู้ดูแลระบบ</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
              <MenuCard href="/admin/import"    icon="📥" label="นำเข้าข้อมูล"   bg="#fef2f2" bc="#fca5a5" fc="#dc2626" />
              <MenuCard href="/admin/rollover"  icon="🔄" label="เลื่อนชั้น"     bg="#faf5ff" bc="#c084fc" fc="#9333ea" />
              <MenuCard href="/personnel-info"  icon="👤" label="ข้อมูลบุคลากร"  bg="#f0f9ff" bc="#7dd3fc" fc="#0369a1" />
              <MenuCard href="/personnel"       icon="⏱️" label="ลงเวลา/การลา"  bg="#f0fdf4" bc="#86efac" fc="#166534" />
              <MenuCard href="/admin/settings"  icon="⚙️" label="ตั้งค่าระบบ"   bg="#fff3cd" bc="#fcd34d" fc="#b45309" />
            </div>
          </div>
        )}

      </div>
    </>
  );
}

function StatCard({ label, value, unit, color, href }) {
  return (
    <Link href={href} style={{ flex: 1, minWidth: 160, textDecoration: 'none' }}>
      <div className="card" style={{ textAlign: 'center', margin: 0 }}>
        <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 34, fontWeight: 800, color, marginTop: 4, lineHeight: 1 }}>{value}</div>
        {unit && <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 2 }}>{unit}</div>}
      </div>
    </Link>
  );
}

function MenuCard({ href, icon, label, bg, bc, fc, soon }) {
  const content = (
    <div style={{
      background: soon ? '#f8fafc' : bg,
      border: `1px solid ${soon ? '#e2e8f0' : bc}`,
      borderRadius: 12, padding: '14px 8px',
      textAlign: 'center', cursor: soon ? 'default' : 'pointer',
      opacity: soon ? 0.6 : 1,
      transition: 'transform 0.1s, box-shadow 0.1s',
      position: 'relative',
    }}
      onMouseEnter={e => { if (!soon) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; }}}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
    >
      <div style={{ fontSize: 26, lineHeight: 1 }}>{icon}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: soon ? '#94a3b8' : fc, marginTop: 6, lineHeight: 1.3 }}>{label}</div>
      {soon && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>เร็วๆนี้</div>}
    </div>
  );
  if (soon) return <div>{content}</div>;
  return <Link href={href} style={{ textDecoration: 'none' }}>{content}</Link>;
}
