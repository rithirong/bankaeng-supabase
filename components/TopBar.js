'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSession, logout } from '@/lib/auth';
import { useYear, getYearOptions, getCurrentAcademicYear } from '@/lib/year';

export default function TopBar() {
  const router = useRouter();
  const [s, setS] = useState(null);
  const [year, setYear] = useYear();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const sess = getSession();
    if (!sess) router.replace('/');
    else if (sess.role === 'parent') router.replace('/parent/dashboard');
    else setS(sess);
  }, [router]);

  function handleLogout() { logout(); router.replace('/'); }

  if (!s) return null;

  const yearOpts = getYearOptions();
  const isCurrentYear = year === getCurrentAcademicYear();
  const isAdmin = s.role === 'admin';

  const navLink = {
    padding: '6px 10px', borderRadius: 8, color: '#334155',
    fontWeight: 600, fontSize: 13, textDecoration: 'none',
    whiteSpace: 'nowrap',
  };

  return (
    <div style={{
      background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '10px 20px',
      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)', position: 'sticky', top: 0, zIndex: 100,
    }}>
      <Link href="/dashboard" style={{ fontWeight: 700, color: '#1e40af', fontSize: 15, textDecoration: 'none', whiteSpace: 'nowrap' }}>
        🏫 {s.school?.name || 'BanKaeng'}
      </Link>

      {/* ปีการศึกษา */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 5,
        background: isCurrentYear ? '#dbeafe' : '#fef3c7',
        padding: '4px 10px', borderRadius: 999,
        border: `1px solid ${isCurrentYear ? '#93c5fd' : '#fcd34d'}`,
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: isCurrentYear ? '#1e40af' : '#92400e' }}>📅</span>
        <select value={year} onChange={e => setYear(parseInt(e.target.value))}
          style={{ border: 'none', background: 'transparent', fontWeight: 700, fontSize: 13,
            padding: '1px 2px', cursor: 'pointer', color: isCurrentYear ? '#1e40af' : '#92400e' }}>
          {yearOpts.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        {!isCurrentYear && <span style={{ fontSize: 10, color: '#92400e', fontWeight: 700 }}>(ประวัติ)</span>}
      </div>

      {/* Navigation */}
      <nav style={{ display: 'flex', gap: 2, flex: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        <Link href="/students"    style={navLink}>👥 นักเรียน</Link>
        <Link href="/attendance"  style={navLink}>📋 เช็คชื่อ</Link>
        <Link href="/health"      style={navLink}>🩺 สุขภาพ</Link>
        <Link href="/savings"     style={navLink}>💰 ออมทรัพย์</Link>
        <Link href="/coop"        style={navLink}>🛒 สหกรณ์</Link>
        <Link href="/homevisit"   style={navLink}>🏠 เยี่ยมบ้าน</Link>
        <Link href="/timetable"   style={navLink}>📅 ตารางสอน</Link>
        <Link href="/calendar"    style={navLink}>📆 ปฏิทิน</Link>
        <Link href="/assignments" style={navLink}>📚 ส่งงาน</Link>
        <Link href="/grades"      style={navLink}>📊 ผลการเรียน</Link>
        {isAdmin && (
          <>
            <Link href="/admin/import"   style={{ ...navLink, color: '#dc2626' }}>⚙️ นำเข้า</Link>
            <Link href="/admin/rollover" style={{ ...navLink, color: '#9333ea' }}>🔄 เลื่อนชั้น</Link>
          </>
        )}
      </nav>

      {/* User info + logout */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span style={{ fontSize: 13, color: '#475569', whiteSpace: 'nowrap' }}>
          {s.name}{' '}
          <span className={s.role === 'admin' ? 'badge badge-admin' : 'badge badge-teacher'}>
            {s.role === 'admin' ? 'แอดมิน' : s.class}
          </span>
        </span>
        <button className="secondary" onClick={handleLogout} style={{ padding: '6px 12px', fontSize: 13 }}>
          🚪 ออก
        </button>
      </div>
    </div>
  );
}
