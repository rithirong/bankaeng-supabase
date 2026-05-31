'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { getSession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export default function CoopPage() {
  const router = useRouter();
  const [s, setS] = useState(null);
  const [tab, setTab] = useState('entries');

  useEffect(() => {
    const sess = getSession();
    if (!sess || sess.role === 'parent') { router.replace('/'); return; }
    setS(sess);
  }, [router]);

  if (!s) return null;

  return (
    <>
      <TopBar />
      <div className="wrap">
        <div className="card">
          <h2 style={{ margin: '0 0 14px' }}>🛒 สหกรณ์ร้านค้า</h2>

          <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', padding: 4, borderRadius: 10, marginBottom: 14 }}>
            <TabBtn active={tab === 'entries'}   onClick={() => setTab('entries')}>📝 รายการ</TabBtn>
            <TabBtn active={tab === 'dashboard'} onClick={() => setTab('dashboard')}>📊 สรุปรายวัน</TabBtn>
          </div>

          {tab === 'entries'   && <EntriesTab session={s} />}
          {tab === 'dashboard' && <DashboardTab session={s} />}
        </div>
      </div>
    </>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button type="button" onClick={onClick} style={{
      flex: 1, padding: '10px 14px', border: 'none',
      background: active ? '#fff' : 'transparent',
      color: active ? '#1e40af' : '#64748b',
      borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer',
      boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
    }}>{children}</button>
  );
}

// ────────────────────────────────────────
// TAB 1: รายการ (entries by date)
// ────────────────────────────────────────
function EntriesTab({ session }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadMs, setLoadMs] = useState(null);
  const [editing, setEditing] = useState(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (session) load();
  }, [session, date]);

  async function load() {
    setLoading(true);
    const t0 = performance.now();
    const { data, error } = await supabase
      .from('coop_entries')
      .select('*')
      .eq('school_id', session.schoolId)
      .eq('entry_date', date)
      .order('created_at');
    setLoadMs(Math.round(performance.now() - t0));
    setLoading(false);
    setLoaded(true);
    if (error) { alert('❌ ' + error.message); return; }
    setEntries(data || []);
  }

  function showToast(m) { setToast(m); setTimeout(() => setToast(''), 2000); }

  async function save(form) {
    const payload = {
      school_id: session.schoolId,
      entry_date: form.entry_date,
      type: form.type,
      category: form.category || null,
      description: form.description || null,
      amount: parseFloat(form.amount),
      receipt_url: form.receipt_url || null,
      recorded_by: session.name,
    };
    let res;
    if (editing === 'new') res = await supabase.from('coop_entries').insert(payload);
    else                   res = await supabase.from('coop_entries').update(payload).eq('id', editing.id);
    if (res.error) { alert('❌ ' + res.error.message); return; }
    showToast(editing === 'new' ? '✅ เพิ่มรายการ' : '✅ แก้ไขรายการ');
    setEditing(null);
    setDate(form.entry_date);
    load();
  }

  async function del(entry) {
    if (!confirm(`ลบรายการ "${entry.description || entry.category || entry.type}" จำนวน ${entry.amount} บาท?`)) return;
    const { error } = await supabase.from('coop_entries').delete().eq('id', entry.id);
    if (error) { alert('❌ ' + error.message); return; }
    showToast('🗑️ ลบแล้ว');
    load();
  }

  const totalIn  = entries.filter(e => e.type === 'รายรับ').reduce((s, e) => s + Number(e.amount), 0);
  const totalOut = entries.filter(e => e.type === 'รายจ่าย').reduce((s, e) => s + Number(e.amount), 0);

  return (
    <>
      <div className="row">
        <div>
          <label style={{ fontSize: 12, fontWeight: 600 }}>วันที่</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'end' }}>
          <button className="success" onClick={() => setEditing('new')}>➕ เพิ่มรายการ</button>
          <button onClick={load} style={{ background: '#64748b' }}>🔄 โหลด</button>
          {loadMs !== null && <span className="timing">⚡ {loadMs} ms</span>}
        </div>
      </div>

      <div className="row" style={{ marginTop: 14 }}>
        <Box label="รายรับ"  value={totalIn}  color="#16a34a" />
        <Box label="รายจ่าย" value={totalOut} color="#dc2626" />
        <Box label="คงเหลือ" value={totalIn - totalOut} color={totalIn - totalOut >= 0 ? '#2563eb' : '#dc2626'} big />
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 30, color: '#64748b' }}>⏳ กำลังโหลด...</div>
      )}

      {!loading && loaded && (
        <div style={{ overflowX: 'auto', marginTop: 14 }}>
          <table>
            <thead>
              <tr>
                <th>#</th><th>ประเภท</th><th>หมวด</th><th>รายละเอียด</th>
                <th style={{ textAlign: 'right' }}>จำนวนเงิน</th>
                <th>ใบเสร็จ</th><th width="100"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={e.id}>
                  <td>{i + 1}</td>
                  <td>
                    <span style={{
                      padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                      background: e.type === 'รายรับ' ? '#dcfce7' : '#fee2e2',
                      color:      e.type === 'รายรับ' ? '#166534' : '#991b1b',
                    }}>{e.type}</span>
                  </td>
                  <td>{e.category || '—'}</td>
                  <td style={{ color: '#475569' }}>{e.description || '—'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: e.type === 'รายรับ' ? '#16a34a' : '#dc2626' }}>
                    {Number(e.amount).toLocaleString()}
                  </td>
                  <td>
                    {e.receipt_url
                      ? <a href={e.receipt_url} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontSize: 12 }}>📎 เปิด</a>
                      : <span style={{ color: '#cbd5e1' }}>—</span>}
                  </td>
                  <td style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => setEditing(e)} style={{ padding: '4px 10px', fontSize: 12 }}>✏️</button>
                    <button onClick={() => del(e)} className="danger" style={{ padding: '4px 10px', fontSize: 12 }}>🗑️</button>
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', color: '#94a3b8', padding: 30 }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>🛒</div>
                    <div>ไม่มีรายการในวันที่ {new Date(date + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                    <div style={{ marginTop: 8 }}>
                      <button className="success" onClick={() => setEditing('new')} style={{ fontSize: 13 }}>➕ เพิ่มรายการแรก</button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <EntryModal
          entry={editing === 'new' ? { entry_date: date, type: 'รายรับ' } : editing}
          isNew={editing === 'new'}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      )}
      {toast && <div className="toast show">{toast}</div>}
    </>
  );
}

