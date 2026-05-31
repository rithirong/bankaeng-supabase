'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { getSession, isAdmin } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';

// ── column mapping: ชื่อ header ภาษาไทย → field ใน Supabase ──
const COLUMN_MAP = {
  // เลขประจำตัว
  'เลขประจำตัวนักเรียน': 'student_id', 'เลขประจำตัว': 'student_id', 'StudentID': 'student_id',
  // ชั้น / เลขที่
  'ชั้น': 'class', 'ชั้นเรียน': 'class', 'Class': 'class',
  'เลขที่': 'no_in_class', 'ลำดับที่': 'no_in_class', 'No': 'no_in_class',
  // ชื่อ
  'คำนำหน้า': 'prefix', 'คำนำหน้าชื่อ': 'prefix', 'Prefix': 'prefix',
  'ชื่อ': 'first_name', 'FirstName': 'first_name',
  'นามสกุล': 'last_name', 'LastName': 'last_name',
  // ข้อมูลส่วนตัว
  'เพศ': 'gender', 'Gender': 'gender',
  'วันเกิด': 'dob', 'DOB': 'dob', 'วัน/เดือน/ปีเกิด': 'dob',
  'น้ำหนัก': 'weight', 'Weight': 'weight',
  'ส่วนสูง': 'height', 'Height': 'height',
  'หมู่เลือด': 'blood_type', 'กรุ๊ปเลือด': 'blood_type', 'Blood': 'blood_type',
  'เลขประจำตัวประชาชน': 'national_id', 'เลขบัตรประชาชน': 'national_id', 'NationalID': 'national_id',
  // ที่อยู่
  'บ้านเลขที่': 'address_no', 'เลขที่บ้าน': 'address_no', 'ที่อยู่': 'address_no',
  'หมู่': 'village', 'หมู่ที่': 'village', 'หมู่บ้าน': 'village',
  'ซอย': 'alley', 'ตรอก': 'alley',
  'ตำบล': 'subdistrict', 'แขวง': 'subdistrict',
  'อำเภอ': 'district', 'เขต': 'district',
  'จังหวัด': 'province',
  // บิดา
  'ชื่อบิดา': 'father_name', 'บิดา': 'father_name', 'ชื่อพ่อ': 'father_name', 'พ่อ': 'father_name',
  'อาชีพบิดา': 'father_job', 'อาชีพพ่อ': 'father_job',
  'เบอร์โทรบิดา': 'father_phone', 'โทรบิดา': 'father_phone', 'เบอร์พ่อ': 'father_phone', 'โทรพ่อ': 'father_phone',
  // มารดา
  'ชื่อมารดา': 'mother_name', 'มารดา': 'mother_name', 'ชื่อแม่': 'mother_name', 'แม่': 'mother_name',
  'อาชีพมารดา': 'mother_job', 'อาชีพแม่': 'mother_job',
  'เบอร์โทรมารดา': 'mother_phone', 'โทรมารดา': 'mother_phone', 'เบอร์แม่': 'mother_phone', 'โทรแม่': 'mother_phone',
    // ห้อง / กลุ่มเลือด variants
    'ห้อง': 'room',
    'กลุ่มเลือด': 'blood_type',
    // ศาสนา / สัญชาติ
    'ศาสนา': 'religion',
    'เชื้อชาติ': 'ethnicity',
    'สัญชาติ': 'nationality',
    'ความด้อยโอกาส': 'disadvantage',
    // ที่อยู่เพิ่ม
    'ถนน/ซอย': 'street',
    'ถนน': 'street',
    // ผู้ปกครอง
    'ชื่อผู้ปกครอง': 'guardian_first_name',
    'นามสกุลผู้ปกครอง': 'guardian_last_name',
    'อาชีพของผู้ปกครอง': 'guardian_job',
    'อาชีพผู้ปกครอง': 'guardian_job',
    'เบอร์โทรผู้ปกครอง': 'guardian_phone',
    'โทรผู้ปกครอง': 'guardian_phone',
    'ความเกี่ยวข้องของผู้ปกครองกับนักเรียน': 'guardian_relation',
    'ความเกี่ยวข้อง': 'guardian_relation',
    // บิดา/มารดา variant ที่ตรงกับ sheet จริง
    'นามสกุลบิดา': 'father_last_name',
    'อาชีพของบิดา': 'father_job',
    'นามสกุลมารดา': 'mother_last_name',
    'อาชีพของมารดา': 'mother_job',

      // ข้อมูลเพิ่มเติม (AK-AO)
  'ปีการศึกษาปัจจุบัน': 'current_academic_year',
  'ปีการศึกษา': 'current_academic_year',
  'URL รูปถ่าย': 'photo_url',
  'URL รูป': 'photo_url',
  'รูปถ่าย': 'photo_url',
  'PhotoURL': 'photo_url',
  'สถานะ': 'status',
  'Status': 'status',
  'GPS พิกัดบ้าน': 'gps_coords',
  'GPS พิกัด': 'gps_coords',
  'พิกัดบ้าน': 'gps_coords',
  'พิกัด': 'gps_coords',
  'GPS': 'gps_coords',

  'ยังไม่สามารถจำหน่ายได้ (3.1.8)': 'status',
};

