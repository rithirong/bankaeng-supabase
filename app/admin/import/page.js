'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { getSession } from '@/lib/auth';
import { getCurrentAcademicYear } from '@/lib/year';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';

// ── Date parser: รองรับ Date object / DD/MM/YYYY / YYYY-MM-DD (พ.ศ. หรือ ค.ศ.) ──
function parseDate(val) {
  if (!val) return null;
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    let y = val.getFullYear(); if (y > 2500) y -= 543;
    return `${y}-${String(val.getMonth()+1).padStart(2,'0')}-${String(val.getDate()).padStart(2,'0')}`;
  }
  const s = String(val).trim().replace(/[^\d/\-]/g,'');
  let dd,mm,yy;
  if (s.includes('/')) { const p=s.split('/'); [dd,mm,yy]=[parseInt(p[0]),parseInt(p[1]),parseInt(p[2])]; }
  else if (s.includes('-')) { const p=s.split('-'); if(parseInt(p[0])>31){[yy,mm,dd]=[parseInt(p[0]),parseInt(p[1]),parseInt(p[2])]}else{[dd,mm,yy]=[parseInt(p[0]),parseInt(p[1]),parseInt(p[2])]} }
  else { const d=s.replace(/\D/g,''); if(d.length!==8)return null; dd=parseInt(d.slice(0,2));mm=parseInt(d.slice(2,4));yy=parseInt(d.slice(4,8)); }
  if(yy>2500)yy-=543;
  if(isNaN(yy)||isNaN(mm)||isNaN(dd))return null;
  return `${yy}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`;
}
function parseNum(v){ const n=parseFloat(String(v)); return isNaN(n)?null:n; }
function parseInt2(v){ const n=parseInt(String(v)); return isNaN(n)?null:n; }
function str(v){ const s=String(v??'').trim(); return s===''?null:s; }

// ── Sheet type definitions ──────────────────────────────────────────────────
const SHEET_TYPES = [
  { key:'students',     label:'👤 นักเรียน',            icon:'👤', color:'#0e7490' },
  { key:'attendance',   label:'📋 เช็คชื่อ',             icon:'📋', color:'#4338ca' },
  { key:'savings',      label:'💰 ออมทรัพย์',            icon:'💰', color:'#b45309' },
  { key:'coop',         label:'🛒 สหกรณ์ร้านค้า',        icon:'🛒', color:'#065f46' },
  { key:'health',       label:'🩺 น้ำหนัก-ส่วนสูง',      icon:'🩺', color:'#b91c1c' },
  { key:'homevisit',    label:'🏠 เยี่ยมบ้าน',            icon:'🏠', color:'#c2410c' },
  { key:'grades',       label:'📊 ผลการเรียน',            icon:'📊', color:'#15803d' },
  { key:'eval_attr',    label:'⭐ คุณลักษณะ',             icon:'⭐', color:'#a16207' },
  { key:'eval_reading', label:'📖 อ่าน-คิดวิเคราะห์',    icon:'📖', color:'#be123c' },
  { key:'eval_comp',    label:'💡 สมรรถนะ',               icon:'💡', color:'#6b21a8' },
  { key:'deeds',        label:'📒 บันทึกความดี',          icon:'📒', color:'#7c3aed' },
  { key:'scholarships', label:'💸 ทุนการศึกษา',           icon:'💸', color:'#15803d' },
  { key:'certificates', label:'🏆 เกียรติบัตร',            icon:'🏆', color:'#b45309' },
  { key:'trainings',    label:'🎓 อบรม',                  icon:'🎓', color:'#c2410c' },
  { key:'documents',    label:'📝 สารบรรณ',               icon:'📝', color:'#334155' },
];