function EntryModal({ entry, isNew, onClose, onSave }) {
  const [f, setF] = useState({
    entry_date:  entry.entry_date || new Date().toISOString().slice(0, 10),
    type:        entry.type || 'รายรับ',
    category:    entry.category || '',
    description: entry.description || '',
    amount:      entry.amount || '',
    receipt_url: entry.receipt_url || '',
  });

  function submit(e) {
    e.preventDefault();
    if (!f.amount) return alert('กรอกจำนวนเงิน');
    const amt = parseFloat(f.amount);
    if (isNaN(amt) || amt <= 0) return alert('จำนวนเงินต้องมากกว่า 0');
    onSave(f);
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20,
    }}>
      <form onClick={e => e.stopPropagation()} onSubmit={submit} className="card" style={{ width: '100%', maxWidth: 480, margin: 0 }}>
        <h2>{isNew ? '➕ เพิ่มรายการสหกรณ์' : '✏️ แก้ไขรายการ'}</h2>

        <div className="row">
          <Field label="วันที่ *">
            <input type="date" value={f.entry_date} onChange={e => setF(p => ({ ...p, entry_date: e.target.value }))} required />
          </Field>
          <Field label="ประเภท *">
            <select value={f.type} onChange={e => setF(p => ({ ...p, type: e.target.value }))}>
              <option>รายรับ</option><option>รายจ่าย</option>
            </select>
          </Field>
        </div>

        <Field label="หมวด (เช่น ขายขนม, ค่าไฟ, จัดซื้อสินค้า)">
          <input value={f.category} onChange={e => setF(p => ({ ...p, category: e.target.value }))} />
        </Field>
        <Field label="รายละเอียด">
          <input value={f.description} onChange={e => setF(p => ({ ...p, description: e.target.value }))} placeholder="คำอธิบายเพิ่มเติม" />
        </Field>
        <Field label="จำนวนเงิน (บาท) *">
          <input type="number" step="0.01" min="0.01" value={f.amount} onChange={e => setF(p => ({ ...p, amount: e.target.value }))} required />
        </Field>
        <Field label="URL ใบเสร็จ (ถ้ามี)">
          <input value={f.receipt_url} onChange={e => setF(p => ({ ...p, receipt_url: e.target.value }))} placeholder="https://..." />
        </Field>

        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button type="submit" className="success" style={{ flex: 1 }}>💾 บันทึก</button>
          <button type="button" className="secondary" onClick={onClose} style={{ flex: 1 }}>✖ ยกเลิก</button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>{label}</label>
      {children}
    </div>
  );
}

