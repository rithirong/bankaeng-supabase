'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { getSession } from '@/lib/auth';
import { useYear } from '@/lib/year';
import { supabase } from '@/lib/supabase';
import { makePrintWindow, makePrintHeader } from '@/lib/printTemplate';

const MONTH_NAMES = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
  'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const DOW = ['อา','จ','อ','พ','พฤ','ศ','ส'];
const COLORS = ['#3b82f6','#16a34a','#dc2626','#d97706','#9333ea','#0891b2','#be123c'];

export default function CalendarPage() {
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
        <CalendarMain session={s} year={year} />
      </div>
    </>
  );
}

function CalendarMain({ session, year }) {
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed
  const [viewYear, setViewYear]   = useState(today.getFullYear());
  const [events, setEvents]       = useState([]);
  const [editing, setEditing]     = useState(null);
  const [tab, setTab]             = useState('calendar'); // calendar | list
  const [toast, setToast]         = useState('');
  const isAdmin = session.role === 'admin';

  useEffect(() => { load(); }, [viewMonth, viewYear, year]);

  async function load() {
    const y1 = viewYear;
    const m1 = String(viewMonth + 1).padStart(2, '0');
    const lastDay = new Date(viewYear, viewMonth + 1, 0).getDate();
    const start = `${y1}-${m1}-01`;
    const end   = `${y1}-${m1}-${String(lastDay).padStart(2,'0')}`;

    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('school_id', session.schoolId)
      .eq('academic_year', year)
      .gte('event_date', start)
      .lte('event_date', end)
      .order('event_date').order('event_time', { nullsFirst: true });
    if (error) { alert('❌ ' + error.message); return; }
    setEvents(data || []);
  }

  async function loadAll() {
    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('school_id', session.schoolId)
      .eq('academic_year', year)
      .order('event_date').order('event_time', { nullsFirst: true });
    if (error) { alert('❌ ' + error.message); return; }
    setEvents(data || []);
  }

  useEffect(() => { if (tab === 'list') loadAll(); }, [tab, year]);

  function showToast(m) { setToast(m); setTimeout(() => setToast(''), 1800); }

  async function save(form) {
    const payload = {
      school_id:    session.schoolId,
      academic_year: year,
      event_date:   form.event_date,
      event_title:  form.event_title,
      event_time:   form.event_time || null,
      responsible:  form.responsible || null,
      description:  form.description || null,
      color:        form.color || '#3b82f6',
      created_by:   session.name,
    };
    let error;
    if (editing === 'new') ({ error } = await supabase.from('calendar_events').insert(payload));
    else                   ({ error } = await supabase.from('calendar_events').update(payload).eq('id', editing.id));
    if (error) { alert('❌ ' + error.message); return; }
    showToast(editing === 'new' ? '✅ เพิ่มกิจกรรม' : '✅ แก้ไขแล้ว');
    setEditing(null);
    load(); loadAll();
  }

  async function del(ev) {
    if (!confirm(`ลบกิจกรรม "${ev.event_title}"?`)) return;
    const { error } = await supabase.from('calendar_events').delete().eq('id', ev.id);
    if (error) { alert('❌ ' + error.message); return; }
    showToast('🗑️ ลบแล้ว');
    load(); loadAll();
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  // สร้าง grid ปฏิทิน
  const firstDay = new Date(viewYear, viewMonth, 1).getDay(); // 0=อา
  const lastDate = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= lastDate; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const evByDay = {};
  events.forEach(e => {
    const d = parseInt(e.event_date.slice(8, 10));
    if (!evByDay[d]) evByDay[d] = [];
    evByDay[d].push(e);
  });

  const thYear = viewYear + 543;

  function printCalendar() {
    const schoolName = session.school?.name || 'โรงเรียนบ้านแก่ง';
    const tbody = events.map(e => {
      const d = new Date(e.event_date + 'T00:00:00');
      const dateStr = d.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
      return `<tr>
        <td class="nowrap">${dateStr}</td>
        <td class="nowrap">${e.event_time || '—'}</td>
        <td class="text-left"><b>${e.event_title}</b>${e.description ? `<br/><small style="font-size:10px;">${e.description}</small>` : ''}</td>
        <td>${e.responsible || '—'}</td>
      </tr>`;
    }).join('');
    const html = `
      ${makePrintHeader(schoolName, 'ปฏิทินวิชาการ', `ปีการศึกษา ${year}`)}
      <table><thead>
        <tr><th>วัน/เดือน/ปี</th><th>เวลา</th><th>กิจกรรม</th><th>ผู้รับผิดชอบ</th></tr>
      </thead><tbody>${tbody}</tbody></table>
    `;
    makePrintWindow(html, 'portrait');
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0 }}>📆 ปฏิทินวิชาการ ปีการศึกษา {year}</h2>
        <div style={{ display: 'flex', gap: 6 }}>
          {isAdmin && (
            <button className="success" onClick={() => setEditing('new')} style={{ fontSize: 13 }}>➕ เพิ่มกิจกรรม</button>
          )}
          <button onClick={printCalendar} style={{ background: '#64748b', fontSize: 13 }}>🖨️ พิมพ์</button>
        </div>
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', padding: 4, borderRadius: 10, marginBottom: 14 }}>
        <TabBtn active={tab === 'calendar'} onClick={() => setTab('calendar')}>📆 ปฏิทิน</TabBtn>
        <TabBtn active={tab === 'list'}     onClick={() => setTab('list')}>📋 รายการ</TabBtn>
      </div>

      {tab === 'calendar' && (
        <>
          {/* Month navigation */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 12 }}>
            <button onClick={prevMonth} style={{ padding: '6px 14px', background: '#64748b' }}>◀</button>
            <span style={{ fontWeight: 700, fontSize: 16 }}>{MONTH_NAMES[viewMonth]} {thYear}</span>
            <button onClick={nextMonth} style={{ padding: '6px 14px', background: '#64748b' }}>▶</button>
          </div>

          {/* Calendar grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {DOW.map(d => (
              <div key={d} style={{
                textAlign: 'center', fontWeight: 700, fontSize: 12,
                padding: '6px 0', background: '#f1f5f9', borderRadius: 6,
                color: d === 'อา' ? '#dc2626' : d === 'ส' ? '#2563eb' : '#374151',
              }}>{d}</div>
            ))}

            {cells.map((day, i) => {
              const isToday = day && viewYear === today.getFullYear() && viewMonth === today.getMonth() && day === today.getDate();
              const dayEvs = day ? (evByDay[day] || []) : [];
              return (
                <div key={i} style={{
                  minHeight: 72, padding: '4px', borderRadius: 8,
                  background: isToday ? '#dbeafe' : day ? '#fff' : 'transparent',
                  border: isToday ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                  cursor: isAdmin && day ? 'pointer' : 'default',
                }}
                onClick={() => { if (isAdmin && day) {
                  const dateStr = `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                  setEditing({ event_date: dateStr, event_title: '', event_time: '', responsible: '', description: '', color: '#3b82f6' });
                }}}
                >
                  {day && (
                    <>
                      <div style={{ fontSize: 12, fontWeight: isToday ? 800 : 600, color: isToday ? '#1e40af' : '#374151', marginBottom: 2 }}>
                        {day}
                      </div>
                      {dayEvs.map(ev => (
                        <div key={ev.id}
                          onClick={e => { e.stopPropagation(); if (isAdmin) setEditing(ev); }}
                          style={{
                            fontSize: 10, fontWeight: 600, padding: '2px 4px', borderRadius: 4, marginBottom: 2,
                            background: ev.color || '#3b82f6', color: '#fff',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            cursor: isAdmin ? 'pointer' : 'default',
                          }}
                          title={`${ev.event_time ? ev.event_time + ' ' : ''}${ev.event_title}`}
                        >
                          {ev.event_time && <span>{ev.event_time} </span>}
                          {ev.event_title}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab === 'list' && (
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr><th>วัน/เดือน/ปี</th><th>เวลา</th><th>กิจกรรม</th><th>ผู้รับผิดชอบ</th><th>หมายเหตุ</th>{isAdmin && <th width="90"></th>}</tr>
            </thead>
            <tbody>
              {events.map(ev => {
                const d = new Date(ev.event_date + 'T00:00:00');
                return (
                  <tr key={ev.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: ev.color || '#3b82f6', marginRight: 6 }} />
                      {d.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td>{ev.event_time || '—'}</td>
                    <td><b>{ev.event_title}</b></td>
                    <td>{ev.responsible || '—'}</td>
                    <td style={{ fontSize: 12, color: '#64748b' }}>{ev.description || '—'}</td>
                    {isAdmin && (
                      <td style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => setEditing(ev)} style={{ padding: '4px 8px', fontSize: 12 }}>✏️</button>
                        <button onClick={() => del(ev)} className="danger" style={{ padding: '4px 8px', fontSize: 12 }}>🗑️</button>
                      </td>
                    )}
                  </tr>
                );
              })}
              {events.length === 0 && (
                <tr><td colSpan={isAdmin ? 6 : 5} style={{ textAlign: 'center', color: '#94a3b8', padding: 30 }}>
                  — ยังไม่มีกิจกรรมในปีการศึกษา {year} —
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <EventModal
          event={editing === 'new' ? { event_date: new Date().toISOString().slice(0,10), event_title: '', event_time: '', responsible: '', description: '', color: '#3b82f6' } : editing}
          isNew={editing === 'new' || !editing.id}
          onClose={() => setEditing(null)}
          onSave={save}
          onDelete={editing.id ? () => { del(editing); setEditing(null); } : null}
        />
      )}
      {toast && <div className="toast show">{toast}</div>}
    </div>
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

function EventModal({ event, isNew, onClose, onSave, onDelete }) {
  const [f, setF] = useState({
    event_date:  event.event_date || '',
    event_title: event.event_title || '',
    event_time:  event.event_time || '',
    responsible: event.responsible || '',
    description: event.description || '',
    color:       event.color || '#3b82f6',
  });

  function submit(e) {
    e.preventDefault();
    if (!f.event_date || !f.event_title.trim()) return alert('กรุณากรอกวันที่และชื่อกิจกรรม');
    onSave(f);
  }

  const field = (label, key, type='text', placeholder='') => (
    <div style={{ marginBottom: 10 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>{label}</label>
      <input type={type} value={f[key]} onChange={e => setF(p => ({ ...p, [key]: e.target.value }))} placeholder={placeholder} />
    </div>
  );

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20,
    }}>
      <form onClick={e => e.stopPropagation()} onSubmit={submit} className="card" style={{ width: '100%', maxWidth: 480, margin: 0 }}>
        <h2 style={{ fontSize: 16, marginBottom: 14 }}>{isNew ? '➕ เพิ่มกิจกรรม' : '✏️ แก้ไขกิจกรรม'}</h2>

        <div className="row">
          {field('วันที่ *', 'event_date', 'date')}
          {field('เวลา (ไม่บังคับ)', 'event_time', 'time')}
        </div>
        {field('ชื่อกิจกรรม *', 'event_title', 'text', 'เช่น วันสอบกลางภาค')}
        {field('ผู้รับผิดชอบ', 'responsible', 'text', 'ชื่อครู / ฝ่าย')}
        {field('หมายเหตุ', 'description', 'text', 'รายละเอียดเพิ่มเติม')}

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>สี</label>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            {COLORS.map(c => (
              <div key={c} onClick={() => setF(p => ({ ...p, color: c }))}
                style={{ width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer',
                  border: f.color === c ? '3px solid #0f172a' : '2px solid transparent' }} />
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" className="success" style={{ flex: 1 }}>💾 บันทึก</button>
          {onDelete && <button type="button" className="danger" onClick={onDelete} style={{ flex: 1 }}>🗑️ ลบ</button>}
          <button type="button" className="secondary" onClick={onClose} style={{ flex: 1 }}>✖</button>
        </div>
      </form>
    </div>
  );
}
