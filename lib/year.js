'use client';
import { useState, useEffect } from 'react';

const KEY = 'bk_year';

// ปีการศึกษาไทย: เริ่ม 16 พ.ค. ของแต่ละปี → ก่อนหน้านั้นนับปีก่อน
export function getCurrentAcademicYear() {
  const d = new Date();
  const m = d.getMonth() + 1;
  const y = d.getFullYear() + 543;
  return m >= 5 ? y : y - 1;
}

export function getYear() {
  if (typeof window === 'undefined') return getCurrentAcademicYear();
  const s = localStorage.getItem(KEY);
  return s ? parseInt(s) : getCurrentAcademicYear();
}

export function setYear(y) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(KEY, String(y));
    window.dispatchEvent(new Event('bk_year_changed'));
  }
}

export function useYear() {
  const [year, setYearState] = useState(() => getYear());
  useEffect(() => {
    const h = () => setYearState(getYear());
    window.addEventListener('bk_year_changed', h);
    return () => window.removeEventListener('bk_year_changed', h);
  }, []);
  return [year, (y) => { setYear(y); setYearState(y); }];
}

// ปีที่ระบบเริ่มใช้งานจริง — ก่อนหน้านี้ไม่มีข้อมูล
const SYSTEM_START_YEAR = 2569;

// list ปีตั้งแต่ระบบเริ่ม → ปัจจุบัน + ล่วงหน้า 1
export function getYearOptions() {
  const cur = getCurrentAcademicYear();
  const start = Math.max(SYSTEM_START_YEAR, cur - 5);
  const arr = [];
  for (let y = start; y <= cur + 1; y++) arr.push(y);
  return arr;
}