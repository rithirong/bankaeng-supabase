-- ============================================
-- Migration: เพิ่มคอลัมน์ที่จำเป็นสำหรับ import
-- รันใน Supabase SQL Editor
-- ============================================

-- 1) students — เพิ่มคอลัมน์ที่ GAS มีแต่ schema เดิมไม่มี
alter table students add column if not exists guardian_name     text;
alter table students add column if not exists guardian_relation text;
alter table students add column if not exists guardian_job      text;
alter table students add column if not exists guardian_phone    text;
alter table students add column if not exists father_last_name  text;
alter table students add column if not exists mother_last_name  text;
alter table students add column if not exists religion          text;
alter table students add column if not exists nationality       text;
alter table students add column if not exists ethnicity         text;
alter table students add column if not exists disadvantage      text;
alter table students add column if not exists street            text;
alter table students add column if not exists address           text;
alter table students add column if not exists photo_url         text;
alter table students add column if not exists gps_coords        text;
alter table students add column if not exists current_academic_year integer;

-- 2) grades — ตรวจสอบว่ามีตารางนี้ และถ้าไม่มีก็สร้าง
create table if not exists grades (
  id              uuid primary key default gen_random_uuid(),
  school_id       uuid not null references schools(id) on delete cascade,
  academic_year   integer not null,
  semester        smallint not null check (semester in (1,2)),
  student_id      text not null,
  class           text not null,
  subject         text not null,
  score           numeric(6,2),
  max_score       numeric(6,2) default 100,
  recorded_by     text,
  updated_at      timestamptz default now(),
  unique (school_id, academic_year, semester, student_id, subject)
);
create index if not exists idx_grades_student on grades(school_id, academic_year, student_id);
alter table grades enable row level security;
drop policy if exists "dev all" on grades;
create policy "dev all" on grades for all using (true) with check (true);

-- 3) curriculum — ตรวจสอบ
create table if not exists curriculum (
  id              uuid primary key default gen_random_uuid(),
  school_id       uuid not null references schools(id) on delete cascade,
  academic_year   integer not null,
  class           text not null,
  subject_id      text,
  subject_name    text not null,
  hours           numeric(5,1),
  credit          numeric(4,1),
  subject_type    text default 'พื้นฐาน',
  score_ratio     text default '70:30',
  teacher_name    text,
  updated_at      timestamptz default now(),
  unique (school_id, academic_year, class, subject_name)
);
alter table curriculum enable row level security;
drop policy if exists "dev all" on curriculum;
create policy "dev all" on curriculum for all using (true) with check (true);

-- 4) papol6_comments (สำหรับหน้าปพ.6 ความเห็นครู/ผู้ปกครอง)
create table if not exists papol6_comments (
  id              uuid primary key default gen_random_uuid(),
  school_id       uuid not null references schools(id) on delete cascade,
  academic_year   integer not null,
  semester        smallint not null,
  class           text not null,
  student_id      text not null,
  teacher_comment text,
  parent_comment  text,
  updated_at      timestamptz default now(),
  unique (school_id, academic_year, semester, student_id)
);
alter table papol6_comments enable row level security;
drop policy if exists "dev all" on papol6_comments;
create policy "dev all" on papol6_comments for all using (true) with check (true);

-- ตรวจสอบ
select 'students cols' as check, count(*) from information_schema.columns
  where table_name='students' and table_schema='public';
select 'grades' as t, count(*) from grades;
