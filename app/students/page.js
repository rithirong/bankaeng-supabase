'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { getSession, isAdmin } from '@/lib/auth';
import { useYear } from '@/lib/year';
import { sortByClassAndStudentId } from '@/lib/sort';
import { supabase } from '@/lib/supabase';

const CLASSES_FILTER = ['ทั้งหมด', 'อ.2', 'อ.3', 'ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6'];
const CLASSES = ['อ.2', 'อ.3', 'ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6'];
const PREFIXES = ['เด็กชาย', 'เด็กหญิง', 'นาย', 'นางสาว'];

export default function StudentsPage() {
  const router = useRouter();
  const [s, setS] = useState(null);
  const [year] = useYear();
  const [students, setStudents] = useState([]);
  const [filter, setFilter] = useState('ทั้งหมด');
  const [search, setSearch] = useState('');
  const [loadMs, setLoadMs] = useState(null);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null); // 'new' หรือ student object
  const [toast, setToast] = useState('');
  const admin = isAdmin();

  useEffect(() => {
    const sess = getSession();
    if (!sess) { router.replace('/'); return; }
    setS(sess);
  }, [router]);

  useEffect(() => { if (s) load(); }, [s, year]);

  async function load() {
    const t0 = performance.now();
    const { data, error } = await supabase
      .from('enrollments')
      .select('class, no_in_class, status, students!inner(*)')
      .eq('school_id', s.schoolId)
      .eq('academic_year', year)
      .in('status', ['ปกติ', 'ย้ายเข้า']);
    setLoadMs(Math.round(performance.now() - t0));
    if (error) return alert('❌ ' + error.message);

    const list = (data || []).map(e => ({
      ...e.students,
      class: e.class,
      no_in_class: e.no_in_class,
      enrollment_status: e.status,
    }));
    // เรียงตามชั้น (อ.2 → ป.6) แล้วเลขประจำตัวภายในชั้น
    setStudents(sortByClassAndStudentId(list));
  }

  function showToast(m) { setToast(m); setTimeout(() => setToast(''), 2200); }

  async function saveStudent(form, isNew) {
    // เตรียม payload
    const payload = { ...form, school_id: s.schoolId };
    delete payload.id; delete payload.created_at; delete payload.updated_at;
    delete payload.enrollment_status;
    // class + no_in_class จะไปอยู่ใน enrollments แทน
    const enrClass = payload.class;
    const enrNo = payload.no_in_class;
    delete payload.class; delete payload.no_in_class;
    if (!payload.status) payload.status = 'ปกติ';

    let stuId;
    if (isNew) {
      const { data, error } = await supabase.from('students').insert(payload).select('id').single();
      if (error) return alert('❌ ' + error.message);
      stuId = data.id;
    } else {
      const { error } = await supabase.from('students').update(payload).eq('id', editing.id);
      if (error) return alert('❌ ' + error.message);
    }

    // upsert enrollment ของปีปัจจุบัน
    const enrPayload = {
      school_id: s.schoolId,
      student_id: payload.student_id,
      academic_year: year,
      class: enrClass,
      no_in_class: enrNo,
      status: isNew ? 'ย้ายเข้า' : 'ปกติ',
    };
    Object.keys(enrPayload).forEach(k => enrPayload[k] === undefined && delete enrPayload[k]);
    const { error: eErr } = await supabase.from('enrollments').upsert(enrPayload, { onConflict: 'school_id,student_id,academic_year' });
    if (eErr) return alert('⚠️ บันทึก enrollment ไม่สำเร็จ: ' + eErr.message);

    showToast(isNew ? '✅ เพิ่มนักเรียนใหม่แล้ว' : '✅ บันทึกการแก้ไขแล้ว');
    setEditing(null);
    setSelected(null);
    load();
  }

  async function deleteStudent(student) {
    if (!confirm(`ลบนักเรียน ${student.first_name} ${student.last_name} (${student.student_id})?\n⚠️ จะลบทั้งประวัติการเรียน + เช็คชื่อทั้งหมด`)) return;
    const { error } = await supabase.from('students').delete().eq('id', student.id);
    if (error) return alert('❌ ' + error.message);
    showToast('🗑️ ลบนักเรียนเรียบร้อย');
    setSelected(null);
    load();
  }

  if (!s) return null;

  const filtered = students.filter(stu => {
    if (filter !== 'ทั้งหมด' && stu.class !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = (stu.student_id + ' ' + stu.first_name + ' ' + stu.last_name).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return (
    <>
      <TopBar />
      <div className="wrap">
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <h2 style={{ margin: 0 }}>👥 ข้อมูลนักเรียน ปีการศึกษา {year}</h2>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {loadMs !== null && <span className="timing">⚡ {loadMs} ms</span>}
              {admin && (
                <button className="success" onClick={() => setEditing('new')}>➕ เพิ่มนักเรียน</button>
              )}
            </div>
          </div>

          <div className="row" style={{ marginTop: 14 }}>
            <select value={filter} onChange={e => setFilter(e.target.value)} style={{ maxWidth: 160 }}>
              {CLASSES_FILTER.map(c => <option key={c}>{c}</option>)}
            </select>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 ค้นหา (เลขประจำตัว / ชื่อ / นามสกุล)" />
          </div>

          <div style={{ marginTop: 10, fontSize: 13, color: '#64748b' }}>
            แสดง {filtered.length} จาก {students.length} คน · 💡 คลิกที่แถวเพื่อดูข้อมูลเต็ม
          </div>

          <div style={{ overflowX: 'auto', marginTop: 10 }}>
            <table>
              <thead>
                <tr>
                  <th>#</th><th>เลขประจำตัว</th><th>ชั้น</th><th width="60" style={{textAlign:'center'}}>เลขที่</th>
                  <th>ชื่อ-สกุล</th><th>เพศ</th><th>วันเกิด</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((stu, i) => (
                  <tr key={stu.id} onClick={() => setSelected(stu)} style={{ cursor: 'pointer' }}>
                    <td>{i + 1}</td>
                    <td><b>{stu.student_id}</b></td>
                    <td>{stu.class}{stu.room ? `/${stu.room}` : ''}</td>
                    <td style={{ textAlign: 'center', color: '#64748b' }}>{stu.no_in_class || '—'}</td>
                    <td>{stu.prefix}{stu.first_name} {stu.last_name}</td>
                    <td>{stu.gender}</td>
                    <td>{stu.dob ? new Date(stu.dob).toLocaleDateString('th-TH') : '—'}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan="7" style={{ textAlign: 'center', color: '#94a3b8', padding: 20 }}>— ไม่มีนักเรียนในปี {year} —</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selected && !editing && (
        <DetailModal
          student={selected}
          year={year}
          admin={admin}
          onClose={() => setSelected(null)}
          onEdit={() => setEditing(selected)}
          onDelete={() => deleteStudent(selected)}
        />
      )}
      {editing && (
        <EditModal
          mode={editing === 'new' ? 'new' : 'edit'}
          initial={editing === 'new' ? null : selected}
          year={year}
          onClose={() => setEditing(null)}
          onSave={(form) => saveStudent(form, editing === 'new')}
        />
      )}
      {toast && <div className="toast show">{toast}</div>}
    </>
  );
}

// ────────────────────────────────────────
// DetailModal — ดูข้อมูล
// ────────────────────────────────────────
function DetailModal({ student, year, admin, onClose, onEdit, onDelete }) {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    supabase.from('enrollments')
      .select('academic_year, class, no_in_class, status')
      .eq('school_id', student.school_id)
      .eq('student_id', student.student_id)
      .order('academic_year', { ascending: false })
      .then(({ data }) => setHistory(data || []));
  }, [student]);

  const fullName = `${student.prefix || ''}${student.first_name || ''} ${student.last_name || ''}`.trim();
  const dobTh = student.dob ? new Date(student.dob).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric', calendar: 'buddhist' }) : '—';
  let age = '—';
  if (student.dob) {
    const d = new Date(student.dob); const now = new Date();
    let yrs = now.getFullYear() - d.getFullYear();
    const mo = now.getMonth() - d.getMonth();
    if (mo < 0 || (mo === 0 && now.getDate() < d.getDate())) yrs--;
    age = `${yrs} ปี`;
  }
  const addr = [
    student.address_no && `บ้านเลขที่ ${student.address_no}`,
    student.village && `หมู่ ${student.village}`,
    student.alley && `ซ.${student.alley}`,
    student.street && `ถ.${student.street}`,
    student.subdistrict && `ต.${student.subdistrict}`,
    student.district && `อ.${student.district}`,
    student.province && `จ.${student.province}`,
  ].filter(Boolean).join(' ') || '—';

  return (
    <div onClick={onClose} style={modalOverlay}>
      <div onClick={e => e.stopPropagation()} className="card" style={modalBox}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>เลขประจำตัว {student.student_id}</div>
            <h2 style={{ margin: '4px 0 2px', color: '#1e40af' }}>{fullName || '—'}</h2>
            <div style={{ color: '#64748b', fontSize: 14 }}>
              ปี {year}: ชั้น {student.class}{student.no_in_class ? `/${student.no_in_class}` : ''}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {admin && <button onClick={onEdit} style={{ padding: '6px 14px' }}>✏️ แก้ไข</button>}
            {admin && <button className="danger" onClick={onDelete} style={{ padding: '6px 14px' }}>🗑️ ลบ</button>}
            <button className="secondary" onClick={onClose} style={{ padding: '6px 14px' }}>✖ ปิด</button>
          </div>
        </div>

        <Section title="📅 ประวัติการศึกษา">
          <div style={{ gridColumn: '1/-1' }}>
            <table style={{ fontSize: 13 }}>
              <thead><tr><th>ปี</th><th>ชั้น</th><th>เลขที่</th><th>สถานะ</th></tr></thead>
              <tbody>
                {history.length ? history.map((h, i) => (
                  <tr key={i} style={{ background: h.academic_year === year ? '#dbeafe' : 'transparent' }}>
                    <td><b>{h.academic_year}</b></td>
                    <td>{h.class}</td>
                    <td>{h.no_in_class || '—'}</td>
                    <td>
                      <span style={{
                        padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                        background: h.status === 'จบ' ? '#dcfce7' : ['ย้ายออก','ลาออก'].includes(h.status) ? '#fee2e2' : '#dbeafe',
                        color: h.status === 'จบ' ? '#166534' : ['ย้ายออก','ลาออก'].includes(h.status) ? '#991b1b' : '#1e40af',
                      }}>{h.status}</span>
                    </td>
                  </tr>
                )) : <tr><td colSpan="4" style={{ color: '#94a3b8', textAlign: 'center' }}>— ไม่มีประวัติ —</td></tr>}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="🧑 ข้อมูลส่วนตัว">
          <V label="เลขบัตรประชาชน" v={student.national_id} />
          <V label="เพศ" v={student.gender} />
          <V label="วันเกิด" v={dobTh} />
          <V label="อายุ" v={age} />
          <V label="ศาสนา" v={student.religion} />
          <V label="เชื้อชาติ" v={student.ethnicity} />
          <V label="สัญชาติ" v={student.nationality} />
          <V label="หมู่เลือด" v={student.blood_type} />
          <V label="น้ำหนัก" v={student.weight ? `${student.weight} กก.` : null} />
          <V label="ส่วนสูง" v={student.height ? `${student.height} ซม.` : null} />
          <V label="ความด้อยโอกาส" v={student.disadvantage} />
        </Section>
        <Section title="🏠 ที่อยู่"><V label="ที่อยู่" v={addr} wide /></Section>
        <Section title="👨 บิดา">
          <V label="ชื่อ" v={[student.father_name, student.father_last_name].filter(Boolean).join(' ')} />
          <V label="อาชีพ" v={student.father_job} />
          <V label="เบอร์โทร" v={student.father_phone} />
        </Section>
        <Section title="👩 มารดา">
          <V label="ชื่อ" v={[student.mother_name, student.mother_last_name].filter(Boolean).join(' ')} />
          <V label="อาชีพ" v={student.mother_job} />
          <V label="เบอร์โทร" v={student.mother_phone} />
        </Section>
        <Section title="👪 ผู้ปกครอง">
          <V label="ชื่อ" v={[student.guardian_first_name, student.guardian_last_name].filter(Boolean).join(' ')} />
          <V label="ความเกี่ยวข้อง" v={student.guardian_relation} />
          <V label="อาชีพ" v={student.guardian_job} />
          <V label="เบอร์โทร" v={student.guardian_phone} />
        </Section>
      </div>
    </div>
  );
}

// ────────────────────────────────────────
// EditModal — เพิ่ม/แก้ไข
// ────────────────────────────────────────
function EditModal({ mode, initial, year, onClose, onSave }) {
  const blank = {
    student_id: '', national_id: '',
    class: 'ป.1', room: '', no_in_class: '',
    prefix: 'เด็กชาย', first_name: '', last_name: '',
    gender: 'ช', dob: '',
    weight: '', height: '', blood_type: '',
    religion: 'พุทธ', ethnicity: 'ไทย', nationality: 'ไทย', disadvantage: '',
    address_no: '', village: '', alley: '', street: '', subdistrict: '', district: '', province: '',
    father_name: '', father_last_name: '', father_job: '', father_phone: '',
    mother_name: '', mother_last_name: '', mother_job: '', mother_phone: '',
    guardian_first_name: '', guardian_last_name: '', guardian_job: '', guardian_phone: '', guardian_relation: '',
    photo_url: '', gps_coords: '', status: 'ปกติ',
  };
  const init = mode === 'new' ? blank : { ...blank, ...initial, dob: initial?.dob?.slice(0, 10) || '' };
  const [f, setF] = useState(init);
  const [saving, setSaving] = useState(false);
  const [maxInClass, setMaxInClass] = useState(null);

  // 🤖 ตอนเลือกชั้น (สำหรับ new student) — query หาเลขที่สูงสุดของห้อง → suggest เลขถัดไป
  useEffect(() => {
    if (mode !== 'new' || !f.class) return;
    const sess = getSession();
    if (!sess) return;
    supabase.from('enrollments')
      .select('no_in_class')
      .eq('school_id', sess.schoolId)
      .eq('academic_year', year)
      .eq('class', f.class)
      .in('status', ['ปกติ', 'ย้ายเข้า'])
      .order('no_in_class', { ascending: false, nullsFirst: false })
      .limit(1)
      .then(({ data }) => {
        const max = data?.[0]?.no_in_class || 0;
        setMaxInClass(max);
        // auto-fill ถ้ายังว่าง
        if (!f.no_in_class) setF(p => ({ ...p, no_in_class: max + 1 }));
      });
  }, [f.class, mode, year]);

  function ch(k, v) { setF(p => ({ ...p, [k]: v })); }

  async function submit(e) {
    e.preventDefault();
    if (!f.student_id?.trim() || !f.first_name?.trim() || !f.last_name?.trim() || !f.class) {
      return alert('⚠️ ต้องกรอก: เลขประจำตัว, ชื่อ, นามสกุล, ชั้น');
    }
    setSaving(true);
    // convert empty strings → null for numeric/optional fields
    const cleaned = { ...f };
    ['weight','height','no_in_class'].forEach(k => {
      if (cleaned[k] === '' || cleaned[k] === undefined) cleaned[k] = null;
      else if (k === 'no_in_class') cleaned[k] = parseInt(cleaned[k]) || null;
      else cleaned[k] = parseFloat(cleaned[k]) || null;
    });
    if (!cleaned.dob) cleaned.dob = null;
    Object.keys(cleaned).forEach(k => { if (cleaned[k] === '') cleaned[k] = null; });
    await onSave(cleaned);
    setSaving(false);
  }

  return (
    <div onClick={onClose} style={modalOverlay}>
      <form onClick={e => e.stopPropagation()} onSubmit={submit} className="card" style={modalBox}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ margin: 0, color: '#1e40af' }}>
            {mode === 'new' ? '➕ เพิ่มนักเรียนใหม่' : `✏️ แก้ไข: ${f.first_name} ${f.last_name}`}
          </h2>
          <button type="button" className="secondary" onClick={onClose} style={{ padding: '6px 14px' }}>✖</button>
        </div>

        {mode === 'new' && (
          <div style={{ background: '#dbeafe', padding: 10, borderRadius: 8, fontSize: 13, color: '#1e40af', marginBottom: 12 }}>
            ⚡ จะเพิ่มเป็น <b>"ย้ายเข้า"</b> ใน enrollment ปี {year}
          </div>
        )}

        <ESection title="🧑 ข้อมูลพื้นฐาน">
          <I label="เลขประจำตัว *" v={f.student_id} onChange={v => ch('student_id', v)} disabled={mode === 'edit'} />
          <I label="เลขบัตรประชาชน" v={f.national_id} onChange={v => ch('national_id', v)} />
          <SelectF label="คำนำหน้า" v={f.prefix} options={PREFIXES} onChange={v => ch('prefix', v)} />
          <I label="ชื่อ *" v={f.first_name} onChange={v => ch('first_name', v)} />
          <I label="นามสกุล *" v={f.last_name} onChange={v => ch('last_name', v)} />
          <SelectF label="เพศ" v={f.gender} options={['ช','ญ']} onChange={v => ch('gender', v)} />
          <I label="วันเกิด" v={f.dob} onChange={v => ch('dob', v)} type="date" />
          <I label="หมู่เลือด" v={f.blood_type} onChange={v => ch('blood_type', v)} />
        </ESection>

        <ESection title="📚 ชั้นเรียน">
          <SelectF label="ชั้น *" v={f.class} options={CLASSES} onChange={v => ch('class', v)} />
          <I label="ห้อง" v={f.room} onChange={v => ch('room', v)} />
          <div>
            <label style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
              เลขที่ {maxInClass !== null && mode === 'new' && <span style={{ color: '#16a34a' }}>· แนะนำ {maxInClass + 1} (ห้องนี้มี {maxInClass} คน)</span>}
            </label>
            <input
              type="number"
              value={f.no_in_class ?? ''}
              onChange={e => ch('no_in_class', e.target.value)}
              style={{ padding: '6px 10px', fontSize: 13 }}
            />
          </div>
        </ESection>

        <ESection title="🌏 ข้อมูลส่วนตัว">
          <I label="ศาสนา" v={f.religion} onChange={v => ch('religion', v)} />
          <I label="เชื้อชาติ" v={f.ethnicity} onChange={v => ch('ethnicity', v)} />
          <I label="สัญชาติ" v={f.nationality} onChange={v => ch('nationality', v)} />
          <I label="น้ำหนัก (กก.)" v={f.weight} onChange={v => ch('weight', v)} type="number" step="0.1" />
          <I label="ส่วนสูง (ซม.)" v={f.height} onChange={v => ch('height', v)} type="number" step="0.1" />
          <I label="ความด้อยโอกาส" v={f.disadvantage} onChange={v => ch('disadvantage', v)} />
        </ESection>

        <ESection title="🏠 ที่อยู่">
          <I label="บ้านเลขที่" v={f.address_no} onChange={v => ch('address_no', v)} />
          <I label="หมู่" v={f.village} onChange={v => ch('village', v)} />
          <I label="ซอย" v={f.alley} onChange={v => ch('alley', v)} />
          <I label="ถนน" v={f.street} onChange={v => ch('street', v)} />
          <I label="ตำบล" v={f.subdistrict} onChange={v => ch('subdistrict', v)} />
          <I label="อำเภอ" v={f.district} onChange={v => ch('district', v)} />
          <I label="จังหวัด" v={f.province} onChange={v => ch('province', v)} />
        </ESection>

        <ESection title="👨 บิดา">
          <I label="ชื่อ" v={f.father_name} onChange={v => ch('father_name', v)} />
          <I label="นามสกุล" v={f.father_last_name} onChange={v => ch('father_last_name', v)} />
          <I label="อาชีพ" v={f.father_job} onChange={v => ch('father_job', v)} />
          <I label="เบอร์โทร" v={f.father_phone} onChange={v => ch('father_phone', v)} />
        </ESection>

        <ESection title="👩 มารดา">
          <I label="ชื่อ" v={f.mother_name} onChange={v => ch('mother_name', v)} />
          <I label="นามสกุล" v={f.mother_last_name} onChange={v => ch('mother_last_name', v)} />
          <I label="อาชีพ" v={f.mother_job} onChange={v => ch('mother_job', v)} />
          <I label="เบอร์โทร" v={f.mother_phone} onChange={v => ch('mother_phone', v)} />
        </ESection>

        <ESection title="👪 ผู้ปกครอง (ถ้าต่างจากบิดา/มารดา)">
          <I label="ชื่อ" v={f.guardian_first_name} onChange={v => ch('guardian_first_name', v)} />
          <I label="นามสกุล" v={f.guardian_last_name} onChange={v => ch('guardian_last_name', v)} />
          <I label="ความเกี่ยวข้อง" v={f.guardian_relation} onChange={v => ch('guardian_relation', v)} />
          <I label="อาชีพ" v={f.guardian_job} onChange={v => ch('guardian_job', v)} />
          <I label="เบอร์โทร" v={f.guardian_phone} onChange={v => ch('guardian_phone', v)} />
        </ESection>

        <ESection title="📍 ข้อมูลเพิ่มเติม">
          <I label="URL รูปถ่าย" v={f.photo_url} onChange={v => ch('photo_url', v)} wide />
          <I label="พิกัด GPS" v={f.gps_coords} onChange={v => ch('gps_coords', v)} />
        </ESection>

        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button type="submit" className="success" style={{ flex: 1 }} disabled={saving}>
            {saving ? '⏳ กำลังบันทึก...' : '💾 บันทึก'}
          </button>
          <button type="button" className="secondary" onClick={onClose} style={{ flex: 1 }} disabled={saving}>✖ ยกเลิก</button>
        </div>
      </form>
    </div>
  );
}

