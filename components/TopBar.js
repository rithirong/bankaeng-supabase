'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { getSession, logout } from '@/lib/auth';
import { useYear, getYearOptions, getCurrentAcademicYear } from '@/lib/year';

// Nav groups — collapsed in hamburger drawer on small screens
const NAV_GROUPS = [
  {
    label: 'หลัก',
    items: [
      { href: '/students',    icon: '👥', label: 'นักเรียน' },
      { href: '/attendance',  icon: '📋', label: 'เช็คชื่อ' },
      { href: '/health',      icon: '🩺', label: 'สุขภาพ' },
    ],
  },
  {
    label: 'การเงิน',
    items: [
      { href: '/savings', icon: '💰', label: 'ออมทรัพย์' },
      { href: '/coop',    icon: '🛒', label: 'สหกรณ์' },
    ],
  },
  {
    label: 'วิชาการ',
    items: [
      { href: '/timetable',   icon: '📅', label: 'ตารางสอน' },
      { href: '/calendar',    icon: '📆', label: 'ปฏิทิน' },
      { href: '/assignments', icon: '📚', label: 'ส่งงาน' },
      { href: '/grades',      icon: '📊', label: 'ผลการเรียน' },
      { href: '/curriculum',  icon: '📑', label: 'หลักสูตร' },
    ],
  },
  {
    label: 'ประเมิน',
    items: [
      { href: '/eval-attr',       icon: '⭐', label: 'คุณลักษณะ' },
      { href: '/eval-reading',    icon: '📖', label: 'อ่าน-คิด' },
      { href: '/eval-competency', icon: '💡', label: 'สมรรถนะ' },
    ],
  },
  {
    label: 'บันทึก',
    items: [
      { href: '/deeds',         icon: '📒', label: 'ความดี' },
      { href: '/scholarships',  icon: '💸', label: 'ทุน' },
      { href: '/certificates',  icon: '🏆', label: 'เกียรติบัตร' },
      { href: '/trainings',     icon: '🎓', label: 'อบรม' },
      { href: '/documents',     icon: '📝', label: 'สารบรรณ' },
      { href: '/homevisit',     icon: '🏠', label: 'เยี่ยมบ้าน' },
    ],
  },
  {
    label: 'บุคลากร',
    items: [
      { href: '/personnel-info', icon: '👤', label: 'บุคลากร' },
      { href: '/personnel',      icon: '⏱️', label: 'ลงเวลา' },
    ],
  },
  {
    label: 'ปพ.',
    items: [
      { href: '/papol6', icon: '📗', label: 'ปพ.6' },
      { href: '/papol1', icon: '📄', label: 'ปพ.1' },
    ],
  },
];

const ADMIN_ITEMS = [
  { href: '/admin/import',   icon: '📥', label: 'นำเข้า' },
  { href: '/admin/rollover', icon: '🔄', label: 'เลื่อนชั้น' },
  { href: '/admin/settings', icon: '⚙️', label: 'ตั้งค่า' },
];

