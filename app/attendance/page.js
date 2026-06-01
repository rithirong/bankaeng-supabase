'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { getSession } from '@/lib/auth';
import { useYear } from '@/lib/year';
import { sortByClassAndStudentId } from '@/lib/sort';
import { supabase } from '@/lib/supabase';
import { makePrintWindow } from '@/lib/printTemplate';

const CLASSES    = ['อ.2','อ.3','ป.1','ป.2','ป.3','ป.4','ป.5','ป.6'];
const CLASSES_KG = ['อ.2','อ.3'];
const CLASSES_PR = ['ป.1','ป.2','ป.3','ป.4','ป.5','ป.6'];
const STATUSES   = ['มา','ขาด','ลา','ป่วย'];
const THAI_MONTHS = [
  'มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
  'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม',
];
const THAI_DAYS = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];

function thaiDateFull(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return `วัน${THAI_DAYS[dow]}ที่ ${d} ${THAI_MONTHS[m - 1]} พ.ศ.${y + 543}`;
}

// ────────────────────────────────────────
// MAIN PAGE
// ────────────────────────────────────────
export default function AttendancePage() {
  const router = useRouter();
  const [s, setS] = useState(null);
  const [year]    = useYear();
  const [cls, setCls]   = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  // mode: 'attendance' | 'monthly' | 'dashboard'
  const [mode, setMode] = useState('attendance');
  const [toast, setToast] = useState('');

  // students loaded from AttendanceSection (used by printBlankList)
  const [studentsForBlank, setStudentsForBlank] = useState([]);

  // Holiday modal
  const [showHolidayModal, setShowHolidayModal]   = useState(false);
  const [holidayName, setHolidayName]             = useState('');
  const [savingHoliday, setSavingHoliday]         = useState(false);

  // Daily print modal
  const [showDailyModal, setShowDailyModal]   = useState(false);
  const [teacherList, setTeacherList]         = useState([]);
  const [t1, setT1] = useState('');
  const [t2, setT2] = useState('');
  const [t3, setT3] = useState('');
  const [dailyNote, setDailyNote]             = useState('');
  const [printingDaily, setPrintingDaily]     = useState(false);

  useEffect(() => {
    const sess = getSession();
    if (!sess || sess.role === 'parent') { router.replace('/'); return; }
    setS(sess);
    if (sess.role === 'teacher' && sess.class) setCls(sess.class);
  }, [router]);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  // ── บันทึกวันหยุด ──
  async function saveHoliday() {
    if (!date) return alert('⚠️ เลือกวันที่ก่อน');
    const name = holidayName.trim() || 'วันหยุด';
    setSavingHoliday(true);
    // remove duplicate holiday on same date, then insert fresh
    await supabase.from('calendar_events')
      .delete()
      .eq('school_id', s.schoolId).eq('event_date', date).eq('description', 'holiday');
    const { error } = await supabase.from('calendar_events').insert({
      school_id: s.schoolId, academic_year: year,
      event_date: date, event_title: name,
      color: '#dc2626', description: 'holiday', created_by: s.name,
    });
    setSavingHoliday(false);
    if (error) return alert('❌ ' + error.message);
    setShowHolidayModal(false);
    setHolidayName('');
    showToast(`✅ บันทึกวันหยุด "${name}" สำเร็จ`);
  }

  // ── เปิด Modal สถิติรายวัน ──
  async function openDailyModal() {
    if (!date) return alert('⚠️ เลือกวันที่ก่อน');
    const { data } = await supabase.from('teachers')
      .select('name').eq('school_id', s.schoolId).neq('hidden', true).order('name');
    setTeacherList((data || []).map(t => t.name));
    setT1(''); setT2(''); setT3(''); setDailyNote('');
    setShowDailyModal(true);
  }

  // ── พิมพ์สถิติรายวัน (หลังกด ดำเนินการพิมพ์) ──
  async function processDailyPrint() {
    setPrintingDaily(true);
    const [enrRes, attRes] = await Promise.all([
      supabase.from('enrollments')
        .select('class, students!inner(student_id, gender)')
        .eq('school_id', s.schoolId).eq('academic_year', year)
        .in('status', ['ปกติ', 'ย้ายเข้า']),
      supabase.from('attendance')
        .select('class, student_id, status')
        .eq('school_id', s.schoolId).eq('attendance_date', date),
    ]);
    setPrintingDaily(false);
    setShowDailyModal(false);
    if (enrRes.error || attRes.error) return alert('❌ ' + (enrRes.error || attRes.error).message);

    // build stats per class
    const stats = {};
    CLASSES.forEach(c => {
      stats[c] = { total: { m: 0, f: 0, all: 0 } };
      STATUSES.forEach(st => { stats[c][st] = { m: 0, f: 0, all: 0 }; });
    });
    const attBySid = {};
    (attRes.data || []).forEach(r => { attBySid[r.student_id] = r.status; });
    (enrRes.data || []).forEach(e => {
      const c = e.class; const stu = e.students;
      if (!stats[c]) return;
      const g = stu.gender === 'ญ' ? 'f' : 'm';
      stats[c].total[g]++; stats[c].total.all++;
      const status = attBySid[stu.student_id];
      if (status && stats[c][status]) { stats[c][status][g]++; stats[c][status].all++; }
    });

    function makeStatObj() { return { m: 0, f: 0, all: 0 }; }
    function addObj(target, src) {
      ['total', ...STATUSES].forEach(k => {
        target[k].m  += src[k].m;
        target[k].f  += src[k].f;
        target[k].all += src[k].all;
      });
    }
    const sumKg  = { total: makeStatObj() }; STATUSES.forEach(st => { sumKg[st]  = makeStatObj(); });
    const sumPr  = { total: makeStatObj() }; STATUSES.forEach(st => { sumPr[st]  = makeStatObj(); });
    const sumAll = { total: makeStatObj() }; STATUSES.forEach(st => { sumAll[st] = makeStatObj(); });

    function makeRow(label, d, bold) {
      const pct = d.total.all > 0 ? ((d['มา'].all / d.total.all) * 100).toFixed(2) : '0.00';
      const bg  = bold ? 'background-color:#e2e8f0 !important; font-weight:bold; font-size:13px;' : '';
      return `<tr style="${bg}">
        <td class="text-left">${label}</td>
        <td>${d.total.m}</td><td>${d.total.f}</td><td class="col-total">${d.total.all}</td>
        <td>${d['มา'].m}</td><td>${d['มา'].f}</td><td class="col-total" style="color:#198754;">${d['มา'].all}</td>
        <td>${d['ขาด'].m}</td><td>${d['ขาด'].f}</td><td class="col-total" style="color:#dc3545;">${d['ขาด'].all}</td>
        <td>${d['ลา'].m}</td><td>${d['ลา'].f}</td><td class="col-total" style="color:#fd7e14;">${d['ลา'].all}</td>
        <td>${d['ป่วย'].m}</td><td>${d['ป่วย'].f}</td><td class="col-total" style="color:#007bff;">${d['ป่วย'].all}</td>
        <td style="color:#0d6efd;font-weight:bold;background-color:#e6f2ff !important;">${pct}%</td>
      </tr>`;
    }

    let bodyRows = '';
    CLASSES_KG.forEach(c => { bodyRows += makeRow('ชั้น ' + c, stats[c], false); addObj(sumKg, stats[c]); });
    bodyRows += makeRow('รวมอนุบาล', sumKg, true);
    CLASSES_PR.forEach(c => { bodyRows += makeRow('ชั้น ' + c, stats[c], false); addObj(sumPr, stats[c]); });
    bodyRows += makeRow('รวมประถมศึกษา', sumPr, true);
    addObj(sumAll, sumKg); addObj(sumAll, sumPr);
    bodyRows += makeRow('รวมทั้งสิ้น', sumAll, true);

    const schoolName = s.school?.name || 'โรงเรียนบ้านแก่ง';
    const noteHtml   = dailyNote ? dailyNote.replace(/\n/g, '<br>') : '- เหตุการณ์ปกติ -';
    const t1n = t1 || '........................................';
    const t2n = t2 || '........................................';
    const t3n = t3 || '........................................';

    const body = `
      <div class="print-header">
        <h3>รายงานสถิติการมาเรียน ${schoolName}</h3>
        <h4>ประจำ${thaiDateFull(date)} ปีการศึกษา ${year}</h4>
      </div>
      <table>
        <thead>
          <tr>
            <th rowspan="2" style="min-width:110px;">ชั้น</th>
            <th colspan="3">จำนวนนักเรียน</th>
            <th colspan="3">มา</th>
            <th colspan="3">ขาด</th>
            <th colspan="3">ลา</th>
            <th colspan="3">ป่วย</th>
            <th rowspan="2">%มา</th>
          </tr>
          <tr>${['ช','ญ','รวม','ช','ญ','รวม','ช','ญ','รวม','ช','ญ','รวม','ช','ญ','รวม'].map(h => `<th>${h}</th>`).join('')}</tr>
        </thead>
        <tbody>${bodyRows}</tbody>
      </table>
      <div class="print-note-box" style="margin-top:10px;">
        <b>เหตุการณ์ประจำวัน:</b> ${noteHtml}
      </div>
      <div style="display:flex;justify-content:space-around;margin-top:40px;text-align:center;font-size:12px;">
        <div>
          <div style="border-bottom:1px dotted #000;width:200px;height:18px;margin:0 auto 3px;"></div>
          (${t1n})<br/>ครูเวรประจำวัน
        </div>
        <div>
          <div style="border-bottom:1px dotted #000;width:200px;height:18px;margin:0 auto 3px;"></div>
          (${t2n})<br/>ครูเวรประจำวัน
        </div>
        <div>
          <div style="border-bottom:1px dotted #000;width:200px;height:18px;margin:0 auto 3px;"></div>
          (${t3n})<br/>ครูเวรประจำวัน
        </div>
      </div>`;
    makePrintWindow(body, 'portrait');
  }

  // ── helper: ดึงวันหยุดของเดือน (calendar_events + เสาร์-อาทิตย์) ──
  async function fetchHolidaysForMonth(y, m, daysInMonth) {
    const yStr = String(y);
    const mStr = String(m).padStart(2, '0');
    const startDate = `${yStr}-${mStr}-01`;
    const endDate   = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
    const { data } = await supabase.from('calendar_events')
      .select('event_date, event_title')
      .eq('school_id', s.schoolId)
      .eq('description', 'holiday')
      .gte('event_date', startDate)
      .lt('event_date', endDate);
    const holidays = {};
    (data || []).forEach(h => {
      const d = parseInt(h.event_date.slice(8, 10));
      holidays[d] = h.event_title;
    });
    for (let d = 1; d <= daysInMonth; d++) {
      const dow = new Date(y, m - 1, d).getDay();
      if (dow === 0) holidays[d] = holidays[d] || 'วันอาทิตย์';
      else if (dow === 6) holidays[d] = holidays[d] || 'วันเสาร์';
    }
    return holidays;
  }

  // ── พิมพ์รายเดือน (Attendance / Milk / Teeth) ──
  async function printMonthly(actType) {
    if (!cls || !date) return alert('⚠️ เลือกชั้นเรียนและวันที่ก่อน');
    const [yStr, mStr] = date.split('-');
    const y = parseInt(yStr), m = parseInt(mStr);
    const daysInMonth = new Date(y, m, 0).getDate();
    const startDate   = `${yStr}-${mStr}-01`;
    const endDate     = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
    const titleMap    = { Attendance: 'แบบบันทึกการมาเรียน', Milk: 'แบบบันทึกการดื่มนม', Teeth: 'แบบบันทึกการแปรงฟัน' };

    const [enrRes, attRes, holidays] = await Promise.all([
      supabase.from('enrollments')
        .select('no_in_class, students!inner(student_id, prefix, first_name, last_name)')
        .eq('school_id', s.schoolId).eq('academic_year', year).eq('class', cls)
        .in('status', ['ปกติ', 'ย้ายเข้า']),
      supabase.from('attendance')
        .select('student_id, status, attendance_date')
        .eq('school_id', s.schoolId).eq('class', cls)
        .gte('attendance_date', startDate).lt('attendance_date', endDate),
      fetchHolidaysForMonth(y, m, daysInMonth),
    ]);
    if (enrRes.error) return alert('❌ ' + enrRes.error.message);

    const students = sortByClassAndStudentId((enrRes.data || []).map(e => ({
      ...e.students, no_in_class: e.no_in_class,
      name: `${e.students.prefix || ''}${e.students.first_name || ''} ${e.students.last_name || ''}`.trim(),
    })));
    const attMap = {};
    (attRes.data || []).forEach(r => {
      const d = parseInt(r.attendance_date.slice(8, 10));
      if (!attMap[r.student_id]) attMap[r.student_id] = {};
      attMap[r.student_id][d] = r.status;
    });

    const totalStudents = students.length;
    const schoolName = s.school?.name || 'โรงเรียนบ้านแก่ง';

    // Build header row (1-31)
    let thCols = '<th style="width:3%">ที่</th><th style="width:7%">เลขประจำตัว<br>นักเรียน</th><th style="width:18%">ชื่อ-สกุล</th>';
    for (let d = 1; d <= 31; d++) thCols += `<th style="width:2.1%">${d}</th>`;
    thCols += '<th style="width:4%">มา</th><th style="width:4%">ข</th><th style="width:4%">ล</th><th style="width:4%">ป</th>';

    // Build body rows
    let tbody = '';
    students.forEach((stu, idx) => {
      let sumMa = 0, sumKhad = 0, sumLa = 0, sumPuay = 0;
      let row = `<tr>
        <td style="text-align:center;">${idx + 1}</td>
        <td style="text-align:center;">${stu.student_id}</td>
        <td class="text-left nowrap">${stu.name}</td>`;
      for (let d = 1; d <= 31; d++) {
        if (d > daysInMonth) { row += '<td style="background:#f1f5f9;"></td>'; continue; }
        if (holidays[d]) {
          // first student row spans all rows for holiday columns
          if (idx === 0) {
            row += `<td rowspan="${totalStudents}" style="padding:2px;background:#fef2f2;">
              <div class="vertical-text">${holidays[d]}</div></td>`;
          }
        } else {
          const status = attMap[stu.student_id]?.[d] || '';
          let mark = '';
          if (status === 'มา')   { mark = '✔️'; sumMa++; }
          else if (status === 'ขาด')  { mark = 'ข'; sumKhad++; }
          else if (status === 'ลา')   { mark = 'ล'; sumLa++; }
          else if (status === 'ป่วย') { mark = 'ป'; sumPuay++; }
          row += `<td style="text-align:center;">${mark}</td>`;
        }
      }
      row += `<td style="text-align:center;font-weight:bold;">${sumMa}</td>
        <td style="text-align:center;">${sumKhad}</td>
        <td style="text-align:center;">${sumLa}</td>
        <td style="text-align:center;">${sumPuay}</td></tr>`;
      tbody += row;
    });

    const teacherName = s.name || '.............................';
    const dirName     = s.school?.director || '.............................';

    const body = `
      <div class="print-header">
        <h3>${titleMap[actType]} ${schoolName}</h3>
        <h4>ชั้น ${cls} ประจำเดือน ${THAI_MONTHS[m - 1]} ปีการศึกษา ${year}</h4>
      </div>
      <table style="font-size:10px;">
        <thead><tr>${thCols}</tr></thead>
        <tbody>${tbody}</tbody>
      </table>
      <div style="display:flex;justify-content:space-around;margin-top:30px;text-align:center;font-size:12px;">
        <div>
          <div style="border-bottom:1px dotted #000;width:200px;height:18px;margin:0 auto 3px;"></div>
          (${teacherName})<br/>ครูประจำชั้น
        </div>
        <div>
          <div style="border-bottom:1px dotted #000;width:200px;height:18px;margin:0 auto 3px;"></div>
          (${dirName})<br/>ผู้อำนวยการ${schoolName}
        </div>
      </div>`;
    makePrintWindow(body, 'landscape');
  }

  // ── พิมพ์รายชื่อ (เปล่า) ──
  async function printBlankList() {
    if (!cls) return alert('⚠️ เลือกชั้นเรียนก่อน');
    let list = studentsForBlank;
    if (!list.length) {
      const { data, error } = await supabase.from('enrollments')
        .select('no_in_class, students!inner(student_id, prefix, first_name, last_name)')
        .eq('school_id', s.schoolId).eq('academic_year', year).eq('class', cls)
        .in('status', ['ปกติ', 'ย้ายเข้า']);
      if (error) return alert('❌ ' + error.message);
      list = sortByClassAndStudentId((data || []).map(e => ({
        ...e.students, no_in_class: e.no_in_class,
        name: `${e.students.prefix || ''}${e.students.first_name || ''} ${e.students.last_name || ''}`.trim(),
      })));
    }
    if (!list.length) return alert('⚠️ ไม่พบรายชื่อนักเรียน');

    const schoolName = s.school?.name || 'โรงเรียนบ้านแก่ง';
    let tbody = '';
    list.forEach((stu, idx) => {
      tbody += `<tr>
        <td style="height:32px;text-align:center;">${idx + 1}</td>
        <td style="text-align:center;">${stu.student_id}</td>
        <td class="text-left nowrap">${stu.name}</td>
        <td></td><td></td><td></td><td></td><td></td><td></td><td></td>
      </tr>`;
    });

    const body = `
      <div class="print-header">
        <h3>แบบบันทึกรายชื่อนักเรียน ชั้น ${cls}</h3>
        <h4>${schoolName} ปีการศึกษา ${year}</h4>
      </div>
      <table>
        <thead>
          <tr>
            <th style="width:5%">ที่</th>
            <th style="width:12%">เลขประจำตัว</th>
            <th style="width:28%">ชื่อ-สกุล</th>
            <th></th><th></th><th></th><th></th><th></th><th></th><th></th>
          </tr>
        </thead>
        <tbody>${tbody}</tbody>
      </table>`;
    makePrintWindow(body, 'portrait');
  }

  if (!s) return null;

  return (
    <>
      <TopBar />
      <div className="wrap">
        <div className="card">

          {/* ── Header ── */}
          <div style={{
            background: 'linear-gradient(135deg,#2563eb,#3b82f6)',
            borderRadius: 12, padding: '14px 18px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: 16,
          }}>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>📝 เช็คชื่อนักเรียน</div>
            <button onClick={() => router.back()} style={{
              background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.5)',
              color: '#fff', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13,
            }}>◄ ย้อนกลับ</button>
          </div>

          {/* ── เลือกชั้น + ปีการศึกษา ── */}
          <div className="row" style={{ marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600 }}>🚨 เลือกชั้นเรียน:</label>
              <select value={cls} onChange={e => { setCls(e.target.value); setStudentsForBlank([]); }}>
                <option value="">-- เลือกชั้นเรียน --</option>
                {CLASSES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600 }}>📅 ปีการศึกษา:</label>
              <select value={year} disabled style={{ background: '#f1f5f9' }}>
                <option>{year}</option>
              </select>
            </div>
          </div>

          {/* ── วันที่ + บันทึกวันหยุด ── */}
          <div className="row" style={{ marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600 }}>📅 วันที่:</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div style={{ display: 'flex', alignItems: 'end' }}>
              <button onClick={() => { setHolidayName(''); setShowHolidayModal(true); }} style={{
                background: 'linear-gradient(135deg,#dc2626,#ef4444)',
                color: '#fff', border: 'none', padding: '10px 18px',
                borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: 14,
              }}>🔴 บันทึกวันหยุด</button>
            </div>
          </div>

          {/* ── เมนูรายงาน ── */}
          <div style={{
            background: '#f0fdf4', border: '1px solid #86efac',
            borderRadius: 10, padding: 12, marginBottom: 12,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#166534', marginBottom: 8 }}>📋 เมนูรายงาน</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <GreenBtn onClick={openDailyModal}>📊 สถิติรายวัน</GreenBtn>
              <GreenBtn onClick={() => printMonthly('Attendance')}>📅 สรุป (เดือน)</GreenBtn>
              <GreenBtn onClick={() => printMonthly('Milk')}>🥛 สรุปดื่มนม</GreenBtn>
              <GreenBtn onClick={() => printMonthly('Teeth')}>🦷 สรุปแปรงฟัน</GreenBtn>
              <GreenBtn onClick={printBlankList}>📋 รายชื่อ (เปล่า)</GreenBtn>
            </div>
          </div>

          {/* ── ตารางเช็คชื่อ + แดชบอร์ดสถิติ ── */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            <button onClick={() => setMode('monthly')} style={{
              flex: 1, background: mode === 'monthly'
                ? 'linear-gradient(135deg,#312e81,#6d28d9)' : 'linear-gradient(135deg,#4f46e5,#818cf8)',
              color: '#fff', border: 'none', padding: '14px',
              borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: 15,
            }}>📝 ตารางเช็คชื่อ</button>
            <button onClick={() => setMode('dashboard')} style={{
              flex: 1, background: mode === 'dashboard'
                ? 'linear-gradient(135deg,#1e3a5f,#1d4ed8)' : 'linear-gradient(135deg,#2563eb,#60a5fa)',
              color: '#fff', border: 'none', padding: '14px',
              borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: 15,
            }}>✅ แดชบอร์ดสถิติ</button>
          </div>

          {/* ── กลับหน้าเช็คชื่อ ── */}
          {mode !== 'attendance' && (
            <button onClick={() => setMode('attendance')} style={{
              marginBottom: 12, background: '#e2e8f0', border: 'none',
              padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13,
            }}>← กลับหน้าเช็คชื่อ</button>
          )}

          {/* ── Main Content ── */}
          {mode === 'attendance' && (
            <AttendanceSection
              session={s} year={year} cls={cls} date={date}
              onStudentsLoad={setStudentsForBlank}
              showToast={showToast}
            />
          )}
          {mode === 'monthly' && (
            <MonthlySection
              session={s} year={year} cls={cls} date={date}
              fetchHolidays={fetchHolidaysForMonth}
            />
          )}
          {mode === 'dashboard' && (
            <DashboardSection session={s} year={year} date={date} />
          )}

        </div>
      </div>

      {/* ── Modal: บันทึกวันหยุด ── */}
      {showHolidayModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 340, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h3 style={{ margin: '0 0 14px', color: '#dc2626' }}>🔴 บันทึกวันหยุด</h3>
            <div style={{ fontSize: 13, marginBottom: 10 }}>
              วันที่: <b>{thaiDateFull(date)}</b>
            </div>
            <input
              value={holidayName}
              onChange={e => setHolidayName(e.target.value)}
              placeholder="ชื่อวันหยุด เช่น วันแม่แห่งชาติ"
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, marginBottom: 14, boxSizing: 'border-box' }}
              onKeyDown={e => e.key === 'Enter' && saveHoliday()}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={saveHoliday} disabled={savingHoliday} style={{ flex: 1, background: '#dc2626', color: '#fff', border: 'none', padding: '10px', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
                {savingHoliday ? '⏳ กำลังบันทึก...' : '💾 บันทึก'}
              </button>
              <button onClick={() => setShowHolidayModal(false)} style={{ flex: 1, background: '#e2e8f0', border: 'none', padding: '10px', borderRadius: 8, cursor: 'pointer' }}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: พิมพ์สถิติรายวัน ── */}
      {showDailyModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 14px', color: '#1e40af' }}>📊 พิมพ์สถิติรายวัน</h3>
            <div style={{ fontSize: 13, marginBottom: 14 }}>วันที่: <b>{thaiDateFull(date)}</b></div>

            {[['ครูเวร 1', t1, setT1], ['ครูเวร 2', t2, setT2], ['ครูเวร 3', t3, setT3]].map(([label, val, setter]) => (
              <div key={label} style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>{label}</label>
                <select value={val} onChange={e => setter(e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13 }}>
                  <option value="">-- เลือกครูเวร (ไม่บังคับ) --</option>
                  {teacherList.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            ))}

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>เหตุการณ์ประจำวัน</label>
              <textarea
                value={dailyNote}
                onChange={e => setDailyNote(e.target.value)}
                rows={3}
                placeholder="- เหตุการณ์ปกติ -"
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={processDailyPrint} disabled={printingDaily} style={{ flex: 1, background: '#1e40af', color: '#fff', border: 'none', padding: '10px', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
                {printingDaily ? '⏳ กำลังโหลด...' : '🖨️ ดำเนินการพิมพ์'}
              </button>
              <button onClick={() => setShowDailyModal(false)} style={{ flex: 1, background: '#e2e8f0', border: 'none', padding: '10px', borderRadius: 8, cursor: 'pointer' }}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast show">{toast}</div>}
    </>
  );
}

// ── ปุ่มเขียว (เมนูรายงาน) ──
function GreenBtn({ onClick, children }) {
  return (
    <button onClick={onClick} style={{
      background: 'linear-gradient(135deg,#059669,#10b981)',
      color: '#fff', border: 'none', padding: '9px 14px',
      borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 13,
    }}>
      {children}
    </button>
  );
}

// ────────────────────────────────────────
// หน้าเช็คชื่อรายวัน
// ────────────────────────────────────────
const STATUS_BG = { 'มา':'#dcfce7','ขาด':'#fee2e2','ลา':'#fef3c7','ป่วย':'#dbeafe' };
const STATUS_FG = { 'มา':'#166534','ขาด':'#991b1b','ลา':'#92400e','ป่วย':'#1e40af' };

function AttendanceSection({ session, year, cls, date, onStudentsLoad, showToast }) {
  const [students,  setStudents]  = useState([]);
  const [statusMap, setStatusMap] = useState({});
  const [loaded,    setLoaded]    = useState(false);
  const [saving,    setSaving]    = useState(false);

  // auto-load เมื่อ cls หรือ date เปลี่ยน
  useEffect(() => {
    if (cls && date) doLoad();
    else { setStudents([]); setStatusMap({}); setLoaded(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cls, date]);

  async function doLoad() {
    const [enrRes, attRes] = await Promise.all([
      supabase.from('enrollments')
        .select('no_in_class, students!inner(student_id, prefix, first_name, last_name)')
        .eq('school_id', session.schoolId).eq('academic_year', year).eq('class', cls)
        .in('status', ['ปกติ', 'ย้ายเข้า']),
      supabase.from('attendance')
        .select('student_id, status, remark')
        .eq('school_id', session.schoolId).eq('class', cls).eq('attendance_date', date),
    ]);
    if (enrRes.error) return alert('❌ ' + enrRes.error.message);
    const list = sortByClassAndStudentId((enrRes.data || []).map(e => ({
      ...e.students, class: cls, no_in_class: e.no_in_class,
    })));
    setStudents(list);
    onStudentsLoad(list.map(s => ({
      ...s, name: `${s.prefix || ''}${s.first_name || ''} ${s.last_name || ''}`.trim(),
    })));
    const map = {};
    (attRes.data || []).forEach(r => { map[r.student_id] = { status: r.status, remark: r.remark || '' }; });
    setStatusMap(map);
    setLoaded(true);
  }

  function setStat(sid, key, val) {
    setStatusMap(p => ({ ...p, [sid]: { ...(p[sid] || { status: 'มา', remark: '' }), [key]: val } }));
  }
  function markAll() {
    const m = {};
    students.forEach(stu => { m[stu.student_id] = { status: 'มา', remark: statusMap[stu.student_id]?.remark || '' }; });
    setStatusMap(m);
  }

  async function save() {
    if (!students.length) return alert('⚠️ ยังไม่มีรายชื่อ');
    setSaving(true);
    const rows = students.map(stu => ({
      school_id: session.schoolId, attendance_date: date,
      student_id: stu.student_id, class: cls,
      status: statusMap[stu.student_id]?.status || 'มา',
      remark: statusMap[stu.student_id]?.remark || null,
      recorded_by: session.name, updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from('attendance').upsert(rows, { onConflict: 'school_id,attendance_date,student_id' });
    setSaving(false);
    if (error) return alert('❌ ' + error.message);
    showToast(`✅ บันทึก ${rows.length} คน สำเร็จ`);
  }

  // สรุปสถานะ
  const summary = { มา: 0, ขาด: 0, ลา: 0, ป่วย: 0 };
  students.forEach(stu => {
    const st = statusMap[stu.student_id]?.status || 'มา';
    if (summary[st] !== undefined) summary[st]++;
  });

  if (!cls) return (
    <div style={{ textAlign: 'center', padding: '30px 0', color: '#94a3b8' }}>
      <div style={{ fontSize: 40 }}>👆</div>
      <div style={{ marginTop: 8, fontSize: 14 }}>เลือกชั้นเรียนเพื่อเช็คชื่อ</div>
    </div>
  );

  return (
    <div>
      {/* summary badges */}
      {students.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          {STATUSES.map(st => (
            <div key={st} style={{ background: STATUS_BG[st], color: STATUS_FG[st], borderRadius: 8, padding: '5px 12px', fontWeight: 700, fontSize: 13 }}>
              {st}: {summary[st]}
            </div>
          ))}
          <div style={{ background: '#e0e7ff', color: '#3730a3', borderRadius: 8, padding: '5px 12px', fontWeight: 700, fontSize: 13 }}>
            รวม: {students.length}
          </div>
        </div>
      )}

      {students.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button className="secondary" onClick={markAll} style={{ fontSize: 13 }}>✅ มาทั้งห้อง</button>
          <button className="success" onClick={save} disabled={saving}>
            {saving ? '⏳ กำลังบันทึก...' : '💾 บันทึกเช็คชื่อ'}
          </button>
        </div>
      )}

      {students.length > 0 ? (
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: 44, textAlign: 'center' }}>เลขที่</th>
                <th>เลขประจำตัวนักเรียน</th>
                <th>ชื่อ-สกุล</th>
                <th style={{ minWidth: 220 }}>สถานะ</th>
                <th>หมายเหตุ</th>
              </tr>
            </thead>
            <tbody>
              {students.map((stu, i) => {
                const cur = statusMap[stu.student_id] || { status: 'มา', remark: '' };
                return (
                  <tr key={stu.student_id}>
                    <td style={{ textAlign: 'center' }}>{i + 1}</td>
                    <td style={{ textAlign: 'center' }}><b>{stu.student_id}</b></td>
                    <td>{stu.prefix}{stu.first_name} {stu.last_name}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {STATUSES.map(st => (
                          <button key={st} onClick={() => setStat(stu.student_id, 'status', st)} style={{
                            padding: '4px 9px', border: 'none', borderRadius: 6,
                            fontSize: 12, fontWeight: 700, cursor: 'pointer',
                            background: cur.status === st ? STATUS_BG[st] : '#f1f5f9',
                            color: cur.status === st ? STATUS_FG[st] : '#64748b',
                            boxShadow: cur.status === st ? `0 0 0 2px ${STATUS_FG[st]}` : 'none',
                            transition: 'all 0.1s',
                          }}>{st}</button>
                        ))}
                      </div>
                    </td>
                    <td>
                      <input value={cur.remark} onChange={e => setStat(stu.student_id, 'remark', e.target.value)} placeholder="(ไม่มี)" style={{ width: '100%', fontSize: 12 }} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : loaded ? (
        <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>ไม่พบรายชื่อนักเรียนในชั้น {cls}</div>
      ) : null}
    </div>
  );
}

// ────────────────────────────────────────
// ตารางเช็คชื่อรายเดือน (on-screen grid)
// ────────────────────────────────────────
const SYM = { 'มา':'✓','ขาด':'X','ลา':'ล','ป่วย':'ป' };

function MonthlySection({ session, year, cls, date, fetchHolidays }) {
  const [grid, setGrid]       = useState(null);
  const [loading, setLoading] = useState(false);

  async function doLoad() {
    if (!cls || !date) return alert('⚠️ เลือกชั้นเรียนและวันที่ก่อน');
    setLoading(true);
    const [yStr, mStr] = date.split('-');
    const y = parseInt(yStr), m = parseInt(mStr);
    const daysInMonth = new Date(y, m, 0).getDate();
    const startDate   = `${yStr}-${mStr}-01`;
    const endDate     = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;

    const [enrRes, attRes, holidays] = await Promise.all([
      supabase.from('enrollments')
        .select('students!inner(student_id, prefix, first_name, last_name)')
        .eq('school_id', session.schoolId).eq('academic_year', year).eq('class', cls)
        .in('status', ['ปกติ', 'ย้ายเข้า']),
      supabase.from('attendance')
        .select('student_id, status, attendance_date')
        .eq('school_id', session.schoolId).eq('class', cls)
        .gte('attendance_date', startDate).lt('attendance_date', endDate),
      fetchHolidays(y, m, daysInMonth),
    ]);
    setLoading(false);
    if (enrRes.error) return alert('❌ ' + enrRes.error.message);

    const students = sortByClassAndStudentId((enrRes.data || []).map(e => ({
      ...e.students, class: cls,
      name: `${e.students.prefix || ''}${e.students.first_name || ''} ${e.students.last_name || ''}`.trim(),
    })));
    const attMap = {};
    (attRes.data || []).forEach(r => {
      const d = parseInt(r.attendance_date.slice(8, 10));
      if (!attMap[r.student_id]) attMap[r.student_id] = {};
      attMap[r.student_id][d] = r.status;
    });
    setGrid({ students, holidays, attMap, y, m, daysInMonth });
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button onClick={doLoad} disabled={loading}>
          {loading ? '⏳ กำลังโหลด...' : '📋 โหลดตารางเช็คชื่อ'}
        </button>
      </div>

      {grid && (
        <div style={{ overflowX: 'auto', marginTop: 4 }}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>
            <b style={{ color: STATUS_FG['มา'] }}>✓</b> มา ·{' '}
            <b style={{ color: STATUS_FG['ขาด'] }}>X</b> ขาด ·{' '}
            <b style={{ color: STATUS_FG['ลา'] }}>ล</b> ลา ·{' '}
            <b style={{ color: STATUS_FG['ป่วย'] }}>ป</b> ป่วย
          </div>
          <table style={{ fontSize: 11 }}>
            <thead>
              <tr>
                <th style={{ position: 'sticky', left: 0, background: '#f1f5f9', minWidth: 30 }}>#</th>
                <th style={{ position: 'sticky', left: 30, background: '#f1f5f9', minWidth: 80 }}>เลขประจำตัว</th>
                <th style={{ position: 'sticky', left: 110, background: '#f1f5f9', minWidth: 130 }}>ชื่อ</th>
                {Array.from({ length: grid.daysInMonth }, (_, i) => i + 1).map(d => (
                  <th key={d} style={{
                    minWidth: 28, textAlign: 'center',
                    background: grid.holidays[d] ? '#fef2f2' : '#f1f5f9',
                    color: grid.holidays[d] ? '#991b1b' : '#1e293b',
                  }}>{d}</th>
                ))}
                <th style={{ textAlign: 'center', minWidth: 36, background: '#dcfce7', color: '#166534' }}>มา</th>
                <th style={{ textAlign: 'center', minWidth: 36, background: '#fee2e2', color: '#991b1b' }}>ขาด</th>
              </tr>
            </thead>
            <tbody>
              {grid.students.map((stu, idx) => {
                let cntMa = 0, cntKhad = 0;
                return (
                  <tr key={stu.student_id}>
                    <td style={{ textAlign: 'center', position: 'sticky', left: 0, background: '#fff' }}>{idx + 1}</td>
                    <td style={{ textAlign: 'center', position: 'sticky', left: 30, background: '#fff' }}><b>{stu.student_id}</b></td>
                    <td style={{ position: 'sticky', left: 110, background: '#fff' }}>{stu.name}</td>
                    {Array.from({ length: grid.daysInMonth }, (_, i) => i + 1).map(d => {
                      const status = grid.attMap[stu.student_id]?.[d];
                      if (status === 'มา') cntMa++;
                      else if (status === 'ขาด') cntKhad++;
                      const sym = grid.holidays[d] ? '—' : (SYM[status] || '·');
                      const fg  = grid.holidays[d] ? '#dc2626' : STATUS_FG[status];
                      return (
                        <td key={d} style={{
                          textAlign: 'center', fontWeight: status ? 700 : 400,
                          color: fg || '#cbd5e1',
                          background: grid.holidays[d] ? '#fef9f9' : 'transparent',
                        }}>{sym}</td>
                      );
                    })}
                    <td style={{ textAlign: 'center', fontWeight: 700, color: '#166534' }}>{cntMa}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: '#991b1b' }}>{cntKhad}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────
// แดชบอร์ดสถิติ
// ────────────────────────────────────────
function DashboardSection({ session, year, date }) {
  const [stats,      setStats]      = useState(null);
  const [grandTotal, setGrandTotal] = useState(null);
  const [loading,    setLoading]    = useState(false);

  useEffect(() => { if (date) doLoad(); }, [date]); // eslint-disable-line

  async function doLoad() {
    setLoading(true);
    const [enrRes, attRes] = await Promise.all([
      supabase.from('enrollments')
        .select('class, students!inner(student_id, gender)')
        .eq('school_id', session.schoolId).eq('academic_year', year)
        .in('status', ['ปกติ', 'ย้ายเข้า']),
      supabase.from('attendance')
        .select('class, student_id, status')
        .eq('school_id', session.schoolId).eq('attendance_date', date),
    ]);
    setLoading(false);
    if (enrRes.error || attRes.error) return alert('❌ ' + (enrRes.error || attRes.error).message);

    const result = {};
    CLASSES.forEach(c => {
      result[c] = { total: { m: 0, f: 0, all: 0 } };
      STATUSES.forEach(st => { result[c][st] = { m: 0, f: 0, all: 0 }; });
    });
    const attBySid = {};
    (attRes.data || []).forEach(r => { attBySid[r.student_id] = r.status; });
    (enrRes.data || []).forEach(e => {
      const c = e.class; if (!result[c]) return;
      const g = e.students.gender === 'ญ' ? 'f' : 'm';
      result[c].total[g]++; result[c].total.all++;
      const st = attBySid[e.students.student_id];
      if (st && result[c][st]) { result[c][st][g]++; result[c][st].all++; }
    });

    const gt = { total: { m: 0, f: 0, all: 0 } };
    STATUSES.forEach(st => { gt[st] = { m: 0, f: 0, all: 0 }; });
    CLASSES.forEach(c => {
      ['total', ...STATUSES].forEach(k => {
        gt[k].m += result[c][k].m; gt[k].f += result[c][k].f; gt[k].all += result[c][k].all;
      });
    });
    setStats(result); setGrandTotal(gt);
  }

  const dateLabel = date ? new Date(date).toLocaleDateString('th-TH', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', calendar: 'buddhist',
  }) : '';

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button onClick={doLoad} disabled={loading}>{loading ? '⏳ กำลังโหลด...' : '📋 โหลดสถิติ'}</button>
      </div>

      {stats && grandTotal && (
        <>
          <h3 style={{ margin: '0 0 12px', color: '#1e40af' }}>สถิติประจำ{dateLabel}</h3>

          {/* summary cards */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            {[
              { label: 'นักเรียนทั้งหมด', val: grandTotal.total.all, bg: '#e0e7ff', fg: '#3730a3' },
              { label: 'มาเรียน',   val: grandTotal['มา'].all,   bg: '#dcfce7', fg: '#166534' },
              { label: 'ขาด',       val: grandTotal['ขาด'].all,  bg: '#fee2e2', fg: '#991b1b' },
              { label: 'ลา',        val: grandTotal['ลา'].all,   bg: '#fef3c7', fg: '#92400e' },
              { label: 'ป่วย',      val: grandTotal['ป่วย'].all, bg: '#dbeafe', fg: '#1e40af' },
            ].map(item => (
              <div key={item.label} style={{
                background: item.bg, color: item.fg, borderRadius: 10,
                padding: '10px 18px', textAlign: 'center', fontWeight: 700,
              }}>
                <div style={{ fontSize: 26 }}>{item.val}</div>
                <div style={{ fontSize: 12 }}>{item.label}</div>
              </div>
            ))}
          </div>

          {/* percent bar per class */}
          <div style={{ marginBottom: 14 }}>
            {CLASSES.map(c => {
              const d   = stats[c];
              const pct = d.total.all > 0 ? Math.round((d['มา'].all / d.total.all) * 100) : 0;
              return (
                <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 40, fontSize: 12, fontWeight: 700, color: '#374151' }}>{c}</div>
                  <div style={{ flex: 1, background: '#f1f5f9', borderRadius: 4, height: 18, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, background: pct >= 80 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444', height: '100%', borderRadius: 4, transition: 'width 0.5s' }} />
                  </div>
                  <div style={{ width: 80, fontSize: 12, color: '#374151' }}>
                    {d['มา'].all}/{d.total.all} ({pct}%)
                  </div>
                </div>
              );
            })}
          </div>

          {/* table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f1f5f9' }}>
                  <th rowSpan="2">ชั้น</th>
                  <th colSpan="3" style={{ background: '#e0e7ff' }}>จำนวนนักเรียน</th>
                  <th colSpan="3" style={{ background: '#dcfce7' }}>มา</th>
                  <th colSpan="3" style={{ background: '#fee2e2' }}>ขาด</th>
                  <th colSpan="3" style={{ background: '#fef3c7' }}>ลา</th>
                  <th colSpan="3" style={{ background: '#dbeafe' }}>ป่วย</th>
                  <th rowSpan="2" style={{ background: '#e0e7ff' }}>%มา</th>
                </tr>
                <tr>
                  {Array(5).fill(['ช','ญ','รวม']).flat().map((h, i) => (
                    <th key={i} style={{ textAlign: 'center', fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CLASSES_KG.map(c => <StatRow key={c} label={'ชั้น ' + c} data={stats[c]} />)}
                <StatRow label="รวมอนุบาล" data={sumGroup(stats, CLASSES_KG)} bold />
                {CLASSES_PR.map(c => <StatRow key={c} label={'ชั้น ' + c} data={stats[c]} />)}
                <StatRow label="รวมประถมศึกษา" data={sumGroup(stats, CLASSES_PR)} bold />
                <StatRow label="รวมทั้งสิ้น" data={grandTotal} bold />
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function sumGroup(stats, classes) {
  const s = { total: { m: 0, f: 0, all: 0 } };
  STATUSES.forEach(st => { s[st] = { m: 0, f: 0, all: 0 }; });
  classes.forEach(c => {
    ['total', ...STATUSES].forEach(k => {
      s[k].m += stats[c][k].m; s[k].f += stats[c][k].f; s[k].all += stats[c][k].all;
    });
  });
  return s;
}

function StatRow({ label, data, bold }) {
  const pct = data.total.all > 0 ? ((data['มา'].all / data.total.all) * 100).toFixed(1) + '%' : '—';
  return (
    <tr style={bold ? { background: '#f1f5f9', fontWeight: 700 } : {}}>
      <td>{label}</td>
      <Cells data={data.total} />
      <Cells data={data['มา']}   color={STATUS_FG['มา']}   />
      <Cells data={data['ขาด']}  color={STATUS_FG['ขาด']}  />
      <Cells data={data['ลา']}   color={STATUS_FG['ลา']}   />
      <Cells data={data['ป่วย']} color={STATUS_FG['ป่วย']} />
      <td style={{ textAlign: 'center', fontWeight: 700, color: '#4338ca' }}>{pct}</td>
    </tr>
  );
}

function Cells({ data, color }) {
  return (
    <>
      <td style={{ textAlign: 'center', color }}>{data.m || ''}</td>
      <td style={{ textAlign: 'center', color }}>{data.f || ''}</td>
      <td style={{ textAlign: 'center', fontWeight: 700, color }}>{data.all || ''}</td>
    </>
  );
}