function Box({ label, value, color, big }) {
  return (
    <div className="card" style={{ margin: 0, textAlign: 'center', padding: 14 }}>
      <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: big ? 28 : 22, fontWeight: 800, color, marginTop: 4 }}>
        {Number(value).toLocaleString()} <span style={{ fontSize: 13, color: '#94a3b8' }}>บาท</span>
      </div>
    </div>
  );
}

// ────────────────────────────────────────
// TAB 2: สรุปรายวัน
// ────────────────────────────────────────
function DashboardTab({ session }) {
  const [rows, setRows]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadMs, setLoadMs] = useState(null);

  useEffect(() => {
    if (session) load();
  }, [session]);

  async function load() {
    setLoading(true);
    const t0 = performance.now();
    const { data, error } = await supabase
      .from('coop_entries')
      .select('entry_date, type, amount')
      .eq('school_id', session.schoolId)
      .order('entry_date');
    setLoadMs(Math.round(performance.now() - t0));
    setLoading(false);
    if (error) { alert('❌ ' + error.message); return; }

    const byDate = {};
    (data || []).forEach(r => {
      const d = r.entry_date;
      if (!byDate[d]) byDate[d] = { income: 0, expense: 0 };
      const amt = Number(r.amount) || 0;
      if (r.type === 'รายรับ') byDate[d].income += amt;
      else                     byDate[d].expense += amt;
    });

    const sortedDates = Object.keys(byDate).sort();
    let balance = 0;
    const result = sortedDates.map(d => {
      balance += byDate[d].income - byDate[d].expense;
      return { date: d, ...byDate[d], balance };
    }).reverse();

    setRows(result);
  }

  const grandIn  = rows.reduce((s, r) => s + r.income, 0);
  const grandOut = rows.reduce((s, r) => s + r.expense, 0);
  const grandBal = grandIn - grandOut;

  function thDate(isoStr) {
    const [y, m, d] = isoStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <button onClick={load} style={{ background: '#64748b', fontSize: 13 }}>🔄 รีเฟรช</button>
        {loadMs !== null && <span className="timing">⚡ {loadMs} ms</span>}
      </div>

      <div className="row">
        <Box label="รวมรายรับ"  value={grandIn}  color="#16a34a" />
        <Box label="รวมรายจ่าย" value={grandOut} color="#dc2626" />
        <Box label="ยอดคงเหลือสุทธิ" value={grandBal} color={grandBal >= 0 ? '#2563eb' : '#dc2626'} big />
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 30, color: '#64748b' }}>⏳ กำลังโหลด...</div>}

      {!loading && (
        <div style={{ overflowX: 'auto', marginTop: 14 }}>
          <table>
            <thead>
              <tr>
                <th>วันที่</th>
                <th style={{ textAlign: 'right' }}>รายรับ</th>
                <th style={{ textAlign: 'right' }}>รายจ่าย</th>
                <th style={{ textAlign: 'right' }}>คงเหลือสะสม</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>{thDate(r.date)}</td>
                  <td style={{ textAlign: 'right', color: r.income > 0 ? '#16a34a' : '#cbd5e1' }}>
                    {r.income > 0 ? r.income.toLocaleString() : '—'}
                  </td>
                  <td style={{ textAlign: 'right', color: r.expense > 0 ? '#dc2626' : '#cbd5e1' }}>
                    {r.expense > 0 ? r.expense.toLocaleString() : '—'}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: r.balance >= 0 ? '#2563eb' : '#dc2626' }}>
                    {r.balance.toLocaleString()}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', color: '#94a3b8', padding: 30 }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>🛒</div>
                    ยังไม่มีรายการ — ไปที่ tab "รายการ" เพื่อเพิ่มข้อมูล
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
