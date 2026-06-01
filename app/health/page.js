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

function calcBMI(w, h) {
  if (!w || !h || h <= 0) return null;
  return w / ((h / 100) ** 2);
}
function bmiLabel(bmi, gender, ageYears) {
  if (bmi === null) return '';
  // เกณฑ์อย่างง่าย (ใช้เกณฑ์ WHO สำหรับเด็ก)
  if (bmi < 14) return { label: 'ผอม', color: '#3b82f6' };
  if (bmi < 18.5) return { label: 'ปกติ', color: '#16a34a' };
  if (bmi < 23) return { label: 'เริ่มอ้วน', color: '#f59e0b' };
  return { label: 'อ้วน', color: '#dc2626' };
}

export default function HealthPage() {
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
          <h2 style={{ margin: '0 0 14px' }}>🩺 น้ำหนัก-ส่วนสูง (BMI) ปีการศึกษา {year}</h2>
          <HealthMain session={s} year={year} />
        </div>
      </div>
    </>
  );
}

function HealthMain({ session, year }) {
  const [cls, setCls] = useState(session.role === 'teacher' && session.class ? session.class : '');
  const [sem, setSem] = useState(1);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');

  async function load() {
    if (!cls) return alert('⚠️ เลือกชั้น');
    setLoading(true);
    const [enrRes, healthRes] = await Promise.all([
      supabase.from('enrollments')
        .select('students!inner(student_id, prefix, first_name, last_name, gender, dob)')
        .eq('school_id', session.schoolId).eq('academic_year', year).eq('class', cls)
        .in('status', ['ปกติ', 'ย้ายเข้า']),
      supabase.from('health')
        .select('student_id, weight, height')
        .eq('school_id', session.schoolId).eq('academic_year', year)
        .eq('semester', sem).eq('class', cls),
    ]);
    setLoading(false);
    if (enrRes.error) return alert('❌ ' + enrRes.error.message);

    const hMap = {};
    (healthRes.data || []).forEach(r => { hMap[r.student_id] = { weight: r.weight, height: r.height }; });

    const list = (enrRes.data || []).map(e => ({
      ...e.students,
      class: cls,
      weight: hMap[e.students.student_id]?.weight ?? '',
      height: hMap[e.students.student_id]?.height ?? '',
    }));
    setRows(sortByClassAndStudentId(list));
  }

  function setVal(sid, field, val) {
    setRows(prev => prev.map(r => r.student_id === sid ? { ...r, [field]: val } : r));
  }

  async function save() {
    const records = rows
      .filter(r => r.weight !== '' || r.height !== '')
      .map(r => ({
        school_id: session.schoolId,
        academic_year: year,
        semester: sem,
        student_id: r.student_id,
        class: cls,
        weight: r.weight !== '' ? parseFloat(r.weight) : null,
        height: r.height !== '' ? parseFloat(r.height) : null,
        recorded_by: session.name,
        updated_at: new Date().toISOString(),
      }));
    if (!records.length) return alert('ไม่มีข้อมูลที่จะบันทึก');
    const { error } = await supabase.from('health').upsert(records, { onConflict: 'school_id,academic_year,semester,student_id' });
    if (error) return alert('❌ ' + error.message);
    setToast(`✅ บันทึก ${records.length} คนแล้ว`);
    setTimeout(() => setToast(''), 2000);
    load();
  }

  function doPrint() {
    const schoolName = session.school?.name || 'โรงเรียนบ้านแก่ง';
    const counts = { ผอม:0, ปกติ:0, เริ่มอ้วน:0, อ้วน:0 };
    const tbody = rows.map((r, i) => {
      const bmi = calcBMI(parseFloat(r.weight), parseFloat(r.height));
      const res = bmi ? bmiLabel(bmi) : null;
      if (res?.label) counts[res.label] = (counts[res.label]||0) + 1;
      return `<tr>
        <td>${i+1}</td><td>${r.student_id}</td>
        <td class="text-left">${r.prefix||''}${r.first_name} ${r.last_name}</td>
        <td>${r.weight||''}</td><td>${r.height||''}</td>
        <td>${bmi ? bmi.toFixed(1) : ''}</td>
        <td>${res ? res.label : ''}</td>
      </tr>`;
    }).join('');
    const note = makeNoteBox(`<b>📊 สรุป (รวม ${rows.length} คน):</b><br/>
      - ผอม: ${counts.ผอม} คน &nbsp; - ปกติ: ${counts.ปกติ} คน &nbsp; - เริ่มอ้วน: ${counts.เริ่มอ้วน} คน &nbsp; - อ้วน: ${counts.อ้วน} คน`);
    const html = `
      ${makePrintHeader(schoolName, 'รายงานน้ำหนัก-ส่วนสูง', `ชั้น ${cls} ภาคเรียนที่ ${sem} ปีการศึกษา ${year}`)}
      <table>
        <thead><tr><th>#</th><th>เลขประจำตัว</th><th>ชื่อ-สกุล</th><th>น้ำหนัก(กก.)</th><th>ส่วนสูง(ซม.)</th><th>BMI</th><th>แปลผล</th></tr></thead>
        <tbody>${tbody}</tbody>
      </table>
      ${note}
      ${makeSignature2(session.name, session.school?.director, schoolName)}
    `;
    makePrintWindow(html, 'portrait');
  }

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
        <div>
          <label style={{ fontSize: 12, fontWeight: 600 }}>ภาคเรียน</label>
          <select value={sem} onChange={e => setSem(Number(e.target.value))}>
            <option value={1}>ภาคเรียนที่ 1</option>
            <option value={2}>ภาคเรียนที่ 2</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'end' }}>
          <button onClick={load} disabled={loading}>{loading ? '⏳...' : '📋 โหลด'}</button>
          {rows.length > 0 && <button className="success" onClick={save}>💾 บันทึก</button>}
          {rows.length > 0 && <button className="secondary" onClick={doPrint}>🖨️ พิมพ์</button>}
        </div>
      </div>

      {rows.length > 0 && (
        <div style={{ overflowX: 'auto', marginTop: 14 }}>
          <table>
            <thead>
              <tr>
                <th>#</th><th>เลขประจำตัว</th><th>ชื่อ-สกุล</th>
                <th>น้ำหนัก (กก.)</th><th>ส่วนสูง (ซม.)</th>
                <th>BMI</th><th>แปลผล</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const bmi = calcBMI(parseFloat(r.weight), parseFloat(r.height));
                const res = bmi ? bmiLabel(bmi) : null;
                return (
                  <tr key={r.student_id}>
                    <td>{i+1}</td>
                    <td><b>{r.student_id}</b></td>
                    <td>{r.prefix}{r.first_name} {r.last_name}</td>
                    <td>
                      <input type="number" step="0.1" min="0" max="200"
                        value={r.weight} onChange={e => setVal(r.student_id, 'weight', e.target.value)}
                        style={{ width: 80, textAlign: 'right', padding: '4px 6px' }}
                        placeholder="กก."
                      />
                    </td>
                    <td>
                      <input type="number" step="0.1" min="0" max="250"
                        value={r.height} onChange={e => setVal(r.student_id, 'height', e.target.value)}
                        style={{ width: 80, textAlign: 'right', padding: '4px 6px' }}
                        placeholder="ซม."
                      />
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>
                      {bmi ? bmi.toFixed(1) : '—'}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: res?.color }}>
                      {res?.label || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {toast && <div className="toast show">{toast}</div>}
    </>
  );
}