// ── Column mappings per sheet type (Thai header → field) ───────────────────
const COL_MAPS = {
  students: {
    'เลขประจำตัวนักเรียน':'student_id','เลขประจำตัว':'student_id',
    'ชั้น':'class','ชั้นเรียน':'class','เลขที่':'no_in_class','ลำดับที่':'no_in_class',
    'คำนำหน้า':'prefix','คำนำหน้าชื่อ':'prefix',
    'ชื่อ':'first_name','ชื่อจริง':'first_name',
    'นามสกุล':'last_name',
    'เพศ':'gender','วันเกิด':'dob','วัน/เดือน/ปีเกิด':'dob',
    'น้ำหนัก':'weight','ส่วนสูง':'height','หมู่เลือด':'blood_type','กลุ่มเลือด':'blood_type',
    'เลขบัตรประชาชน':'national_id','เลขประจำตัวประชาชน':'national_id',
    'ศาสนา':'religion','สัญชาติ':'nationality','เชื้อชาติ':'ethnicity',
    'ชื่อบิดา':'father_name','อาชีพบิดา':'father_job','เบอร์โทรบิดา':'father_phone',
    'ชื่อมารดา':'mother_name','อาชีพมารดา':'mother_job','เบอร์โทรมารดา':'mother_phone',
    'ชื่อผู้ปกครอง':'guardian_name','ความเกี่ยวข้อง':'guardian_relation','เบอร์โทรผู้ปกครอง':'guardian_phone','อาชีพผู้ปกครอง':'guardian_job',
    'ที่อยู่':'address','บ้านเลขที่':'address_no','หมู่':'village','ตำบล':'subdistrict','อำเภอ':'district','จังหวัด':'province',
    'สถานะ':'status','ความด้อยโอกาส':'disadvantage',
  },
  attendance: {
    'เลขประจำตัว':'student_id','เลขประจำตัวนักเรียน':'student_id',
    'ชั้น':'class','ชั้นเรียน':'class',
    'วันที่':'attendance_date','วัน/เดือน/ปี':'attendance_date','date':'attendance_date',
    'สถานะ':'status','การมา':'status',
    'หมายเหตุ':'remark','บันทึก':'remark',
  },
  savings: {
    'เลขประจำตัว':'student_id','เลขประจำตัวนักเรียน':'student_id',
    'ชั้น':'class','ชั้นเรียน':'class',
    'วันที่':'txn_date','วัน/เดือน/ปี':'txn_date',
    'ประเภท':'type','ฝาก/ถอน':'type',
    'จำนวนเงิน':'amount','จำนวน':'amount','เงิน':'amount',
    'ปีการศึกษา':'academic_year',
    'หมายเหตุ':'remark',
  },
  coop: {
    'วันที่':'entry_date','วัน/เดือน/ปี':'entry_date',
    'ประเภท':'type','รายรับ/รายจ่าย':'type',
    'หมวดหมู่':'category','ประเภทรายการ':'category',
    'รายการ':'description','รายละเอียด':'description',
    'จำนวนเงิน':'amount','จำนวน':'amount','เงิน':'amount',
  },
  health: {
    'เลขประจำตัว':'student_id','เลขประจำตัวนักเรียน':'student_id',
    'ชั้น':'class','ชั้นเรียน':'class',
    'น้ำหนัก':'weight','น้ำหนัก(กก.)':'weight',
    'ส่วนสูง':'height','ส่วนสูง(ซม.)':'height',
    'ปีการศึกษา':'academic_year','ภาคเรียน':'semester','ภาคเรียนที่':'semester',
  },
  homevisit: {
    'เลขประจำตัว':'student_id','เลขประจำตัวนักเรียน':'student_id',
    'ชั้น':'class','ชั้นเรียน':'class',
    'วันที่เยี่ยม':'visit_date','วันที่':'visit_date',
    'ผู้เยี่ยม':'visitor_name','ครูผู้เยี่ยม':'visitor_name',
    'สถานะ':'visit_status',
    'สภาพบ้าน':'house_condition',
    'ข้อกังวลผู้ปกครอง':'parent_concern',
    'บันทึกครู':'teacher_note','หมายเหตุ':'teacher_note',
    'ปีการศึกษา':'academic_year',
  },
  grades: {
    'เลขประจำตัว':'student_id','เลขประจำตัวนักเรียน':'student_id',
    'ชั้น':'class','ชั้นเรียน':'class',
    'วิชา':'subject','รายวิชา':'subject','ชื่อวิชา':'subject',
    'คะแนน':'score','คะแนนที่ได้':'score',
    'คะแนนเต็ม':'max_score','เต็ม':'max_score',
    'ภาคเรียน':'semester','ภาคเรียนที่':'semester',
    'ปีการศึกษา':'academic_year',
  },
  eval_attr: {
    'เลขประจำตัว':'student_id','เลขประจำตัวนักเรียน':'student_id',
    'ชั้น':'class','ชั้นเรียน':'class',
    'ภาคเรียน':'semester','ภาคเรียนที่':'semester',
    'ปีการศึกษา':'academic_year',
    'รักชาติ':'s1','รักชาติ ศาสน์ กษัตริย์':'s1','ข้อ1':'s1','1':'s1',
    'ซื่อสัตย์':'s2','ซื่อสัตย์สุจริต':'s2','ข้อ2':'s2','2':'s2',
    'มีวินัย':'s3','ข้อ3':'s3','3':'s3',
    'ใฝ่เรียน':'s4','ใฝ่เรียนรู้':'s4','ข้อ4':'s4','4':'s4',
    'พอเพียง':'s5','อยู่อย่างพอเพียง':'s5','ข้อ5':'s5','5':'s5',
    'มุ่งมั่น':'s6','มุ่งมั่นในการทำงาน':'s6','ข้อ6':'s6','6':'s6',
    'รักไทย':'s7','รักความเป็นไทย':'s7','ข้อ7':'s7','7':'s7',
    'จิตสาธารณะ':'s8','มีจิตสาธารณะ':'s8','ข้อ8':'s8','8':'s8',
  },
  eval_reading: {
    'เลขประจำตัว':'student_id','เลขประจำตัวนักเรียน':'student_id',
    'ชั้น':'class','ชั้นเรียน':'class',
    'ภาคเรียน':'semester','ปีการศึกษา':'academic_year',
    'การอ่าน1':'r1','อ่าน1':'r1','ข้อ1':'r1','r1':'r1',
    'การอ่าน2':'r2','อ่าน2':'r2','ข้อ2':'r2','r2':'r2',
    'การคิด3':'r3','คิด3':'r3','ข้อ3':'r3','r3':'r3',
    'การคิด4':'r4','คิด4':'r4','ข้อ4':'r4','r4':'r4',
    'การเขียน5':'r5','เขียน5':'r5','ข้อ5':'r5','r5':'r5',
  },
  eval_comp: {
    'เลขประจำตัว':'student_id','เลขประจำตัวนักเรียน':'student_id',
    'ชั้น':'class','ชั้นเรียน':'class',
    'ภาคเรียน':'semester','ปีการศึกษา':'academic_year',
    'สื่อสาร':'c1','ความสามารถในการสื่อสาร':'c1','ข้อ1':'c1','c1':'c1',
    'การคิด':'c2','ความสามารถในการคิด':'c2','ข้อ2':'c2','c2':'c2',
    'แก้ปัญหา':'c3','ความสามารถในการแก้ปัญหา':'c3','ข้อ3':'c3','c3':'c3',
    'ทักษะชีวิต':'c4','ความสามารถในการใช้ทักษะชีวิต':'c4','ข้อ4':'c4','c4':'c4',
    'เทคโนโลยี':'c5','ความสามารถในการใช้เทคโนโลยี':'c5','ข้อ5':'c5','c5':'c5',
  },
  deeds: {
    'เลขประจำตัว':'student_id','เลขประจำตัวนักเรียน':'student_id',
    'ชั้น':'class','ชั้นเรียน':'class',
    'วันที่':'deed_date','วัน/เดือน/ปี':'deed_date',
    'รายละเอียด':'detail','รายการ':'detail','ความดี':'detail',
    'สถานะ':'status',
    'ผู้รับรอง':'approved_by',
    'ปีการศึกษา':'academic_year',
  },
  scholarships: {
    'เลขประจำตัว':'student_id','เลขประจำตัวนักเรียน':'student_id',
    'ชั้น':'class','ชั้นเรียน':'class',
    'ชื่อทุน':'scholarship_name','ทุน':'scholarship_name',
    'จำนวนเงิน':'amount','จำนวน':'amount',
    'แหล่งที่มา':'source','ผู้มอบ':'source',
    'วันที่รับ':'receive_date','วันที่':'receive_date',
    'ปีการศึกษา':'academic_year','หมายเหตุ':'note',
  },
  certificates: {
    'ประเภท':'cert_type','ประเภทเกียรติบัตร':'cert_type',
    'ชื่อผู้รับ':'owner','เจ้าของ':'owner','ผู้รับ':'owner',
    'ชั้น':'class','ชั้นเรียน':'class',
    'ชื่อเกียรติบัตร':'cert_name','เกียรติบัตร':'cert_name','รางวัล':'cert_name',
    'ระดับ':'level',
    'วันที่รับ':'receive_date','วันที่':'receive_date',
    'ปีการศึกษา':'academic_year',
  },
  trainings: {
    'ชื่อครู':'teacher_name','ครู':'teacher_name','ผู้เข้าอบรม':'teacher_name',
    'ชื่ออบรม':'training_name','หลักสูตร':'training_name','อบรม':'training_name',
    'สถานที่':'location',
    'ผู้จัด':'organizer','หน่วยงาน':'organizer',
    'ชั่วโมง':'hours','จำนวนชั่วโมง':'hours',
    'วันที่':'receive_date',
    'ปีการศึกษา':'academic_year',
  },
  documents: {
    'ประเภท':'doc_type','รับ/ส่ง':'doc_type',
    'เลขที่หนังสือ':'doc_number','เลขที่':'doc_number',
    'เรื่อง':'doc_subject','หัวเรื่อง':'doc_subject',
    'เจ้าของ':'person','ผู้รับ':'person','หน่วยงาน':'person',
    'วันที่':'doc_date','วันที่หนังสือ':'doc_date',
    'หมายเหตุ':'note',
    'ปีการศึกษา':'academic_year',
  },
};