// ────────────────────────────────────────
// Helpers
// ────────────────────────────────────────
const modalOverlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 };
const modalBox = { width: '100%', maxWidth: 800, margin: 0, maxHeight: '92vh', overflowY: 'auto' };

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <h3 style={{ margin: '0 0 8px', fontSize: 15, color: '#1e293b', borderBottom: '2px solid #e2e8f0', paddingBottom: 4 }}>{title}</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>{children}</div>
    </div>
  );
}
function V({ label, v, wide }) {
  const val = v && String(v).trim() ? v : '—';
  return (
    <div style={{ gridColumn: wide ? '1/-1' : 'auto' }}>
      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 14, color: val === '—' ? '#cbd5e1' : '#0f172a', marginTop: 2 }}>{val}</div>
    </div>
  );
}
function ESection({ title, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <h3 style={{ margin: '0 0 6px', fontSize: 14, color: '#1e40af', borderBottom: '1px solid #cbd5e1', paddingBottom: 3 }}>{title}</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>{children}</div>
    </div>
  );
}
function I({ label, v, onChange, type = 'text', step, disabled, wide }) {
  return (
    <div style={{ gridColumn: wide ? '1/-1' : 'auto' }}>
      <label style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{label}</label>
      <input
        type={type} step={step} value={v ?? ''} disabled={disabled}
        onChange={e => onChange(e.target.value)}
        style={{ padding: '6px 10px', fontSize: 13, background: disabled ? '#f1f5f9' : '#fff' }}
      />
    </div>
  );
}
function SelectF({ label, v, options, onChange }) {
  return (
    <div>
      <label style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{label}</label>
      <select value={v ?? ''} onChange={e => onChange(e.target.value)} style={{ padding: '6px 10px', fontSize: 13 }}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
