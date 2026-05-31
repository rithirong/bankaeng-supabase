'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { login, loginParent, getSession } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState('teacher'); // 'teacher' | 'parent'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // ถ้า login อยู่แล้วเด้งไป dashboard ที่ตรง role
  useEffect(() => {
    const s = getSession();
    if (s) router.replace(s.role === 'parent' ? '/parent/dashboard' : '/dashboard');
  }, [router]);

  function pickTab(t) {
    setTab(t);
    setUsername(''); setPassword(''); setMsg('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!username || !password) return setMsg('⚠️ กรุณากรอกข้อมูลให้ครบ');
    setLoading(true);
    setMsg('');
    try {
      const t0 = performance.now();
      const res = tab === 'parent'
        ? await loginParent(username, password)
        : await login(username, password);
      const ms = Math.round(performance.now() - t0);
      if (res.success) {
        setMsg(`✅ เข้าสู่ระบบใน ${ms} ms`);
        setTimeout(() => router.push(tab === 'parent' ? '/parent/dashboard' : '/dashboard'), 200);
      } else {
        setMsg('❌ ' + res.message);
      }
    } catch (e) {
      setMsg('❌ ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  const isParent = tab === 'parent';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="card" style={{ width: '100%', maxWidth: 440 }}>
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 48 }}>🏫</div>
          <h1 style={{ margin: '8px 0 4px', color: '#1e40af' }}>BanKaeng System</h1>
          <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>Next.js + Supabase Edition</p>
        </div>

        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: '#f1f5f9', padding: 4, borderRadius: 10 }}>
          <button type="button" onClick={() => pickTab('teacher')} style={tabBtn(tab === 'teacher')}>
            👨‍🏫 ครู / แอดมิน
          </button>
          <button type="button" onClick={() => pickTab('parent')} style={tabBtn(tab === 'parent')}>
            👪 ผู้ปกครอง
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 600 }}>
              {isParent ? '👶 เลขประจำตัวนักเรียน' : '👤 รหัสผู้ใช้งาน'}
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={isParent ? 'เช่น 4665' : 'admin หรือ teacher1'}
              autoComplete={isParent ? 'off' : 'username'}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600 }}>
              {isParent ? '🎂 วันเกิด 8 หลัก (DDMMYYYY ปีพุทธ)' : '🔒 รหัสผ่าน'}
            </label>
            <input
              type={isParent ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isParent ? 'เช่น 09092560' : 'รหัสผ่าน'}
              autoComplete={isParent ? 'off' : 'current-password'}
              inputMode={isParent ? 'numeric' : 'text'}
              maxLength={isParent ? 10 : undefined}
            />
          </div>
          <button type="submit" disabled={loading} style={{ width: '100%' }}>
            {loading ? '⏳ กำลังเข้าสู่ระบบ...' : '🚪 เข้าสู่ระบบ'}
          </button>
        </form>

        {msg && (
          <div style={{
            marginTop: 14, padding: '10px 14px', borderRadius: 8,
            background: msg.startsWith('✅') ? '#dcfce7' : '#fee2e2',
            color: msg.startsWith('✅') ? '#166534' : '#991b1b',
            fontSize: 14, textAlign: 'center', fontWeight: 600,
          }}>{msg}</div>
        )}

        <div style={{ marginTop: 20, padding: 12, background: '#f1f5f9', borderRadius: 8, fontSize: 12, color: '#475569' }}>
          {isParent ? (
            <>
              <b>👪 ผู้ปกครอง:</b><br />
              • ใช้เลขประจำตัวนักเรียน 4 หลัก<br />
              • วันเกิดในรูปแบบ <b>DDMMYYYY</b> ปีพุทธ เช่น <b>09092560</b> = 9 ก.ย. 2560
            </>
          ) : (
            <>
              <b>🧪 ทดสอบ:</b><br />
              • admin / admin123<br />
              • teacher1 / pass1234
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function tabBtn(active) {
  return {
    flex: 1,
    padding: '10px 14px',
    background: active ? '#fff' : 'transparent',
    color: active ? '#1e40af' : '#64748b',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
  };
}