// ── แปลง sheet_to_json พร้อม auto-detect header row ──
function parseSheet(ws) {
  const data = XLSX.utils.sheet_to_json(ws, { header:1, defval:'', raw:false });
  if (!data.length) return { headers:[], rows:[] };
  let headerRowIdx = 0;
  const r0 = data[0].filter(c=>String(c).trim()!=='').length;
  const r1 = data[1]?.filter(c=>String(c).trim()!=='').length||0;
  if (r0 < 3 && r1 >= 4) headerRowIdx = 1;
  const headers = data[headerRowIdx].map(h=>String(h).trim());
  const rows = data.slice(headerRowIdx+1).filter(r=>r.some(c=>String(c).trim()!==''));
  return { headers, rows };
}

// ── auto-map headers → fields ──
function autoMap(headers, colMap) {
  const m = {};
  headers.forEach((h,i) => {
    const field = colMap[h];
    if (field && m[field]===undefined) m[field]=i;
  });
  return m;
}

// ── Extract value helper ──
function val(row, mapping, field) {
  const idx = mapping[field];
  return idx!==undefined ? row[idx] : undefined;
}

// ── Import functions per type ──────────────────────────────────────────────
async function importStudents(rows, mapping, schoolId, setProgress) {
  const records = rows.map(r => {
    const obj = { school_id:schoolId, status:'ปกติ' };
    Object.entries(mapping).forEach(([field,idx]) => {
      const v = r[idx];
      if (v===''||v===undefined||v===null) return;
      if (field==='dob') obj[field]=parseDate(v);
      else if (['no_in_class','current_academic_year'].includes(field)) obj[field]=parseInt2(v);
      else if (['weight','height'].includes(field)) obj[field]=parseNum(v);
      else obj[field]=String(v).trim();
    });
    return obj;
  }).filter(r=>r.student_id&&r.first_name);

  let ok=0,fail=0;
  for (let i=0;i<records.length;i+=100) {
    const b=records.slice(i,i+100);
    const {error}=await supabase.from('students').upsert(b,{onConflict:'school_id,student_id'});
    if(error){fail+=b.length;console.error(error);}else ok+=b.length;
    setProgress({done:Math.min(i+100,records.length),total:records.length,ok,fail});
  }
  // seed enrollments
  const curYear = getCurrentAcademicYear();
  const enrRecords = records.filter(r=>r.class).map(r=>({
    school_id:schoolId, academic_year:curYear, student_id:r.student_id,
    class:r.class, no_in_class:r.no_in_class||null, status:'ปกติ',
  }));
  if (enrRecords.length)
    await supabase.from('enrollments').upsert(enrRecords,{onConflict:'school_id,academic_year,student_id',ignoreDuplicates:true});
  return {ok,fail};
}

