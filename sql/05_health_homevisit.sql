-- ============================================
-- Health (BMI) + Home Visit tables
-- รันต่อจาก 04_new_features.sql
-- ============================================

-- 1) HEALTH — น้ำหนัก-ส่วนสูง
create table if not exists health (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references schools(id) on delete cascade,
  academic_year integer not null,
  semester      smallint not null check (semester in (1,2)),
  student_id    text not null,
  class         text not null,
  weight        numeric(5,2),   -- กก.
  height        numeric(5,2),   -- ซม.
  recorded_by   text,
  updated_at    timestamptz default now(),
  unique (school_id, academic_year, semester, student_id)
);
alter table health enable row level security;
drop policy if exists "dev all" on health;
create policy "dev all" on health for all using (true) with check (true);

-- 2) HOME_VISITS — เยี่ยมบ้าน
create table if not exists home_visits (
  id              uuid primary key default gen_random_uuid(),
  school_id       uuid not null references schools(id) on delete cascade,
  academic_year   integer not null,
  student_id      text not null,
  class           text not null,
  visit_date      date,
  visitor_name    text,
  visit_status    text default 'ยังไม่เยี่ยม'
    check (visit_status in ('ยังไม่เยี่ยม','เยี่ยมแล้ว','นัดหมาย')),
  house_condition text,
  parent_concern  text,
  teacher_note    text,
  lat             numeric(10,7),
  lng             numeric(10,7),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique (school_id, academic_year, student_id)
);
alter table home_visits enable row level security;
drop policy if exists "dev all" on home_visits;
create policy "dev all" on home_visits for all using (true) with check (true);

select 'health' as t, count(*) from health
union all select 'home_visits', count(*) from home_visits;
