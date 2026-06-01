'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { getSession } from '@/lib/auth';
import { useYear } from '@/lib/year';
import { sortByClassAndStudentId } from '@/lib/sort';
import { supabase } from '@/lib/supabase';
import { makePrintWindow, makePrintHeader, makeSignature2, makeNoteBox } from '@/lib/printTemplate';

const CLASSES = ['อ.2','อ.3','ป.1','ป.2','ป.3','ป.4','ป.5','ป.6'];
const STATUSES = ['ยังไม่เยี่ยม', 'เยี่ยมแล้ว', 'นัดหมาย'];
const STATUS_COLORS = {
  'ยังไม่เยี่ยม': { bg: '#fee2e2', fg: '#991b1b' },
  'เยี่ยมแล้ว':   { bg: '#dcfce7', fg: '#166534' },
  'นัดหมาย':      { bg: '#fef3c7', fg: '#92400e' },
};

const EMPTY_FORM = {
  visit_date: '', visitor_name: '', visit_status: 'ยังไม่เยี่ยม',
  house_condition: '', parent_concern: '', teacher_note: '',
};

export default function HomeVisitPage() {
  const router = useRouter();
  const [s, setS] = useState(null);
  const [year] = useYear();

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
          <h2 style={{ margin: '0 0 14px' }}>🏠 บันทึกการเยี่ยมบ้าน ปีการศึกษา {year}</h2>
          <HomeVisitMain session={s} year={year} />
        </div>
      </div>
    </>
  );
}