async function importAttendance(rows, mapping, schoolId, setProgress) {
  const records = rows.map(r => ({
    school_id:schoolId,
    student_id: str(val(r,mapping,'student_id')),
    class: str(val(r,mapping,'class')),
    attendance_date: parseDate(val(r,mapping,'attendance_date')),
    status: str(val(r,mapping,'status'))||'มา',
    remark: str(val(r,mapping,'remark')),
  })).filter(r=>r.student_id&&r.attendance_date);

  let ok=0,fail=0;
  for (let i=0;i<records.length;i+=100) {
    const b=records.slice(i,i+100);
    const {error}=await supabase.from('attendance').upsert(b,{onConflict:'school_id,attendance_date,student_id'});
    if(error){fail+=b.length;console.error(error);}else ok+=b.length;
    setProgress({done:Math.min(i+100,records.length),total:records.length,ok,fail});
  }
  return {ok,fail};
}

async function importSavings(rows, mapping, schoolId, defYear, setProgress) {
  const records = rows.map(r => ({
    school_id:schoolId,
    academic_year: parseInt2(val(r,mapping,'academic_year'))||defYear,
    student_id: str(val(r,mapping,'student_id')),
    class: str(val(r,mapping,'class')),
    txn_date: parseDate(val(r,mapping,'txn_date')),
    type: str(val(r,mapping,'type'))||'ฝาก',
    amount: parseNum(val(r,mapping,'amount'))||0,
    remark: str(val(r,mapping,'remark')),
  })).filter(r=>r.student_id&&r.txn_date&&r.amount);

  let ok=0,fail=0;
  for (let i=0;i<records.length;i+=100) {
    const b=records.slice(i,i+100);
    const {error}=await supabase.from('savings').insert(b);
    if(error){fail+=b.length;console.error(error);}else ok+=b.length;
    setProgress({done:Math.min(i+100,records.length),total:records.length,ok,fail});
  }
  return {ok,fail};
}

async function importCoop(rows, mapping, schoolId, setProgress) {
  const records = rows.map(r => ({
    school_id:schoolId,
    entry_date: parseDate(val(r,mapping,'entry_date')),
    type: str(val(r,mapping,'type'))||'รายรับ',
    category: str(val(r,mapping,'category')),
    description: str(val(r,mapping,'description')),
    amount: parseNum(val(r,mapping,'amount'))||0,
  })).filter(r=>r.entry_date&&r.amount);

  let ok=0,fail=0;
  for (let i=0;i<records.length;i+=100) {
    const b=records.slice(i,i+100);
    const {error}=await supabase.from('coop_entries').insert(b);
    if(error){fail+=b.length;console.error(error);}else ok+=b.length;
    setProgress({done:Math.min(i+100,records.length),total:records.length,ok,fail});
  }
  return {ok,fail};
}

async function importHealth(rows, mapping, schoolId, defYear, setProgress) {
  const records = rows.map(r => ({
    school_id:schoolId,
    academic_year: parseInt2(val(r,mapping,'academic_year'))||defYear,
    semester: parseInt2(val(r,mapping,'semester'))||1,
    student_id: str(val(r,mapping,'student_id')),
    class: str(val(r,mapping,'class'))||'',
    weight: parseNum(val(r,mapping,'weight')),
    height: parseNum(val(r,mapping,'height')),
  })).filter(r=>r.student_id&&(r.weight||r.height));

  let ok=0,fail=0;
  for (let i=0;i<records.length;i+=100) {
    const b=records.slice(i,i+100);
    const {error}=await supabase.from('health').upsert(b,{onConflict:'school_id,academic_year,semester,student_id'});
    if(error){fail+=b.length;console.error(error);}else ok+=b.length;
    setProgress({done:Math.min(i+100,records.length),total:records.length,ok,fail});
  }
  return {ok,fail};
}

async function importHomeVisit(rows, mapping, schoolId, defYear, setProgress) {
  const records = rows.map(r => ({
    school_id:schoolId,
    academic_year: parseInt2(val(r,mapping,'academic_year'))||defYear,
    student_id: str(val(r,mapping,'student_id')),
    class: str(val(r,mapping,'class'))||'',
    visit_date: parseDate(val(r,mapping,'visit_date')),
    visitor_name: str(val(r,mapping,'visitor_name')),
    visit_status: str(val(r,mapping,'visit_status'))||'ยังไม่เยี่ยม',
    house_condition: str(val(r,mapping,'house_condition')),
    parent_concern: str(val(r,mapping,'parent_concern')),
    teacher_note: str(val(r,mapping,'teacher_note')),
  })).filter(r=>r.student_id);

  let ok=0,fail=0;
  for (let i=0;i<records.length;i+=100) {
    const b=records.slice(i,i+100);
    const {error}=await supabase.from('home_visits').upsert(b,{onConflict:'school_id,academic_year,student_id'});
    if(error){fail+=b.length;console.error(error);}else ok+=b.length;
    setProgress({done:Math.min(i+100,records.length),total:records.length,ok,fail});
  }
  return {ok,fail};
}