export default function TopBar() {
  const router   = useRouter();
  const pathname = usePathname();
  const [s, setS]             = useState(null);
  const [year, setYear]       = useYear();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const sess = getSession();
    if (!sess) router.replace('/');
    else if (sess.role === 'parent') router.replace('/parent/dashboard');
    else setS(sess);
  }, [router]);

  // Close drawer on route change
  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  function handleLogout() { logout(); router.replace('/'); }

  if (!s) return null;

  const yearOpts     = getYearOptions();
  const isCurrentYear = year === getCurrentAcademicYear();
  const isAdmin      = s.role === 'admin';

  function isActive(href) {
    return pathname === href || (href !== '/' && pathname.startsWith(href));
  }

  const allGroups = isAdmin
    ? [...NAV_GROUPS, { label: 'จัดการ', items: ADMIN_ITEMS }]
    : NAV_GROUPS;

  // Flatten for quick-access bar (first 6 links)
  const quickLinks = [
    { href: '/students',   icon: '👥', label: 'นักเรียน' },
    { href: '/attendance', icon: '📋', label: 'เช็คชื่อ' },
    { href: '/grades',     icon: '📊', label: 'ผลการเรียน' },
    { href: '/savings',    icon: '💰', label: 'ออมทรัพย์' },
    { href: '/timetable',  icon: '📅', label: 'ตารางสอน' },
    { href: '/health',     icon: '🩺', label: 'สุขภาพ' },
  ];

  return (
    <>
      {/* ── Top Bar ── */}
      <header style={{
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
        padding: '0 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        height: 56,
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 1px 3px rgba(79,70,229,.06)',
      }}>

        {/* Brand */}
        <Link href="/dashboard" style={{
          fontWeight: 800, fontSize: 15,
          color: 'var(--primary)', textDecoration: 'none',
          whiteSpace: 'nowrap', flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          🏫 <span style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {s.school?.name || 'BanKaeng'}
          </span>
        </Link>

        {/* Year pill */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          background: isCurrentYear ? '#EEF2FF' : '#FFFBEB',
          padding: '3px 10px', borderRadius: 'var(--radius-full)',
          border: `1.5px solid ${isCurrentYear ? 'var(--border)' : '#FDE68A'}`,
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 11 }}>📅</span>
          <select
            value={year}
            onChange={e => setYear(parseInt(e.target.value))}
            style={{
              border: 'none', background: 'transparent',
              fontWeight: 700, fontSize: 13, padding: 0, cursor: 'pointer',
              color: isCurrentYear ? 'var(--primary)' : '#92400E',
              width: 'auto', minHeight: 'auto',
            }}
          >
            {yearOpts.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          {!isCurrentYear && (
            <span style={{ fontSize: 10, color: '#92400E', fontWeight: 700 }}>ประวัติ</span>
          )}
        </div>

        {/* Quick-access nav (desktop) */}
        <nav style={{
          display: 'flex', gap: 2, flex: 1,
          overflowX: 'auto', alignItems: 'center',
        }} aria-label="quick nav">
          {quickLinks.map(lk => (
            <Link key={lk.href} href={lk.href} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '5px 9px', borderRadius: 'var(--radius-sm)',
              color: isActive(lk.href) ? 'var(--primary)' : 'var(--muted-foreground)',
              fontWeight: isActive(lk.href) ? 700 : 500,
              fontSize: 13, textDecoration: 'none',
              background: isActive(lk.href) ? 'var(--muted)' : 'transparent',
              borderBottom: isActive(lk.href) ? '2px solid var(--primary)' : '2px solid transparent',
              whiteSpace: 'nowrap',
              transition: 'all var(--transition)',
            }}>
              <span>{lk.icon}</span> {lk.label}
            </Link>
          ))}
        </nav>

        {/* Right: user + hamburger */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, color: 'var(--muted-foreground)', whiteSpace: 'nowrap', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {s.name}
            </span>
            <span className={`badge ${s.role === 'admin' ? 'badge-admin' : 'badge-teacher'}`}>
              {s.role === 'admin' ? 'แอดมิน' : s.class || 'ครู'}
            </span>
          </div>

          <button
            onClick={handleLogout}
            className="ghost sm"
            title="ออกจากระบบ"
            aria-label="ออกจากระบบ"
            style={{ padding: '6px 10px', fontSize: 13 }}
          >
            🚪
          </button>

          {/* Hamburger — all menus */}
          <button
            onClick={() => setDrawerOpen(v => !v)}
            className="outline sm icon-btn"
            aria-label="เมนูทั้งหมด"
            aria-expanded={drawerOpen}
          >
            {drawerOpen ? '✕' : '☰'}
          </button>
        </div>
      </header>

      {/* ── Full-menu Drawer ── */}
      {drawerOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setDrawerOpen(false)}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(15,23,42,.35)',
              backdropFilter: 'blur(2px)',
              zIndex: 200,
              animation: 'fade-in 150ms ease',
            }}
            aria-hidden="true"
          />

          {/* Drawer */}
          <div style={{
            position: 'fixed', top: 56, right: 0,
            width: 280, maxHeight: 'calc(100dvh - 56px)',
            background: 'var(--card)',
            borderLeft: '1px solid var(--border)',
            borderBottom: '1px solid var(--border)',
            borderRadius: '0 0 0 var(--radius-xl)',
            boxShadow: 'var(--shadow-xl)',
            zIndex: 201,
            overflowY: 'auto',
            padding: '12px 0',
            animation: 'slide-from-right 200ms cubic-bezier(.34,1.56,.64,1)',
          }}>
            {allGroups.map(group => (
              <div key={group.label} style={{ marginBottom: 4 }}>
                <div style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '.08em',
                  color: 'var(--muted-foreground)', textTransform: 'uppercase',
                  padding: '8px 16px 4px',
                }}>
                  {group.label}
                </div>
                {group.items.map(item => (
                  <Link
                    key={item.href}
                    href={item.href}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 16px',
                      color: isActive(item.href) ? 'var(--primary)' : 'var(--foreground)',
                      fontWeight: isActive(item.href) ? 700 : 400,
                      fontSize: 14, textDecoration: 'none',
                      background: isActive(item.href) ? 'var(--muted)' : 'transparent',
                      borderLeft: isActive(item.href) ? '3px solid var(--primary)' : '3px solid transparent',
                      transition: 'all var(--transition)',
                    }}
                  >
                    <span style={{ fontSize: 16, width: 24, textAlign: 'center' }}>{item.icon}</span>
                    {item.label}
                  </Link>
                ))}
              </div>
            ))}

            {/* Logout in drawer */}
            <div style={{ borderTop: '1px solid var(--border)', margin: '8px 0' }} />
            <button
              onClick={handleLogout}
              className="danger"
              style={{ margin: '4px 12px', width: 'calc(100% - 24px)' }}
            >
              🚪 ออกจากระบบ
            </button>
          </div>
        </>
      )}

      <style jsx global>{`
        @keyframes slide-from-right {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </>
  );
}
