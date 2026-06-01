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
  const [s, setS]       = useState(null);
  const [year]          = useYear();
  const [stats, setStats] = useState({ students: 0, teachers: 0, todayAtt: 0, todayPct: 0 });
  const [loadMs, setLoadMs] = useState(null);
  const [tab, setTab]   = useState('general');

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
    const total   = stu.count || 0;
    const checked = att.count || 0;
    setStats({
      students: total, teachers: tch.count || 0,
      todayAtt: checked, todayPct: total > 0 ? Math.round(checked / total * 100) : 0,
    });
    setLoadMs(Math.round(performance.now() - t0));
  }

  if (!s) return null;

  const todayStr = new Date().toLocaleDateString('th-TH', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <>
      <TopBar />
      <div className="wrap">

        {/* ── Welcome Banner ── */}
        <div style={{
          background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
          borderRadius: 'var(--radius-xl)',
          padding: '20px 24px',
          color: '#fff',
          marginBottom: 16,
          boxShadow: '0 6px 20px rgba(79,70,229,.25)',
        }}>
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>
            👋 ยินดีต้อนรับ {s.name}
          </div>
          <div style={{ opacity: .85, fontSize: 14 }}>{todayStr}</div>
          <div style={{ opacity: .75, fontSize: 13, marginTop: 4 }}>
            🏫 {s.school?.name || 'โรงเรียนบ้านแก่ง'}
          </div>
          {loadMs !== null && (
            <div style={{ marginTop: 8 }}>
              <span className="timing" style={{ background: 'rgba(255,255,255,.15)', color: '#fff', borderColor: 'rgba(255,255,255,.3)' }}>
                ⚡ โหลด {loadMs} ms
              </span>
            </div>
          )}
        </div>

        {/* ── Stats row ── */}
        <div className="row" style={{ marginBottom: 16 }}>
          <StatCard label="👥 นักเรียน" value={stats.students}  unit="คน" color="var(--success)"     href="/students" />
          <StatCard label="👨‍🏫 บุคลากร"  value={stats.teachers}  unit="คน" color="var(--primary)"    href="/personnel-info" />
          <StatCard label="📋 มาวันนี้"  value={stats.todayAtt} unit={`คน · ${stats.todayPct}%`} color="#9333EA" href="/attendance" />
        </div>

        {/* ── Quick Access ── */}
        <div className="card" style={{ marginBottom: 14 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>⭐ เมนูใช้บ่อย</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10 }}>
            <MenuCard href="/attendance"  icon="📋" label="เช็คชื่อ"      bg="#EEF2FF" bc="var(--border)"       fc="var(--primary)" />
            <MenuCard href="/savings"     icon="💰" label="ออมทรัพย์"    bg="#FFFBEB" bc="#FDE68A"              fc="#B45309" />
            <MenuCard href="/timetable"   icon="📅" label="ตารางสอน"    bg="#F5F3FF" bc="#A78BFA"              fc="#6D28D9" />
            <MenuCard href="/calendar"    icon="📆" label="ปฏิทิน"       bg="#EFF6FF" bc="#BFDBFE"              fc="#1D4ED8" />
          </div>
        </div>

        {/* ── Tab เมนูหลัก ── */}
        <div className="card">
          <div className="tab-bar">
            <button className={`tab-btn${tab === 'general'  ? ' active' : ''}`} onClick={() => setTab('general')}>🏫 ทั่วไป</button>
            <button className={`tab-btn${tab === 'academic' ? ' active' : ''}`} onClick={() => setTab('academic')}>📚 วิชาการ</button>
            <button className={`tab-btn${tab === 'other'    ? ' active' : ''}`} onClick={() => setTab('other')}>🗂️ อื่นๆ</button>
          </div>

          {tab === 'general' && (
            <>
              <SectionLabel icon="👤" label="บุคลากร" />
              <MenuGrid>
                <MenuCard href="/personnel-info" icon="🧑‍💼" label="ข้อมูลบุคลากร"  bg="#F0F9FF" bc="#BAE6FD" fc="#0369A1" />
                <MenuCard href="/personnel"      icon="⏱️" label="ลงเวลา/การลา"   bg="#F0FDF4" bc="#BBF7D0" fc="#166534" />
              </MenuGrid>

              <SectionLabel icon="👧" label="นักเรียน" />
              <MenuGrid>
                <MenuCard href="/students"    icon="👤" label="ข้อมูลนักเรียน"  bg="#ECFEFF" bc="#A5F3FC" fc="#0E7490" />
                <MenuCard href="/attendance"  icon="📋" label="เช็คชื่อ"         bg="#EEF2FF" bc="var(--border)"  fc="var(--primary)" />
                <MenuCard href="/health"      icon="🩺" label="สุขภาพ"           bg="#FEF2F2" bc="#FECACA" fc="#B91C1C" />
                <MenuCard href="/savings"     icon="💰" label="ออมทรัพย์"       bg="#FFFBEB" bc="#FDE68A" fc="#B45309" />
                <MenuCard href="/assignments" icon="📚" label="ส่งงาน"           bg="#FDF4FF" bc="#E879F9" fc="#86198F" />
                <MenuCard href="/coop"        icon="🛒" label="สหกรณ์"          bg="#ECFDF5" bc="#6EE7B7" fc="#065F46" />
                <MenuCard href="/homevisit"   icon="🏠" label="เยี่ยมบ้าน"      bg="#FFF7ED" bc="#FED7AA" fc="#C2410C" />
              </MenuGrid>
            </>
          )}

          {tab === 'academic' && (
            <>
              <SectionLabel icon="📚" label="การเรียนการสอน" />
              <MenuGrid>
                <MenuCard href="/curriculum"      icon="📑" label="หลักสูตร"          bg="#F0FDFA" bc="#99F6E4" fc="#0F766E" />
                <MenuCard href="/timetable"       icon="📅" label="ตารางสอน"         bg="#F5F3FF" bc="#A78BFA" fc="#6D28D9" />
                <MenuCard href="/grades"          icon="📊" label="ผลการเรียน"       bg="#F0FDF4" bc="#BBF7D0" fc="#15803D" />
                <MenuCard href="/calendar"        icon="📆" label="ปฏิทิน"            bg="#EFF6FF" bc="#BFDBFE" fc="#1D4ED8" />
                <MenuCard href="/eval-attr"       icon="⭐" label="คุณลักษณะ"        bg="#FEFCE8" bc="#FDE047" fc="#A16207" />
                <MenuCard href="/eval-reading"    icon="📖" label="อ่าน-คิดวิเคราะห์" bg="#FFF1F2" bc="#FCA5A5" fc="#BE123C" />
                <MenuCard href="/eval-competency" icon="💡" label="สมรรถนะ"          bg="#F3E8FF" bc="#D8B4FE" fc="#6B21A8" />
                <MenuCard href="/papol6"          icon="📗" label="ปพ.6"              bg="#ECFDF5" bc="#6EE7B7" fc="#047857" />
                <MenuCard href="/papol7"          icon="📋" label="ปพ.7"              bg="#FEFCE8" bc="#FDE047" fc="#713F12" />
                <MenuCard href="/papol1"          icon="📄" label="ปพ.1"              bg="#F8FAFC" bc="var(--border)"   fc="var(--muted-foreground)" />
              </MenuGrid>
            </>
          )}

          {tab === 'other' && (
            <>
              <SectionLabel icon="🏆" label="ผลงาน & เอกสาร" />
              <MenuGrid>
                <MenuCard href="/certificates" icon="🏆" label="เกียรติบัตร"   bg="#FFFBEB" bc="#FDE68A" fc="#B45309" />
                <MenuCard href="/trainings"    icon="🎓" label="วุฒิบัตร"     bg="#FFF7ED" bc="#FED7AA" fc="#C2410C" />
                <MenuCard href="/scholarships" icon="💸" label="ทุนการศึกษา" bg="#F0FDF4" bc="#BBF7D0" fc="#15803D" />
                <MenuCard href="/documents"    icon="📝" label="สารบรรณ"     bg="#F1F5F9" bc="var(--border)"   fc="var(--muted-foreground)" />
              </MenuGrid>
              <SectionLabel icon="📖" label="คุณธรรม" />
              <MenuGrid>
                <MenuCard href="/deeds" icon="📒" label="บันทึกความดี" bg="#FAF5FF" bc="#DDD6FE" fc="#7C3AED" />
              </MenuGrid>
            </>
          )}
        </div>

        {/* ── Admin ── */}
        {s.role === 'admin' && (
          <div className="card">
            <h3 style={{ margin: '0 0 12px', fontSize: 15, color: 'var(--destructive)' }}>⚙️ ผู้ดูแลระบบ</h3>
            <MenuGrid>
              <MenuCard href="/admin/import"   icon="📥" label="นำเข้าข้อมูล" bg="#FEF2F2" bc="#FECACA" fc="#DC2626" />
              <MenuCard href="/admin/rollover" icon="🔄" label="เลื่อนชั้น"   bg="#FAF5FF" bc="#DDD6FE" fc="#9333EA" />
              <MenuCard href="/admin/settings" icon="⚙️" label="ตั้งค่าระบบ"  bg="#FFFBEB" bc="#FDE68A" fc="#B45309" />
            </MenuGrid>
          </div>
        )}

      </div>
    </>
  );
}