async function importGrades(rows, mapping, schoolId, defYear, setProgress) {
  // รองรับ 2 format:
  // 1) row = 1 นักเรียน 1 วิชา (มี subject column)
  // 2) wide format = 1 นักเรียน หลายวิชา (subject name เป็น header)
  const records = [];
  const hasSubjectCol = mapping['subject']!==undefined;

  if (hasSubjectCol) {
    rows.forEach(r => {
      const sid=str(val(r,mapping,'student_id')); if(!sid)return;
      records.push({
        school_id:schoolId,
        academic_year: parseInt2(val(r,mapping,'academic_year'))||defYear,
        semester: parseInt2(val(r,mapping,'semester'))||1,
        student_id:sid, class:str(val(r,mapping,'class'))||'',
        subject: str(val(r,mapping,'subject')),
        score: parseNum(val(r,mapping,'score')),
        max_score: parseNum(val(r,mapping,'max_score'))||100,
      });
    });
  } else {
    // wide format: headers that are not standard fields = subject names
    const stdFields = new Set(Object.values(COL_MAPS.grades));
    const subjectCols = [];
    Object.entries(mapping).forEach(([field,idx])=>{
      // not a standard field = subject name
      if(!stdFields.has(field)) subjectCols.push({subject:field,idx});
    });
    // also check unmapped headers
    rows.forEach(r => {
      const sid=str(val(r,mapping,'student_id')); if(!sid)return;
      const yr=parseInt2(val(r,mapping,'academic_year'))||defYear;
      const sem=parseInt2(val(r,mapping,'semester'))||1;
      const cls=str(val(r,mapping,'class'))||'';
      subjectCols.forEach(({subject,idx})=>{
        const score=parseNum(r[idx]);
        if(score!==null) records.push({school_id:schoolId,academic_year:yr,semester:sem,student_id:sid,class:cls,subject,score,max_score:100});
      });
    });
  }

  let ok=0,fail=0;
  for (let i=0;i<records.length;i+=100) {
    const b=records.slice(i,i+100);
    const {error}=await supabase.from('grades').upsert(b,{onConflict:'school_id,academic_year,semester,student_id,subject'});
    if(error){fail+=b.length;console.error(error);}else ok+=b.length;
    setProgress({done:Math.min(i+100,records.length),total:records.length,ok,fail});
  }
  return {ok,fail};
}

function makeEvalImporter(tableName, fields, onConflict) {
  return async function(rows, mapping, schoolId, defYear, setProgress) {
    const records = rows.map(r => {
      const obj = {school_id:schoolId, academic_year:parseInt2(val(r,mapping,'academic_year'))||defYear,
        semester:parseInt2(val(r,mapping,'semester'))||1,
        student_id:str(val(r,mapping,'student_id')),
        class:str(val(r,mapping,'class'))||''};
      fields.forEach(f=>{ const v=parseInt2(val(r,mapping,f)); if(v!==null)obj[f]=v; else obj[f]=0; });
      return obj;
    }).filter(r=>r.student_id);
    let ok=0,fail=0;
    for(let i=0;i<records.length;i+=100){
      const b=records.slice(i,i+100);
      const {error}=await supabase.from(tableName).upsert(b,{onConflict});
      if(error){fail+=b.length;}else ok+=b.length;
      setProgress({done:Math.min(i+100,records.length),total:records.length,ok,fail});
    }
    return {ok,fail};
  };
}
const importEvalAttr = makeEvalImporter('eval_attr',['s1','s2','s3','s4','s5','s6','s7','s8'],'school_id,academic_year,semester,student_id');
const importEvalReading = makeEvalImporter('eval_reading',['r1','r2','r3','r4','r5'],'school_id,academic_year,semester,student_id');
const importEvalComp = makeEvalImporter('eval_competency',['c1','c2','c3','c4','c5'],'school_id,academic_year,semester,student_id');

async function importDeeds(rows, mapping, schoolId, defYear, setProgress) {
  const records = rows.map(r => ({
    school_id:schoolId,
    academic_year: parseInt2(val(r,mapping,'academic_year'))||defYear,
    student_id: str(val(r,mapping,'student_id')),
    class: str(val(r,mapping,'class'))||'',
    deed_date: parseDate(val(r,mapping,'deed_date'))||new Date().toISOString().slice(0,10),
    detail: str(val(r,mapping,'detail'))||'',
    status: str(val(r,mapping,'status'))||'รับรองแล้ว',
    approved_by: str(val(r,mapping,'approved_by')),
  })).filter(r=>r.student_id&&r.detail);
  let ok=0,fail=0;
  for(let i=0;i<records.length;i+=100){
    const b=records.slice(i,i+100);
    const {error}=await supabase.from('deeds').insert(b);
    if(error){fail+=b.length;}else ok+=b.length;
    setProgress({done:Math.min(i+100,records.length),total:records.length,ok,fail});
  }
  return {ok,fail};
}

