-- ============================================
-- Personnel (บุคลากร) + ปพ.1 tables
-- ============================================

-- 1) Teacher extended profile
create table if not exists teacher_profiles (
  id              uuid primary key default gen_random_uuid(),
  school_id       uuid not null references schools(id) on delete cascade,
  teacher_id      uuid not null references teachers(id) on delete cascade,
  national_id     text,
  dob             date,
  phone           text,
  position        text,          -- ครู, ผอ., ฯลฯ
  position_level  text,          -- ชำนาญการ, ชำนาญการพิเศษ ฯลฯ
  edu_degree      text,          -- วุฒิการศึกษา ป.ตรี/ป.โท ฯลฯ
  edu_major       text,          -- สาขาวิชา
  edu_institute   text,          -- สถาบัน
  start_date      date,          -- วันบรรจุ
  address         text,
  updated_at      timestamptz default now(),
  unique (school_id, teacher_id)
);
alter table teacher_profiles enable row level security;
drop policy if exists "dev all" on teacher_profiles;
create policy "dev all" on teacher_profiles for all using (true) with check (true);

-- 2) Personnel clock records
create table if not exists personnel_clock (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references schools(id) on delete cascade,
  teacher_id    uuid not null references teachers(id) on delete cascade,
  teacher_name  text not null,
  clock_date    date not null,
  clock_in      time,
  clock_out     time,
  status        text default 'ปกติ'
    check (status in ('ปกติ','ไปราชการ','ลา','ขาด')),
  note          text,
  created_at    timestamptz default now(),
  unique (school_id, teacher_id, clock_date)
);
create index if not exists idx_clock_date on personnel_clock(school_id, clock_date);
alter table personnel_clock enable row level security;
drop policy if exists "dev all" on personnel_clock;
create policy "dev all" on personnel_clock for all using (true) with check (true);

-- 3) Leave requests
create table if not exists leave_requests (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references schools(id) on delete cascade,
  teacher_id    uuid not null references teachers(id) on delete cascade,
  teacher_name  text not null,
  leave_type    text not null
    check (leave_type in ('ลาป่วย','ลากิจ','ลาพักร้อน','ลาคลอด','ลาอุปสมบท','อื่นๆ')),
  start_date    date not null,
  end_date      date not null,
  days          integer,
  reason        text,
  status        text default 'รออนุมัติ'
    check (status in ('รออนุมัติ','อนุมัติ','ไม่อนุมัติ')),
  approved_by   text,
  created_at    timestamptz default now()
);
create index if not exists idx_leave_teacher on leave_requests(school_id, teacher_id);
alter table leave_requests enable row level security;
drop policy if exists "dev all" on leave_requests;
create policy "dev all" on leave_requests for all using (true) with check (true);

-- 4) ปพ.1 records (link PDF files)
create table if not exists papol1_records (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references schools(id) on delete cascade,
  student_id    text not null,
  student_name  text,
  file_url      text,
  note          text,
  uploaded_by   text,
  created_at    timestamptz default now(),
  unique (school_id, student_id)
);
alter table papol1_records enable row level security;
drop policy if exists "dev all" on papol1_records;
create policy "dev all" on papol1_records for all using (true) with check (true);

select 'teacher_profiles' as t, count(*) from teacher_profiles
union all select 'personnel_clock', count(*) from personnel_clock
union all select 'leave_requests', count(*) from leave_requests
union all select 'papol1_records', count(*) from papol1_records;
