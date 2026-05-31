-- ============================================
-- BanKaeng New Features Schema
-- enrollments + timetable + calendar + assignments + grades
-- รันใน Supabase SQL Editor
-- ============================================

-- ============================================
-- 1) ENROLLMENTS — ทะเบียนนักเรียนรายปีการศึกษา
-- ============================================
create table if not exists enrollments (
  id              uuid primary key default gen_random_uuid(),
  school_id       uuid not null references schools(id) on delete cascade,
  academic_year   integer not null,
  student_id      text not null,
  class           text not null,
  no_in_class     integer,
  status          text default 'ปกติ' check (status in ('ปกติ','ย้ายเข้า','ย้ายออก','ลาออก','จบ','ซ้ำชั้น')),
  created_at      timestamptz default now(),
  unique (school_id, academic_year, student_id),
  constraint fk_enr_student
    foreign key (school_id, student_id)
    references students(school_id, student_id)
    on delete cascade on update cascade
);
create index if not exists idx_enr_year_class on enrollments(school_id, academic_year, class);
alter table enrollments enable row level security;
drop policy if exists "dev all" on enrollments;
create policy "dev all" on enrollments for all using (true) with check (true);

-- seed enrollments จากนักเรียนที่มีอยู่แล้ว (ปี 2569)
insert into enrollments (school_id, academic_year, student_id, class, no_in_class, status)
select school_id, 2569, student_id, class, no_in_class, 'ปกติ'
from students
on conflict (school_id, academic_year, student_id) do nothing;

-- ============================================
-- 2) TIMETABLE — ตารางสอน
-- ============================================
create table if not exists timetable (
  id              uuid primary key default gen_random_uuid(),
  school_id       uuid not null references schools(id) on delete cascade,
  academic_year   integer not null,
  class           text not null,
  day_of_week     smallint not null check (day_of_week between 1 and 5), -- 1=จ 2=อ 3=พ 4=พฤ 5=ศ
  period          smallint not null check (period between 1 and 8),
  subject         text,
  teacher_name    text,
  updated_at      timestamptz default now(),
  unique (school_id, academic_year, class, day_of_week, period)
);
alter table timetable enable row level security;
drop policy if exists "dev all" on timetable;
create policy "dev all" on timetable for all using (true) with check (true);

-- ============================================
-- 3) CALENDAR_EVENTS — ปฏิทินวิชาการ
-- ============================================
create table if not exists calendar_events (
  id              uuid primary key default gen_random_uuid(),
  school_id       uuid not null references schools(id) on delete cascade,
  academic_year   integer not null,
  event_date      date not null,
  event_title     text not null,
  event_time      text,          -- HH:mm หรือ null
  responsible     text,
  description     text,
  color           text default '#3b82f6',
  created_by      text,
  created_at      timestamptz default now()
);
create index if not exists idx_cal_date on calendar_events(school_id, academic_year, event_date);
alter table calendar_events enable row level security;
drop policy if exists "dev all" on calendar_events;
create policy "dev all" on calendar_events for all using (true) with check (true);

-- ============================================
-- 4) ASSIGNMENTS — ระบบส่งงาน / การบ้าน
-- ============================================
create table if not exists assignments (
  id              uuid primary key default gen_random_uuid(),
  school_id       uuid not null references schools(id) on delete cascade,
  academic_year   integer not null,
  class           text not null,
  subject         text not null,
  title           text not null,
  max_score       numeric(6,2) default 35,
  assigned_date   date,
  due_date        date,
  description     text,
  created_by      text,
  created_at      timestamptz default now()
);
create index if not exists idx_assign_class on assignments(school_id, academic_year, class);
alter table assignments enable row level security;
drop policy if exists "dev all" on assignments;
create policy "dev all" on assignments for all using (true) with check (true);

create table if not exists assignment_scores (
  id              uuid primary key default gen_random_uuid(),
  assignment_id   uuid not null references assignments(id) on delete cascade,
  school_id       uuid not null references schools(id) on delete cascade,
  student_id      text not null,
  score           numeric(6,2),
  submitted       boolean default false,
  recorded_by     text,
  recorded_at     timestamptz default now(),
  unique (assignment_id, student_id)
);
alter table assignment_scores enable row level security;
drop policy if exists "dev all" on assignment_scores;
create policy "dev all" on assignment_scores for all using (true) with check (true);

-- ============================================
-- 5) GRADES — บันทึกผลการเรียน
-- ============================================
create table if not exists grades (
  id              uuid primary key default gen_random_uuid(),
  school_id       uuid not null references schools(id) on delete cascade,
  academic_year   integer not null,
  class           text not null,
  student_id      text not null,
  subject         text not null,
  semester        smallint not null check (semester in (1, 2)),
  score           numeric(6,2),
  max_score       numeric(6,2) default 100,
  updated_by      text,
  updated_at      timestamptz default now(),
  unique (school_id, academic_year, student_id, subject, semester)
);
create index if not exists idx_grades_class on grades(school_id, academic_year, class);
alter table grades enable row level security;
drop policy if exists "dev all" on grades;
create policy "dev all" on grades for all using (true) with check (true);

-- ============================================
-- ตรวจสอบ
-- ============================================
select 'enrollments' as t, count(*) from enrollments
union all select 'timetable', count(*) from timetable
union all select 'calendar_events', count(*) from calendar_events
union all select 'assignments', count(*) from assignments
union all select 'assignment_scores', count(*) from assignment_scores
union all select 'grades', count(*) from grades;
