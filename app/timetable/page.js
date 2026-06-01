'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { getSession } from '@/lib/auth';
import { useYear } from '@/lib/year';
import { supabase } from '@/lib/supabase';
import { makePrintWindow, makePrintHeader } from '@/lib/printTemplate';

const CLASSES  = ['อ.2','อ.3','ป.1','ป.2','ป.3','ป.4','ป.5','ป.6'];
const DAYS     = ['จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์'];
const DAYS_SHORT = ['จ.','อ.','พ.','พฤ.','ศ.'];
const PERIODS  = [1,2,3,4,5,6,7,8];

export default function TimetablePage() {
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
        <TimetableMain session={s} year={year} />
      </div>
    </>
  );
}

function TimetableMain({ session, year }) {
  const defaultClass = session.role === 'teacher' && session.class && session.class !== 'Admin'
    ? session.class : CLASSES[0];
  const [cls, setCls] = useState(defaultClass);
  const [grid, setGrid] = useState({}); // {`${day}-${period}`} = {subject, teacher_name, id}
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null); // {day, period, subject, teacher_name}
  const [toast, setToast] = useState('');
  const isAdmin = session.role === 'admin';

  useEffect(() => { load(); }, [cls, year]);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('timetable')
      .select('*')
      .eq('school_id', session.schoolId)
      .eq('academic_year', year)
      .eq('class', cls);
    setLoading(false);
    if (error) { alert('❌ ' + error.message); return; }
    const map = {};
    (data || []).forEach(r => { map[`${r.day_of_week}-${r.period}`] = r; });
    setGrid(map);
  }

  function showToast(m) { setToast(m); setTimeout(() => setToast(''), 1800); }

  async function saveCell(day, period, subject, teacherName) {
    const key = `${day}-${period}`;
    const payload = {
      school_id:    session.schoolId,
      academic_year: year,
      class:        cls,
      day_of_week:  day,
      period:       period,
      subject:      subject || null,
      teacher_name: teacherName || null,
      updated_at:   new Date().toISOString(),
    };

    if (grid[key]?.id) {
      if (!subject && !teacherName) {
        // clear cell → delete
        const { error } = await supabase.from('timetable').delete().eq('id', grid[key].id);
        if (error) { alert('❌ ' + error.message); return; }
      } else {
        const { error } = await supabase.from('timetable').update({ subject: subject || null, teacher_name: teacherName || null, updated_at: payload.updated_at }).eq('id', grid[key].id);
        if (error) { alert('❌ ' + error.message); return; }
      }
    } else if (subject || teacherName) {
      const { error } = await supabase.from('timetable').insert(payload);
      if (error) { alert('❌ ' + error.message); return; }
    }
    showToast('✅ บันทึกแล้ว');
    setEditing(null);
    load();
  }

  function handleCellClick(day, period) {
    if (!isAdmin) return;
    const cell = grid[`${day}-${period}`] || {};
    setEditing({ day, period, subject: cell.subject || '', teacher_name: cell.teacher_name || '' });
  }

  function printTimetable() {
    const schoolName = session.school?.name || 'โรงเรียนบ้านแก่ง';
    const rows = PERIODS.map(p => {
      const cells = DAYS.map((_, di) => {
        const cell = grid[`${di+1}-${p}`];
        return `<td>${cell?.subject ? `<b>${cell.subject}</b>${cell.teacher_name ? `<br/><span style="font-size:9px;">${cell.teacher_name}</span>` : ''}` : ''}</td>`;
      }).join('');
      return `<tr><th>${p}</th>${cells}</tr>`;
    }).join('');
    const html = `
      ${makePrintHeader(schoolName, `ตารางสอนชั้น ${cls}`, `ปีการศึกษา ${year}`)}
      <table><thead>
        <tr><th>คาบ</th>${DAYS.map(d=>`<th>${d}</th>`).join('')}</tr>
      </thead><tbody>${rows}</tbody></table>
    `;
    makePrintWindow(html, 'landscape');
  }

  return (
    <div className="card">
      <h2 style={{ margin: '0 0 14px' }}>📅 ตารางสอน ปีการศึกษา {year}</h2>

      <div className="row" style={{ marginBottom: 14 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600 }}>ชั้นเรียน</label>
          <select value={cls} onChange={e => setCls(e.target.value)}>
            {CLASSES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'end' }}>
          {isAdmin && (
            <div style={{ fontSize: 12, color: '#64748b', alignSelf: 'center' }}>
              💡 คลิกที่ช่องเพื่อแก้ไข
            </div>
          )}
          <button onClick={printTimetable} style={{ background: '#64748b' }}>🖨️ พิมพ์</button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 30, color: '#64748b' }}>⏳ กำลังโหลด...</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ fontSize: 13, minWidth: 600 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'center', width: 50 }}>คาบ</th>
                {DAYS.map((d, i) => (
                  <th key={i} style={{ textAlign: 'center', minWidth: 110 }}>{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERIODS.map(p => (
                <tr key={p}>
                  <td style={{ textAlign: 'center', fontWeight: 700, background: '#f8fafc', color: '#64748b' }}>{p}</td>
                  {DAYS.map((_, di) => {
                    const cell = grid[`${di+1}-${p}`];
                    return (
                      <td
                        key={di}
                        onClick={() => handleCellClick(di+1, p)}
                        style={{
                          textAlign: 'center', verticalAlign: 'middle',
                          minHeight: 50, height: 54,
                          cursor: isAdmin ? 'pointer' : 'default',
                          background: cell?.subject ? '#eff6ff' : '#fff',
                          transition: 'background 0.1s',
                        }}
                        title={isAdmin ? 'คลิกเพื่อแก้ไข' : ''}
                      >
                        {cell?.subject ? (
                          <div>
                            <div style={{ fontWeight: 700, color: '#1e40af', fontSize: 13 }}>{cell.subject}</div>
                            {cell.teacher_name && (
                              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{cell.teacher_name}</div>
                            )}
                          </div>
                        ) : (
                          isAdmin && <span style={{ color: '#e2e8f0', fontSize: 20 }}>+</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <CellModal
          editing={editing}
          dayName={DAYS[editing.day - 1]}
          onClose={() => setEditing(null)}
          onSave={saveCell}
        />
      )}
      {toast && <div className="toast show">{toast}</div>}
    </div>
  );
}

function CellModal({ editing, dayName, onClose, onSave }) {
  const [subject, setSubject]     = useState(editing.subject);
  const [teacher, setTeacher]     = useState(editing.teacher_name);

  function submit(e) {
    e.preventDefault();
    onSave(editing.day, editing.period, subject.trim(), teacher.trim());
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20,
    }}>
      <form onClick={e => e.stopPropagation()} onSubmit={submit} className="card" style={{ width: '100%', maxWidth: 400, margin: 0 }}>
        <h2 style={{ fontSize: 16, marginBottom: 14 }}>✏️ แก้ไขช่อง: วัน{dayName} คาบ {editing.period}</h2>

        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 12, fontWeight: 600 }}>วิชา</label>
          <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="เช่น คณิตศาสตร์" autoFocus />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 600 }}>ครูผู้สอน</label>
          <input value={teacher} onChange={e => setTeacher(e.target.value)} placeholder="ชื่อครู" />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" className="success" style={{ flex: 1 }}>💾 บันทึก</button>
          <button type="button" className="danger" onClick={() => onSave(editing.day, editing.period, '', '')} style={{ flex: 1 }}>🗑️ ลบช่อง</button>
          <button type="button" className="secondary" onClick={onClose} style={{ flex: 1 }}>✖</button>
        </div>
      </form>
    </div>
  );
}
