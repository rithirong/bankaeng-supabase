'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSession, logout } from '@/lib/auth';

export default function ParentTopBar() {
  const router = useRouter();
  const [s, setS] = useState(null);

  useEffect(() => {
    const sess = getSession();
    if (!sess) { router.replace('/'); return; }
    if (sess.role !== 'parent') { router.replace('/dashboard'); return; }
    setS(sess);
  }, [router]);

  function handleLogout() { logout(); router.replace('/'); }
  if (!s) return null;

  const navLink = { padding: '6px 12px', borderRadius: 8, color: '#334155', fontWeight: 600, fontSize: 13 };

  return (
    <div style={{
      background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '10px 20px',
      display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <Link href="/parent/dashboard" style={{ fontWeight: 700, color: '#9333ea', fontSize: 16 }}>
        👪 {s.school?.name || 'BanKaeng'}
      </Link>

      <nav style={{ display: 'flex', gap: 4, flex: 1, flexWrap: 'wrap' }}>
        <Link href="/parent/attendance" style={navLink}>📝 เช็คชื่อ</Link>
        <Link href="/parent/savings" style={navLink}>💰 ออมทรัพย์</Link>
      </nav>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 13, color: '#475569' }}>
          {s.name}{' '}
          <span style={{
            display: 'inline-block', padding: '2px 8px', borderRadius: 999,
            fontSize: 11, fontWeight: 700, background: '#f3e8ff', color: '#7e22ce',
          }}>{s.class}</span>
        </span>
        <button className="secondary" onClick={handleLogout} style={{ padding: '6px 12px', fontSize: 13 }}>
          🚪 ออก
        </button>
      </div>
    </div>
  );
}