async function importScholarships(rows, mapping, schoolId, defYear, setProgress) {
  const records = rows.map(r => ({
    school_id:schoolId,
    academic_year: parseInt2(val(r,mapping,'academic_year'))||defYear,
    student_id: str(val(r,mapping,'student_id')),
    class: str(val(r,mapping,'class'))||'',
    scholarship_name: str(val(r,mapping,'scholarship_name'))||'ทุนการศึกษา',
    amount: parseNum(val(r,mapping,'amount'))||0,
    source: str(val(r,mapping,'source')),
    receive_date: parseDate(val(r,mapping,'receive_date')),
    note: str(val(r,mapping,'note')),
  })).filter(r=>r.student_id);
  let ok=0,fail=0;
  for(let i=0;i<records.length;i+=100){
    const b=records.slice(i,i+100);
    const {error}=await supabase.from('scholarships').insert(b);
    if(error){fail+=b.length;}else ok+=b.length;
    setProgress({done:Math.min(i+100,records.length),total:records.length,ok,fail});
  }
  return {ok,fail};
}

async function importCertificates(rows, mapping, schoolId, defYear, setProgress) {
  const records = rows.map(r => ({
    school_id:schoolId,
    academic_year: parseInt2(val(r,mapping,'academic_year'))||defYear,
    cert_type: str(val(r,mapping,'cert_type'))||'นักเรียน',
    owner: str(val(r,mapping,'owner'))||'',
    class: str(val(r,mapping,'class')),
    cert_name: str(val(r,mapping,'cert_name'))||'เกียรติบัตร',
    level: str(val(r,mapping,'level')),
    receive_date: parseDate(val(r,mapping,'receive_date')),
  })).filter(r=>r.owner);
  let ok=0,fail=0;
  for(let i=0;i<records.length;i+=100){
    const b=records.slice(i,i+100);
    const {error}=await supabase.from('certificates').insert(b);
    if(error){fail+=b.length;}else ok+=b.length;
    setProgress({done:Math.min(i+100,records.length),total:records.length,ok,fail});
  }
  return {ok,fail};
}

async function importTrainings(rows, mapping, schoolId, defYear, setProgress) {
  const records = rows.map(r => ({
    school_id:schoolId,
    academic_year: parseInt2(val(r,mapping,'academic_year'))||defYear,
    teacher_name: str(val(r,mapping,'teacher_name'))||'',
    training_name: str(val(r,mapping,'training_name'))||'',
    location: str(val(r,mapping,'location')),
    organizer: str(val(r,mapping,'organizer')),
    hours: parseNum(val(r,mapping,'hours')),
    receive_date: parseDate(val(r,mapping,'receive_date')),
  })).filter(r=>r.teacher_name&&r.training_name);
  let ok=0,fail=0;
  for(let i=0;i<records.length;i+=100){
    const b=records.slice(i,i+100);
    const {error}=await supabase.from('trainings').insert(b);
    if(error){fail+=b.length;}else ok+=b.length;
    setProgress({done:Math.min(i+100,records.length),total:records.length,ok,fail});
  }
  return {ok,fail};
}

async function importDocuments(rows, mapping, schoolId, defYear, setProgress) {
  const records = rows.map(r => ({
    school_id:schoolId,
    academic_year: parseInt2(val(r,mapping,'academic_year'))||defYear,
    doc_type: str(val(r,mapping,'doc_type'))||'รับ',
    doc_number: str(val(r,mapping,'doc_number')),
    doc_subject: str(val(r,mapping,'doc_subject'))||'',
    person: str(val(r,mapping,'person')),
    doc_date: parseDate(val(r,mapping,'doc_date')),
    note: str(val(r,mapping,'note')),
  })).filter(r=>r.doc_subject);
  let ok=0,fail=0;
  for(let i=0;i<records.length;i+=100){
    const b=records.slice(i,i+100);
    const {error}=await supabase.from('documents').insert(b);
    if(error){fail+=b.length;}else ok+=b.length;
    setProgress({done:Math.min(i+100,records.length),total:records.length,ok,fail});
  }
  return {ok,fail};
}