function HomeVisitMain({ session, year }) {
  const [cls, setCls] = useState(session.role === 'teacher' && session.class ? session.class : '');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(null); // {student, visit}
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [toast, setToast] = useState('');

  async function load() {
    if (!cls) return alert('⚠️ เลือกชั้น');
    setLoading(true);
    const [enrRes, hvRes] = await Promise.all([
      supabase.from('enrollments')
        .select('students!inner(student_id, prefix, first_name, last_name, father_name, father_job, father_phone, mother_name, mother_job, guardian_name, guardian_relation, guardian_job, guardian_phone)')
        .eq('school_id', session.schoolId).eq('academic_year', year).eq('class', cls)
        .in('status', ['ปกติ', 'ย้ายเข้า']),
      supabase.from('home_visits')
        .select('*')
        .eq('school_id', session.schoolId).eq('academic_year', year).eq('class', cls),
    ]);
    setLoading(false);
    if (enrRes.error) return alert('❌ ' + enrRes.error.message);

    const hvMap = {};
    (hvRes.data || []).forEach(r => { hvMap[r.student_id] = r; });

    const list = (enrRes.data || []).map(e => ({
      ...e.students,
      class: cls,
      visit: hvMap[e.students.student_id] || null,
    }));
    setRows(sortByClassAndStudentId(list));
  }

  function openModal(row) {
    const v = row.visit;
    setForm({
      visit_date: v?.visit_date || '',
      visitor_name: v?.visitor_name || session.name,
      visit_status: v?.visit_status || 'ยังไม่เยี่ยม',
      house_condition: v?.house_condition || '',
      parent_concern: v?.parent_concern || '',
      teacher_note: v?.teacher_note || '',
    });
    setModal(row);
  }

  async function saveVisit() {
    const payload = {
      school_id: session.schoolId,
      academic_year: year,
      student_id: modal.student_id,
      class: cls,
      ...form,
      visit_date: form.visit_date || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('home_visits')
      .upsert(payload, { onConflict: 'school_id,academic_year,student_id' });
    if (error) return alert('❌ ' + error.message);
    setModal(null);
    setToast('✅ บันทึกการเยี่ยมบ้านแล้ว');
    setTimeout(() => setToast(''), 2000);
    load();
  }

  function doPrint() {
    const schoolName = session.school?.name || 'โรงเรียนบ้านแก่ง';
    const total = rows.length;
    const visited = rows.filter(r => r.visit?.visit_status === 'เยี่ยมแล้ว').length;
    const notYet = rows.filter(r => !r.visit?.visit_status || r.visit.visit_status === 'ยังไม่เยี่ยม').length;
    const tbody = rows.map((r, i) => `<tr>
      <td>${i+1}</td><td>${r.student_id}</td>
      <td class="text-left">${r.prefix||''}${r.first_name} ${r.last_name}</td>
      <td>${r.visit?.visit_status || 'ยังไม่เยี่ยม'}</td>
      <td>${r.visit?.visit_date || ''}</td>
      <td>${r.visit?.visitor_name || ''}</td>
      <td class="text-left">${r.visit?.teacher_note || ''}</td>
    </tr>`).join('');
    const note = makeNoteBox(`<b>📊 สรุป (รวม ${total} คน):</b><br/>
      - เยี่ยมแล้ว: ${visited} คน &nbsp; - ยังไม่เยี่ยม: ${notYet} คน &nbsp; - ความคืบหน้า: ${total>0?Math.round(visited/total*100):0}%`);
    const html = `
      ${makePrintHeader(schoolName, 'รายงานการเยี่ยมบ้านนักเรียน', `ชั้น ${cls} ปีการศึกษา ${year}`)}
      <table>
        <thead><tr>
          <th>#</th><th>เลขประจำตัว</th><th>ชื่อ-สกุล</th>
          <th>สถานะ</th><th>วันที่เยี่ยม</th><th>ผู้เยี่ยม</th>
          <th>หมายเหตุ</th>
        </tr></thead>
        <tbody>${tbody}</tbody>
      </table>
      ${note}
      ${makeSignature2(session.name, session.school?.director, schoolName)}
    `;
    makePrintWindow(html, 'landscape');
  }

  const visited = rows.filter(r => r.visit?.visit_status === 'เยี่ยมแล้ว').length;
  const pct = rows.length > 0 ? Math.round(visited / rows.length * 100) : 0;

  return (
    <>
      <div className="row">
        <div>
          <label style={{ fontSize: 12, fontWeight: 600 }}>ชั้นเรียน</label>
          <select value={cls} onChange={e => setCls(e.target.value)}>
            <option value="">-- เลือก --</option>
            {CLASSES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'end' }}>
          <button onClick={load} disabled={loading}>{loading ? '⏳...' : '📋 โหลด'}</button>
          {rows.length > 0 && <button className="secondary" onClick={doPrint}>🖨️ พิมพ์รายงาน</button>}
        </div>
      </div>

      {rows.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 10, margin: '14px 0 10px', flexWrap: 'wrap' }}>
            {STATUSES.map(st => {
              const n = rows.filter(r => (r.visit?.visit_status || 'ยังไม่เยี่ยม') === st).length;
              const c = STATUS_COLORS[st];
              return (
                <div key={st} style={{ background: c.bg, color: c.fg, padding: '6px 14px', borderRadius: 8, fontWeight: 700, fontSize: 13 }}>
                  {st}: {n} คน
                </div>
              );
            })}
            <div style={{ padding: '6px 14px', background: '#eff6ff', color: '#1e40af', borderRadius: 8, fontWeight: 700, fontSize: 13 }}>
              ความคืบหน้า: {pct}%
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>#</th><th>เลขประจำตัว</th><th>ชื่อ-สกุล</th>
                  <th>สถานะ</th><th>วันที่เยี่ยม</th><th>ผู้เยี่ยม</th><th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const st = r.visit?.visit_status || 'ยังไม่เยี่ยม';
                  const c = STATUS_COLORS[st];
                  return (
                    <tr key={r.student_id}>
                      <td>{i+1}</td>
                      <td><b>{r.student_id}</b></td>
                      <td>{r.prefix}{r.first_name} {r.last_name}</td>
                      <td>
                        <span style={{ background: c.bg, color: c.fg, padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
                          {st}
                        </span>
                      </td>
                      <td>{r.visit?.visit_date || '—'}</td>
                      <td>{r.visit?.visitor_name || '—'}</td>
                      <td>
                        <button className="secondary" style={{ padding: '4px 10px', fontSize: 12 }}
                          onClick={() => openModal(r)}>✏️ บันทึก</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 16px', color: '#c2410c' }}>🏠 บันทึกการเยี่ยมบ้าน</h3>
            <div style={{ background: '#fff7ed', padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
              <b>{modal.prefix}{modal.first_name} {modal.last_name}</b> (เลข {modal.student_id})
              {modal.father_name && <div>บิดา: {modal.father_name} {modal.father_job ? `(${modal.father_job})` : ''}</div>}
              {modal.mother_name && <div>มารดา: {modal.mother_name}</div>}
              {modal.guardian_phone && <div>โทร: {modal.guardian_phone}</div>}
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600 }}>สถานะ</label>
                <select value={form.visit_status} onChange={e => setForm(p => ({ ...p, visit_status: e.target.value }))}>
                  {STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600 }}>วันที่เยี่ยม</label>
                <input type="date" value={form.visit_date} onChange={e => setForm(p => ({ ...p, visit_date: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600 }}>ผู้เยี่ยม</label>
                <input value={form.visitor_name} onChange={e => setForm(p => ({ ...p, visitor_name: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600 }}>สภาพบ้าน</label>
                <input value={form.house_condition} onChange={e => setForm(p => ({ ...p, house_condition: e.target.value }))} placeholder="เช่น บ้านปูน, บ้านไม้..." />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600 }}>ข้อกังวลผู้ปกครอง</label>
                <textarea rows={2} value={form.parent_concern} onChange={e => setForm(p => ({ ...p, parent_concern: e.target.value }))}
                  style={{ width: '100%', padding: '6px 10px', borderRadius: 8, border: '1px solid #e2e8f0', resize: 'vertical' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600 }}>บันทึกของครู</label>
                <textarea rows={2} value={form.teacher_note} onChange={e => setForm(p => ({ ...p, teacher_note: e.target.value }))}
                  style={{ width: '100%', padding: '6px 10px', borderRadius: 8, border: '1px solid #e2e8f0', resize: 'vertical' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button className="success" onClick={saveVisit}>💾 บันทึก</button>
              <button className="secondary" onClick={() => setModal(null)}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast show">{toast}</div>}
    </>
  );
}
