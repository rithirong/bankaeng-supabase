-- ============================================
-- Curriculum (หลักสูตร) table
-- ============================================
create table if not exists curriculum (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references schools(id) on delete cascade,
  academic_year integer not null,
  class         text not null,
  subject_id    text not null,        -- รหัสวิชา เช่น ท11101
  subject_name  text not null,        -- ชื่อวิชา
  hours         numeric(6,2) default 0,  -- ชั่วโมง/ปี
  credit        numeric(4,2) default 0,  -- หน่วยกิต (hours/40)
  subject_type  text default 'พื้นฐาน'
    check (subject_type in ('พื้นฐาน','เพิ่มเติม','กิจกรรมพัฒนาผู้เรียน')),
  score_ratio   text default '70:30'
    check (score_ratio in ('70:30','80:20','60:40','100:0')),
  teacher_name  text,                 -- ครูผู้สอน (คั่นด้วย ,)
  sort_order    integer default 0,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  unique (school_id, academic_year, class, subject_id)
);
create index if not exists idx_curriculum_class on curriculum(school_id, academic_year, class);
alter table curriculum enable row level security;
drop policy if exists "dev all" on curriculum;
create policy "dev all" on curriculum for all using (true) with check (true);

select 'curriculum' as t, count(*) from curriculum;
