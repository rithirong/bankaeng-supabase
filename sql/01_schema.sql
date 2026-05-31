-- ============================================
-- BanKaeng-Supabase Schema v1 (Multi-tenant ready)
-- ============================================
-- รันใน Supabase SQL Editor → New query → paste → Run
-- ⚠️ ก่อนรัน: ลบตาราง POC เก่าก่อน (students, attendance)
--    drop table if exists attendance cascade;
--    drop table if exists students cascade;
-- ============================================

-- 0) ลบของเก่าให้สะอาด — drop table cascade จะลบ policy/trigger/index ให้อัตโนมัติ
drop table if exists attendance cascade;
drop table if exists students   cascade;
drop table if exists teachers   cascade;
drop table if exists schools    cascade;
drop function if exists set_updated_at() cascade;

-- ============================================
-- 1) SCHOOLS — ตารางโรงเรียน (multi-tenant)
-- ============================================
create table schools (
  id              uuid primary key default gen_random_uuid(),
  code            text unique not null,         -- 'BK001', 'BK002'
  name            text not null,                -- 'โรงเรียนบ้านแก่ง'
  address         text,
  area            text,                          -- เขตพื้นที่การศึกษา
  director        text,                          -- ผู้อำนวยการ
  academic_head   text,
  active          boolean default true,
  created_at      timestamptz default now()
);

insert into schools (code, name, address, area, director) values
  ('BK001', 'โรงเรียนบ้านแก่ง', 'หมู่ 1 ต.บ้านแก่ง อ.ศรีสัชนาลัย จ.สุโขทัย',
   'สพป.สุโขทัย เขต 2', 'นายผู้อำนวยการ');

-- ============================================
-- 2) TEACHERS — ครู/แอดมิน
-- ============================================
create table teachers (
  id              uuid primary key default gen_random_uuid(),
  school_id       uuid not null references schools(id) on delete cascade,
  username        text not null,                 -- รหัสเข้าใช้งาน
  password_hash   text not null,                  -- เก็บแบบ hash (bcrypt)
  name            text not null,
  class           text,                            -- 'ป.1' หรือ 'Admin'
  role            text default 'teacher' check (role in ('admin', 'teacher')),
  position        text,                            -- ตำแหน่ง
  phone           text,
  email           text,
  hidden          boolean default false,
  created_at      timestamptz default now(),
  unique (school_id, username)
);

create index idx_teachers_school on teachers(school_id);

-- ============================================
-- 3) STUDENTS — นักเรียน
-- ============================================
create table students (
  id              uuid primary key default gen_random_uuid(),
  school_id       uuid not null references schools(id) on delete cascade,
  student_id      text not null,                 -- เลขประจำตัวนักเรียน
  national_id     text,                           -- เลขประจำตัวประชาชน
  roll_no         integer,                         -- ลำดับที่
  class           text not null,
  no_in_class     integer,                         -- เลขที่
  prefix          text,
  first_name      text not null,
  last_name       text not null,
  gender          text check (gender in ('ช', 'ญ')),
  dob             date,                            -- วันเกิด (ISO ปีคริสต์)
  weight          numeric(5,2),
  height          numeric(5,2),
  blood_type      text,
  -- ข้อมูลครอบครัว
  father_name     text,
  father_job      text,
  father_phone    text,
  mother_name     text,
  mother_job      text,
  mother_phone    text,
  -- ที่อยู่
  address_no      text,
  village         text,
  alley           text,
  subdistrict     text,
  district        text,
  province        text,
  -- สถานะ
  status          text default 'ปกติ' check (status in ('ปกติ', 'ย้าย', 'ลาออก', 'จบ')),
  status_date     date,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique (school_id, student_id)
);

create index idx_students_school_class on students(school_id, class);
create index idx_students_status       on students(school_id, status);

-- ============================================
-- 4) ATTENDANCE — การเช็คชื่อ
-- ============================================
create table attendance (
  id                uuid primary key default gen_random_uuid(),
  school_id         uuid not null references schools(id) on delete cascade,
  attendance_date   date not null,
  student_id        text not null,
  class             text,
  status            text not null check (status in ('มา', 'ขาด', 'ลา', 'ป่วย')),
  remark            text,
  recorded_by       text,                          -- ครูคนเช็ค
  created_at        timestamptz default now(),
  updated_at        timestamptz default now(),
  unique (school_id, attendance_date, student_id)
);

create index idx_att_date_class on attendance(school_id, attendance_date, class);
create index idx_att_student    on attendance(school_id, student_id);

-- ============================================
-- 5) Trigger: auto-update updated_at
-- ============================================
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_students_updated_at
  before update on students
  for each row execute function set_updated_at();

create trigger trg_attendance_updated_at
  before update on attendance
  for each row execute function set_updated_at();

-- ============================================
-- 6) RLS — เปิดไว้แต่ใช้ permissive policy
--    (จะ tighten ตอนทำ auth จริง)
-- ============================================
alter table schools    enable row level security;
alter table teachers   enable row level security;
alter table students   enable row level security;
alter table attendance enable row level security;

-- For POC: anyone with anon key can read/write
-- (จะเปลี่ยนเป็น JWT-based ตอน production)
create policy "dev all" on schools    for all using (true) with check (true);
create policy "dev all" on teachers   for all using (true) with check (true);
create policy "dev all" on students   for all using (true) with check (true);
create policy "dev all" on attendance for all using (true) with check (true);

-- ============================================
-- เสร็จ — รัน 02_seed.sql ต่อ
-- ============================================
