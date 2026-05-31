import { supabase } from './supabase';

const KEY = 'bk_session';

// ────────────────────────────────────────
// ครู/แอดมิน login
// ────────────────────────────────────────
export async function login(username, password) {
  const { data, error } = await supabase
    .from('teachers')
    .select('id, username, password_hash, name, class, role, school_id, schools(id, code, name, address, area, director)')
    .eq('username', username.trim())
    .eq('hidden', false)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { success: false, message: 'ไม่พบ username นี้' };
  if (data.password_hash !== password) return { success: false, message: 'รหัสผ่านไม่ถูกต้อง' };

  const session = {
    teacherId: data.id,
    username: data.username,
    name: data.name,
    class: data.class,
    role: data.role,
    schoolId: data.school_id,
    school: data.schools,
    loginAt: Date.now(),
  };
  localStorage.setItem(KEY, JSON.stringify(session));
  return { success: true, session };
}

// ────────────────────────────────────────
// 👪 Parent login — เลขประจำตัวนักเรียน + วันเกิด
// รับวันเกิดได้ทุก format: DDMMYYYY (พุทธ), DD/MM/YYYY, ISO ฯลฯ
// ────────────────────────────────────────
export async function loginParent(studentId, birthday) {
  if (!studentId?.trim() || !birthday?.trim()) {
    return { success: false, message: 'กรุณากรอกข้อมูลให้ครบ' };
  }
  const sid = String(studentId).trim();
  const inputDate = parseDobInput(birthday);
  if (!inputDate) return { success: false, message: 'วันเกิดไม่ถูกต้อง — รูปแบบ DDMMYYYY เช่น 09092560' };

  // หานักเรียนทุกคนที่มี student_id ตรง (อาจอยู่หลาย รร. — กรองอีกชั้นใน app)
  const { data, error } = await supabase
    .from('students')
    .select('id, student_id, prefix, first_name, last_name, dob, school_id, class, no_in_class, schools(id, code, name, address, area, director)')
    .eq('student_id', sid);
  if (error) return { success: false, message: error.message };
  if (!data || !data.length) return { success: false, message: 'ไม่พบเลขประจำตัวนักเรียน' };

  // match DOB
  for (const stu of data) {
    const stuDate = parseDobInput(stu.dob);
    if (!stuDate) continue;
    if (stuDate.getFullYear() === inputDate.getFullYear()
      && stuDate.getMonth() === inputDate.getMonth()
      && stuDate.getDate() === inputDate.getDate()) {
      const session = {
        role: 'parent',
        studentId: stu.student_id,
        studentRowId: stu.id,
        name: `${stu.prefix || ''}${stu.first_name || ''} ${stu.last_name || ''}`.trim(),
        class: stu.class,
        noInClass: stu.no_in_class,
        dob: stu.dob,
        schoolId: stu.school_id,
        school: stu.schools,
        loginAt: Date.now(),
      };
      localStorage.setItem(KEY, JSON.stringify(session));
      return { success: true, session };
    }
  }
  return { success: false, message: 'วันเกิดไม่ตรงกับเลขประจำตัวนี้' };
}

// ────────────────────────────────────────
// ฟังก์ชัน parse DOB — รองรับทุก format
// คืน Date object (ปีคริสต์) หรือ null
// ────────────────────────────────────────
function parseDobInput(val) {
  if (!val) return null;
  // ถ้าเป็น Date object หรือ ISO string จาก DB
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    let fy = val.getFullYear();
    if (fy > 2500) return new Date(fy - 543, val.getMonth(), val.getDate());
    return val;
  }
  const str = String(val).trim();
  // ISO YYYY-MM-DD (จาก DB)
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const [y, m, d] = str.split('T')[0].split('-').map(Number);
    let yr = y;
    if (yr > 2500) yr -= 543;
    return new Date(yr, m - 1, d);
  }
  let dd, mm, yy;
  // slash DD/MM/YYYY
  if (str.includes('/')) {
    const p = str.split('/');
    if (p.length !== 3) return null;
    dd = parseInt(p[0]); mm = parseInt(p[1]); yy = parseInt(p[2]);
  }
  // dash DD-MM-YYYY (แต่ ISO YYYY-MM-DD จับด้านบนแล้ว)
  else if (str.includes('-')) {
    const p = str.split('-');
    if (p.length !== 3) return null;
    dd = parseInt(p[0]); mm = parseInt(p[1]); yy = parseInt(p[2]);
  }
  // digits-only DDMMYYYY (เช่น input ของ user "09092560")
  else {
    const digits = str.replace(/\D/g, '');
    if (digits.length !== 8) return null;
    dd = parseInt(digits.substring(0, 2));
    mm = parseInt(digits.substring(2, 4));
    yy = parseInt(digits.substring(4, 8));
  }
  if (isNaN(yy) || isNaN(mm) || isNaN(dd)) return null;
  if (yy > 2500) yy -= 543; // ปีพุทธ → คริสต์
  const d = new Date(yy, mm - 1, dd);
  return isNaN(d.getTime()) ? null : d;
}

// ────────────────────────────────────────
// Session helpers
// ────────────────────────────────────────
export function getSession() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    // session 8 ชั่วโมง
    if (Date.now() - s.loginAt > 8 * 60 * 60 * 1000) {
      logout();
      return null;
    }
    return s;
  } catch { return null; }
}

export function logout() {
  if (typeof window !== 'undefined') localStorage.removeItem(KEY);
}

export function isAdmin() {
  const s = getSession();
  return s && s.role === 'admin';
}

export function isParent() {
  const s = getSession();
  return s && s.role === 'parent';
}

export function isTeacher() {
  const s = getSession();
  return s && (s.role === 'admin' || s.role === 'teacher');
}