const IMPORT_FNS = {
  students:     (rows,mapping,sid,yr,prog)=>importStudents(rows,mapping,sid,prog),
  attendance:   importAttendance,
  savings:      importSavings,
  coop:         importCoop,
  health:       importHealth,
  homevisit:    importHomeVisit,
  grades:       importGrades,
  eval_attr:    importEvalAttr,
  eval_reading: importEvalReading,
  eval_comp:    importEvalComp,
  deeds:        importDeeds,
  scholarships: importScholarships,
  certificates: importCertificates,
  trainings:    importTrainings,
  documents:    importDocuments,
};

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════
export default function ImportPage() {
  const router = useRouter();
  const [s, setS] = useState(null);
  const [activeType, setActiveType] = useState('students');
  const [sheetData, setSheetData] = useState({}); // {type: {headers,rows,mapping,sheetName}}
  const [results, setResults] = useState({}); // {type: {ok,fail}}
  const [progMap, setProgMap] = useState({}); // {type: progress}
  const [defYear, setDefYear] = useState(getCurrentAcademicYear());

  useEffect(() => {
    const sess = getSession();
    if (!sess || sess.role !== 'admin') { router.replace('/dashboard'); return; }
    setS(sess);
  }, [router]);

  function setProgress(type, prog) {
    setProgMap(p => ({...p, [type]:prog}));
  }

  async function handleFile(e, type) {
    const file = e.target.files[0];
    if (!file) return;
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf);

    // ถ้าไฟล์มีหลาย sheet → ใช้ sheet แรก (หรือ sheet ที่ชื่อตรงกับ type)
    let sheetName = wb.SheetNames[0];
    // ลอง match sheet name
    const typeLabel = SHEET_TYPES.find(t=>t.key===type)?.label||'';
    for (const n of wb.SheetNames) {
      const lower = n.toLowerCase();
      if (lower.includes('student')||lower.includes('นักเรียน')) { if(type==='students'){sheetName=n;break;} }
      if (lower.includes('attend')||lower.includes('เช็ค')) { if(type==='attendance'){sheetName=n;break;} }
      if (lower.includes('saving')||lower.includes('ออม')) { if(type==='savings'){sheetName=n;break;} }
      if (lower.includes('coop')||lower.includes('สหกรณ์')) { if(type==='coop'){sheetName=n;break;} }
      if (lower.includes('health')||lower.includes('สุขภาพ')||lower.includes('น้ำหนัก')) { if(type==='health'){sheetName=n;break;} }
      if (lower.includes('homevisit')||lower.includes('เยี่ยม')) { if(type==='homevisit'){sheetName=n;break;} }
      if (lower.includes('grade')||lower.includes('ผลการเรียน')||lower.includes('คะแนน')) { if(type==='grades'){sheetName=n;break;} }
    }

    const ws = wb.Sheets[sheetName];
    const { headers, rows } = parseSheet(ws);
    const colMap = COL_MAPS[type]||{};
    const mapping = autoMap(headers, colMap);

    setSheetData(p => ({...p, [type]:{headers,rows,mapping,sheetName,fileName:file.name,allSheets:wb.SheetNames}}));
    e.target.value = '';
  }

  async function doImport(type) {
    const d = sheetData[type]; if (!d) return;
    const importFn = IMPORT_FNS[type]; if (!importFn) return;
    setResults(p=>({...p,[type]:null}));
    setProgress(type,{done:0,total:d.rows.length,ok:0,fail:0});
    try {
      const {ok,fail} = await importFn(d.rows, d.mapping, s.schoolId, defYear, (prog)=>setProgress(type,prog));
      setResults(p=>({...p,[type]:{ok,fail}}));
    } catch(err) {
      console.error(err);
      setResults(p=>({...p,[type]:{ok:0,fail:d.rows.length,error:err.message}}));
    }
  }

  function changeMapping(type, field, colIdx) {
    setSheetData(p => {
      const d = {...p[type]};
      d.mapping = {...d.mapping, [field]: colIdx===''?undefined:parseInt(colIdx)};
      return {...p,[type]:d};
    });
  }

  function changeSheet(type, sheetName) {
    // re-parse with selected sheet
    // need to re-read file - not possible without re-upload
    // just show message
  }

  if (!s) return null;

  const cur = sheetData[activeType];
  const curType = SHEET_TYPES.find(t=>t.key===activeType);
  const prog = progMap[activeType];
  const result = results[activeType];

  const colMap = COL_MAPS[activeType]||{};
  const fields = Object.values(colMap).filter((v,i,a)=>a.indexOf(v)===i); // unique fields

  return (
    <>
      <TopBar />
      <div className="wrap">
        <div className="card">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,flexWrap:'wrap',gap:8}}>
            <h2 style={{margin:0}}>📥 นำเข้าข้อมูลทุกชีท</h2>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <label style={{fontSize:12,fontWeight:600}}>ปีการศึกษาเริ่มต้น:</label>
              <input type="number" value={defYear} onChange={e=>setDefYear(parseInt(e.target.value))}
                style={{width:80,textAlign:'center',padding:'4px 8px'}} />
            </div>
          </div>

          {/* Sheet type tabs */}
          <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:20,padding:'10px',background:'#f8fafc',borderRadius:10}}>
            {SHEET_TYPES.map(t => {
              const hasData = !!sheetData[t.key];
              const res = results[t.key];
              return (
                <button key={t.key} onClick={()=>setActiveType(t.key)}
                  style={{
                    padding:'8px 12px', borderRadius:8, border:'none', cursor:'pointer', fontSize:12, fontWeight:700,
                    background: activeType===t.key ? t.color : hasData ? '#dcfce7' : '#e2e8f0',
                    color: activeType===t.key ? '#fff' : hasData ? '#15803d' : '#475569',
                    position:'relative',
                  }}>
                  {t.icon} {t.label.replace(/^[^\s]+ /,'')}
                  {res && <span style={{position:'absolute',top:-6,right:-6,background:res.fail>0?'#dc2626':'#16a34a',color:'#fff',borderRadius:'50%',width:16,height:16,fontSize:9,display:'flex',alignItems:'center',justifyContent:'center'}}>✓</span>}
                </button>
              );
            })}
          </div>

          {/* Current type panel */}
          <div style={{border:`2px solid ${curType?.color||'#e2e8f0'}`,borderRadius:12,padding:16}}>
            <h3 style={{margin:'0 0 12px',color:curType?.color}}>{curType?.label}</h3>

            {/* Instructions */}
            <div style={{background:'#f1f5f9',borderRadius:8,padding:10,marginBottom:12,fontSize:12}}>
              <b>📋 วิธีนำเข้า {curType?.label}:</b>
              <ol style={{margin:'4px 0 0 16px'}}>
                <li>เปิด Google Sheets เดิม → Sheet <b>{activeType==='students'?'Student / ข้อมูลนักเรียน':activeType==='attendance'?'Attendance / การเช็คชื่อ':activeType==='savings'?'Savings / ออมทรัพย์':activeType==='grades'?'Grades / ผลการเรียน':curType?.label}</b></li>
                <li>File → Download → <b>Microsoft Excel (.xlsx)</b></li>
                <li>อัปโหลดไฟล์ด้านล่าง</li>
              </ol>
            </div>

            <div style={{marginBottom:12}}>
              <label style={{fontWeight:600,fontSize:13,marginRight:8}}>เลือกไฟล์ Excel:</label>
              <input type="file" accept=".xlsx,.xls,.csv" onChange={e=>handleFile(e,activeType)} />
            </div>

            {cur && (
              <>
                <div style={{background:'#dbeafe',padding:8,borderRadius:6,fontSize:12,marginBottom:10}}>
                  ✅ อ่านไฟล์ <b>{cur.fileName}</b> sheet: <b>{cur.sheetName}</b> · {cur.rows.length} แถว
                  {cur.allSheets?.length > 1 && (
                    <span style={{marginLeft:8,color:'#1e40af'}}>
                      (sheets ทั้งหมด: {cur.allSheets.join(', ')})
                    </span>
                  )}
                </div>

                {/* Preview */}
                <div style={{overflowX:'auto',marginBottom:10}}>
                  <table style={{fontSize:11}}>
                    <thead><tr style={{background:'#e2e8f0'}}>
                      {cur.headers.map((h,i)=><th key={i} style={{maxWidth:100,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',padding:'3px 5px'}}>{h||`(col${i})`}</th>)}
                    </tr></thead>
                    <tbody>
                      {cur.rows.slice(0,3).map((r,ri)=>(
                        <tr key={ri}>{cur.headers.map((_,ci)=>(
                          <td key={ci} style={{maxWidth:100,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',padding:'3px 5px',fontSize:10}}>{String(r[ci]??'')}</td>
                        ))}</tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Column mapping */}
                <div style={{marginBottom:12}}>
                  <h4 style={{margin:'0 0 8px',fontSize:13}}>🔗 จับคู่คอลัมน์ (auto-mapped)</h4>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:6}}>
                    {fields.map(field => (
                      <div key={field} style={{display:'flex',alignItems:'center',gap:6,background:'#f8fafc',padding:'4px 8px',borderRadius:6}}>
                        <span style={{fontSize:11,fontWeight:700,color:'#1e40af',minWidth:100,flexShrink:0}}>{field}</span>
                        <select value={cur.mapping[field]??''} onChange={e=>changeMapping(activeType,field,e.target.value)}
                          style={{flex:1,fontSize:11,padding:'2px 4px'}}>
                          <option value="">— ไม่ใช้ —</option>
                          {cur.headers.map((h,i)=>{
                            const sample=cur.rows.find(r=>r[i]!=null&&String(r[i]).trim()!=='')?.[i];
                            const s=sample?` → "${String(sample).slice(0,18)}"` :'';
                            return <option key={i} value={i}>{h||`col${i}`}{s}</option>;
                          })}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
                  <button className="success" onClick={()=>doImport(activeType)}
                    style={{fontSize:14,padding:'10px 20px'}}
                    disabled={!!prog&&prog.done<prog.total}>
                    📤 นำเข้า {cur.rows.length} แถว
                  </button>
                  <button className="secondary" onClick={()=>setSheetData(p=>{const n={...p};delete n[activeType];return n;})}>
                    ✕ ล้าง
                  </button>
                </div>

                {prog && (
                  <div style={{marginTop:10,padding:10,background:'#dbeafe',borderRadius:8}}>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:4}}>
                      <span>กำลัง import: {prog.done}/{prog.total}</span>
                      <span>✅ {prog.ok} &nbsp; ❌ {prog.fail}</span>
                    </div>
                    <div style={{background:'#e5e7eb',height:8,borderRadius:4,overflow:'hidden'}}>
                      <div style={{background:'#16a34a',width:`${prog.total>0?Math.round(prog.done/prog.total*100):0}%`,height:'100%',transition:'width 0.2s'}} />
                    </div>
                  </div>
                )}

                {result && (
                  <div style={{marginTop:10,padding:10,background:result.fail>0?'#fef2f2':'#f0fdf4',border:`1px solid ${result.fail>0?'#fca5a5':'#bbf7d0'}`,borderRadius:8,fontSize:13}}>
                    {result.fail>0 ? `⚠️ import เสร็จ: ✅ ${result.ok} รายการ · ❌ ${result.fail} รายการล้มเหลว` : `✅ import สำเร็จ ${result.ok} รายการ`}
                    {result.error && <div style={{color:'#dc2626',fontSize:11,marginTop:4}}>{result.error}</div>}
                  </div>
                )}
              </>
            )}

            {!cur && (
              <div style={{textAlign:'center',padding:'30px 0',color:'#94a3b8'}}>
                ยังไม่ได้อัปโหลดไฟล์สำหรับ {curType?.label}
              </div>
            )}
          </div>

          {/* Summary */}
          {Object.keys(results).length > 0 && (
            <div style={{marginTop:16,background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:10,padding:14}}>
              <h4 style={{margin:'0 0 10px',color:'#15803d'}}>📊 สรุปผลการนำเข้า</h4>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:8}}>
                {Object.entries(results).filter(([,r])=>r).map(([type,r])=>{
                  const t=SHEET_TYPES.find(t=>t.key===type);
                  return (
                    <div key={type} style={{background:'#fff',padding:10,borderRadius:8,border:'1px solid #dcfce7'}}>
                      <div style={{fontSize:12,fontWeight:700,color:'#374151'}}>{t?.icon} {t?.label}</div>
                      <div style={{fontSize:13,color:r.fail>0?'#dc2626':'#15803d',marginTop:3}}>
                        ✅ {r.ok}{r.fail>0?` · ❌ ${r.fail}`:''}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
