// ลำดับชั้นที่ถูกต้อง (อ.2 → ป.6) — ใช้ unicode order ไม่ได้เพราะ อ มาหลัง ป
const CLASS_ORDER = ['อ.1', 'อ.2', 'อ.3', 'ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6', 'ม.1', 'ม.2', 'ม.3'];

export function classOrderIdx(c) {
  if (!c) return 999;
  const idx = CLASS_ORDER.indexOf(String(c).trim());
  return idx >= 0 ? idx : 999;
}

// เรียง: ชั้น (อ.2 ก่อน ป.1) → เลขประจำตัว (numeric)
export function sortByClassAndStudentId(list) {
  return [...list].sort((a, b) => {
    const co = classOrderIdx(a.class) - classOrderIdx(b.class);
    if (co !== 0) return co;
    // ภายในชั้นเดียวกัน เรียงตาม student_id (numeric — 4801 < 9001)
    return String(a.student_id || '').localeCompare(
      String(b.student_id || ''),
      'th',
      { numeric: true }
    );
  });
}