const DB_FIELDS = [
  'student_id', 'national_id', 'class', 'room', 'no_in_class',
  'prefix', 'first_name', 'last_name', 'gender', 'dob',
  'weight', 'height', 'blood_type',
  'religion', 'ethnicity', 'nationality', 'disadvantage',
  'address_no', 'village', 'alley', 'street', 'subdistrict', 'district', 'province',
  'father_name', 'father_last_name', 'father_job', 'father_phone',
  'mother_name', 'mother_last_name', 'mother_job', 'mother_phone',
  'guardian_first_name', 'guardian_last_name', 'guardian_job', 'guardian_phone', 'guardian_relation',
  'current_academic_year', 'photo_url', 'status', 'gps_coords',
];

// ── parse DOB ทุก format (Date / DD-MM-YYYY / DD/MM/YYYY / digits) → ISO YYYY-MM-DD คริสต์ ──
function parseDob(val) {
  if (!val) return null;
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    let y = val.getFullYear();
    if (y > 2500) y -= 543;
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const str = String(val).trim();
  let dd, mm, yy;
  if (str.indexOf('/') > -1) {
    const p = str.split('/');
    if (p.length !== 3) return null;
    [dd, mm, yy] = [parseInt(p[0]), parseInt(p[1]), parseInt(p[2])];
  } else if (str.indexOf('-') > -1) {
    const p = str.split('-');
    if (p.length !== 3) return null;
    const f = parseInt(p[0]);
    if (f > 31) { yy = f; mm = parseInt(p[1]); dd = parseInt(p[2]); }
    else { dd = f; mm = parseInt(p[1]); yy = parseInt(p[2]); }
  } else {
    const digits = str.replace(/\D/g, '');
    if (digits.length !== 8) return null;
    dd = parseInt(digits.substring(0, 2));
    mm = parseInt(digits.substring(2, 4));
    yy = parseInt(digits.substring(4, 8));
  }
  if (yy > 2500) yy -= 543;
  if (isNaN(yy) || isNaN(mm) || isNaN(dd)) return null;
  return `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

export default function ImportPage() {
  const router = useRouter();
  const [s, setS] = useState(null);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [headers, setHeaders] = useState([]);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(null);

  useEffect(() => {
    const sess = getSession();
    if (!sess) { router.replace('/'); return; }
    if (sess.role !== 'admin') {
      alert('เฉพาะ admin');
      router.replace('/dashboard');
      return;
    }
    setS(sess);
  }, [router]);

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setStatus('📂 กำลังอ่านไฟล์...');
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf);
    const ws = wb.Sheets[wb.SheetNames[0]];
    
    // raw: false → คืนค่าตามที่แสดงใน Excel เป็น string (Date cells ก็จะเป็น "01/11/2557" ไม่ใช่ Date object)
const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
    if (!data.length) { setStatus('❌ ไฟล์ว่าง'); return; }

// 🔍 Detect metadata row (DMC file มี row 1 เป็น metadata 1 cell)
let headerRowIdx = 0;
const row0NonEmpty = data[0].filter(c => String(c).trim() !== '').length;
const row1NonEmpty = data[1] ? data[1].filter(c => String(c).trim() !== '').length : 0;
// ถ้า row 0 มีไม่ถึง 3 cell ที่ไม่ว่าง แต่ row 1 มีเยอะ = row 1 เป็น header
if (row0NonEmpty < 3 && row1NonEmpty >= 5) {
  headerRowIdx = 1;
}
const headerRow = data[headerRowIdx].map(h => String(h).trim());
const dataRows = data.slice(headerRowIdx + 1).filter(r => r.some(c => String(c).trim() !== ''));

    // 🤖 auto-map (first occurrence wins)
    const m = {};
    headerRow.forEach((h, idx) => {
      const field = COLUMN_MAP[h];
      if (field && m[field] === undefined) m[field] = idx;
    });

    // 🧠 Smart fix: ถ้ามี 2 column ชื่อเหมือนกันแต่ค่าต่างกัน
    // เช่น "เลขประจำตัวนักเรียน" สองอัน — อันนึง 4 หลัก (student จริง), อีกอัน 13 หลัก (national)
    function avgDigitLen(colIdx) {
      const samples = dataRows.slice(0, 20)
        .map(r => String(r[colIdx] ?? '').replace(/\D/g, ''))
        .filter(s => s.length > 0);
      if (!samples.length) return 0;
      return samples.reduce((sum, s) => sum + s.length, 0) / samples.length;
    }

    // ถ้า student_id mapped ไปคอลัมน์ที่มีเลข ≥ 10 หลัก → น่าจะเป็น national_id แทน
    if (m.student_id !== undefined && avgDigitLen(m.student_id) >= 10) {
      const dupHeader = headerRow[m.student_id];
      for (let i = 0; i < headerRow.length; i++) {
        if (i === m.student_id) continue;
        if (headerRow[i] === dupHeader && avgDigitLen(i) > 0 && avgDigitLen(i) <= 8) {
          if (m.national_id === undefined) m.national_id = m.student_id;
          m.student_id = i;
          break;
        }
      }
    }

    // ในทางกลับกัน: ถ้า national_id ยังไม่มีและมี column ชื่อ "เลขประจำตัวนักเรียน" ซ้ำที่ยาว 13 หลัก
    if (m.national_id === undefined && m.student_id !== undefined) {
      const sidHeader = headerRow[m.student_id];
      for (let i = 0; i < headerRow.length; i++) {
        if (i === m.student_id) continue;
        if (headerRow[i] === sidHeader && avgDigitLen(i) >= 10) {
          m.national_id = i;
          break;
        }
      }
    }

    setHeaders(headerRow);
    setRows(dataRows);
    setMapping(m);
    setStatus(`✅ อ่านไฟล์ได้ ${dataRows.length} แถว, จับคู่ ${Object.keys(m).length} field อัตโนมัติ`);
  }

  async function doImport() {
    if (!rows.length) return alert('ยังไม่มีข้อมูล');
    if (mapping.student_id === undefined || mapping.first_name === undefined) {
      return alert('⚠️ ต้องมีอย่างน้อย: เลขประจำตัว + ชื่อ');
    }

    setProgress({ done: 0, total: rows.length, ok: 0, fail: 0 });

    // เตรียม records
    const records = rows.map(r => {
      const obj = { school_id: s.schoolId, status: 'ปกติ' };
      Object.entries(mapping).forEach(([field, colIdx]) => {
        const v = r[colIdx];
        if (v === '' || v === undefined || v === null) return;
        if (field === 'dob') obj[field] = parseDob(v);
        else if (field === 'no_in_class' || field === 'current_academic_year') {
          const n = parseInt(v); obj[field] = isNaN(n) ? null : n;
        }
        else if (field === 'weight' || field === 'height') {
          const n = parseFloat(v); obj[field] = isNaN(n) ? null : n;
        }
        else obj[field] = String(v).trim();
      });
      return obj;
    }).filter(r => r.student_id && r.first_name);

    // 🧠 SMART MERGE STEP: ถ้า record มี national_id ที่ match กับ student เดิม
    // ที่มี student_id ต่างกัน (= temp ID เดิม) → rename student_id ก่อน
    // (FK ON UPDATE CASCADE จะ propagate ไปยัง enrollments + attendance)
    let renamed = 0;
    const withNationalId = records.filter(r => r.national_id);
    if (withNationalId.length > 0) {
      const nids = withNationalId.map(r => r.national_id);
      const { data: existing } = await supabase
        .from('students')
        .select('id, student_id, national_id')
        .eq('school_id', s.schoolId)
        .in('national_id', nids);
      const byNid = {};
      (existing || []).forEach(e => { byNid[e.national_id] = e; });
      for (const rec of withNationalId) {
        const old = byNid[rec.national_id];
        if (old && old.student_id !== rec.student_id) {
          // เจอเด็กเดิม (national_id ตรง) แต่ student_id ต่าง → rename
          const { error } = await supabase
            .from('students')
            .update({ student_id: rec.student_id })
            .eq('id', old.id);
          if (!error) renamed++;
          else console.error('rename failed', old.student_id, '→', rec.student_id, error);
        }
      }
    }

    // bulk upsert ทีละ batch 100 records
    const BATCH = 100;
    let ok = 0, fail = 0;
    for (let i = 0; i < records.length; i += BATCH) {
      const batch = records.slice(i, i + BATCH);
      const { error } = await supabase
        .from('students')
        .upsert(batch, { onConflict: 'school_id,student_id' });
      if (error) { fail += batch.length; console.error(error); }
      else ok += batch.length;
      setProgress({ done: Math.min(i + BATCH, records.length), total: records.length, ok, fail });
    }
    const renameMsg = renamed > 0 ? ` · 🔄 rename เลขประจำตัว ${renamed} คน` : '';
    setStatus(`✅ Import เสร็จ: สำเร็จ ${ok}, ล้มเหลว ${fail}${renameMsg}`);
  }

  if (!s) return null;

  return (
    <>
      <TopBar />
      <div className="wrap">
        <div className="card">
          <h2>📥 นำเข้าข้อมูลนักเรียนจาก Excel</h2>

          <div style={{ background: '#fef3c7', padding: 12, borderRadius: 8, marginBottom: 14, fontSize: 13 }}>
            <b>📋 วิธีใช้:</b>
            <ol style={{ margin: '6px 0 0 20px' }}>
              <li>เปิด Google Sheets เดิม → tab <b>Student</b></li>
              <li>เมนู <b>File → Download → Microsoft Excel (.xlsx)</b></li>
              <li>อัปโหลดไฟล์ที่นี่ → ตรวจสอบ → กดนำเข้า</li>
            </ol>
          </div>

          <input type="file" accept=".xlsx,.xls" onChange={handleFile} />

          {status && <div style={{ marginTop: 14, padding: 10, background: '#f1f5f9', borderRadius: 8 }}>{status}</div>}

          {headers.length > 0 && (
            <>
              <h3 style={{ marginTop: 20 }}>🔍 จับคู่คอลัมน์</h3>
              {(() => {
  const mapped = new Set(Object.values(mapping));
  const unmapped = headers.filter((h, i) => !mapped.has(i) && String(h).trim());
  if (unmapped.length === 0) return null;
  return (
    <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', padding: 10, borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
      ⚠️ <b>คอลัมน์ที่ยังไม่ได้จับคู่</b> ({unmapped.length}): {unmapped.join(', ')}<br/>
      <span style={{ color: '#92400e' }}>ถ้าต้องการ import คอลัมน์เหล่านี้ ให้เลือกใน dropdown ด้านล่าง</span>
    </div>
  );
})()}
              <table>
                <thead>
                  <tr><th>Field ใน DB</th><th>คอลัมน์จาก Excel</th></tr>
                </thead>
                <tbody>
                {DB_FIELDS.map(field => (
                    <tr key={field}>
                      <td><b>{field}</b></td>
                      <td>
                        <select value={mapping[field] ?? ''} onChange={e => setMapping(m => ({ ...m, [field]: e.target.value === '' ? undefined : parseInt(e.target.value) }))}>
                          <option value="">— ไม่ใช้ —</option>
                          {headers.map((h, i) => {
  const sample = rows.find(r => r[i] != null && String(r[i]).trim() !== '')?.[i];
  const sampleStr = sample !== undefined ? `  →  "${String(sample).slice(0, 25)}"` : '';
  return <option key={i} value={i}>{h}{sampleStr}</option>;
})}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h3 style={{ marginTop: 20 }}>👀 Preview 5 แถวแรก</h3>
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      {['student_id','class','prefix','first_name','last_name','gender','dob'].map(f => <th key={f}>{f}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 5).map((r, i) => (
                      <tr key={i}>
                        {['student_id','class','prefix','first_name','last_name','gender','dob'].map(f => {
                          const idx = mapping[f];
                          let v = idx === undefined ? '—' : r[idx];
                          if (f === 'dob' && v) v = parseDob(v) || '⚠️ parse ไม่ได้';
                          return <td key={f}>{String(v ?? '—')}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: 16 }}>
                <button className="success" onClick={doImport}>📤 นำเข้า {rows.length} แถว</button>
              </div>
            </>
          )}

          {progress && (
            <div style={{ marginTop: 14, padding: 12, background: '#dbeafe', borderRadius: 8 }}>
              <b>กำลัง import:</b> {progress.done}/{progress.total} ({progress.ok} ✅ / {progress.fail} ❌)
              <div style={{ background: '#e5e7eb', height: 8, borderRadius: 4, marginTop: 6, overflow: 'hidden' }}>
                <div style={{ background: '#16a34a', width: `${(progress.done / progress.total) * 100}%`, height: '100%' }} />
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}