function SectionLabel({ icon, label }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', marginBottom: 8, marginTop: 6, display: 'flex', alignItems: 'center', gap: 5, textTransform: 'uppercase', letterSpacing: '.04em' }}>
      {icon} {label}
    </div>
  );
}

function MenuGrid({ children }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10, marginBottom: 14 }}>
      {children}
    </div>
  );
}

function StatCard({ label, value, unit, color, href }) {
  return (
    <Link href={href} style={{ flex: 1, minWidth: 150, textDecoration: 'none' }}>
      <div className="stat-card">
        <div style={{ fontSize: 12, color: 'var(--muted-foreground)', fontWeight: 600, marginBottom: 6 }}>{label}</div>
        <div className="stat-number" style={{ color }}>{value}</div>
        {unit && <div className="stat-label">{unit}</div>}
      </div>
    </Link>
  );
}

function MenuCard({ href, icon, label, bg, bc, fc }) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <div style={{
        background: bg,
        border: `1.5px solid ${bc}`,
        borderRadius: 'var(--radius-lg)',
        padding: '14px 8px',
        textAlign: 'center',
        cursor: 'pointer',
        transition: 'transform var(--transition-md), box-shadow var(--transition-md)',
      }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'translateY(-3px)';
          e.currentTarget.style.boxShadow = 'var(--shadow-md)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = '';
          e.currentTarget.style.boxShadow = '';
        }}
      >
        <div style={{ fontSize: 28, lineHeight: 1 }}>{icon}</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: fc, marginTop: 7, lineHeight: 1.3 }}>{label}</div>
      </div>
    </Link>
  );
}
