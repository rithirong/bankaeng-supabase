-- ============================================
-- Remaining Features Schema
-- eval_attr, eval_reading, eval_competency,
-- deeds, scholarships, certificates, trainings, documents
-- ============================================

-- 1) คุณลักษณะอันพึงประสงค์ (8 ข้อ, เต็ม 3 ต่อข้อ)
create table if not exists eval_attr (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references schools(id) on delete cascade,
  academic_year integer not null,
  semester      smallint not null check (semester in (1,2)),
  student_id    text not null,
  class         text not null,
  s1 smallint default 0, s2 smallint default 0, s3 smallint default 0,
  s4 smallint default 0, s5 smallint default 0, s6 smallint default 0,
  s7 smallint default 0, s8 smallint default 0,
  recorded_by   text,
  updated_at    timestamptz default now(),
  unique (school_id, academic_year, semester, student_id)
);
alter table eval_attr enable row level security;
drop policy if exists "dev all" on eval_attr;
create policy "dev all" on eval_attr for all using (true) with check (true);

-- 2) อ่าน คิดวิเคราะห์ และเขียน (5 ข้อ, เต็ม 5 ต่อข้อ)
create table if not exists eval_reading (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references schools(id) on delete cascade,
  academic_year integer not null,
  semester      smallint not null check (semester in (1,2)),
  student_id    text not null,
  class         text not null,
  r1 smallint default 0, r2 smallint default 0, r3 smallint default 0,
  r4 smallint default 0, r5 smallint default 0,
  recorded_by   text,
  updated_at    timestamptz default now(),
  unique (school_id, academic_year, semester, student_id)
);
alter table eval_reading enable row level security;
drop policy if exists "dev all" on eval_reading;
create policy "dev all" on eval_reading for all using (true) with check (true);

-- 3) สมรรถนะสำคัญ 5 ประการ (5 ข้อ, เต็ม 3 ต่อข้อ)
create table if not exists eval_competency (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references schools(id) on delete cascade,
  academic_year integer not null,
  semester      smallint not null check (semester in (1,2)),
  student_id    text not null,
  class         text not null,
  c1 smallint default 0, c2 smallint default 0, c3 smallint default 0,
  c4 smallint default 0, c5 smallint default 0,
  recorded_by   text,
  updated_at    timestamptz default now(),
  unique (school_id, academic_year, semester, student_id)
);
alter table eval_competency enable row level security;
drop policy if exists "dev all" on eval_competency;
create policy "dev all" on eval_competency for all using (true) with check (true);

-- 4) สมุดบันทึกความดี
create table if not exists deeds (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references schools(id) on delete cascade,
  academic_year integer not null,
  student_id    text not null,
  class         text not null,
  deed_date     date not null,
  detail        text not null,
  status        text default 'รอรับรอง' check (status in ('รอรับรอง','รับรองแล้ว')),
  approved_by   text,
  created_by    text,
  created_at    timestamptz default now()
);
create index if not exists idx_deeds_student on deeds(school_id, academic_year, student_id);
alter table deeds enable row level security;
drop policy if exists "dev all" on deeds;
create policy "dev all" on deeds for all using (true) with check (true);

-- 5) ทุนการศึกษา
create table if not exists scholarships (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references schools(id) on delete cascade,
  academic_year integer not null,
  student_id    text not null,
  class         text not null,
  scholarship_name text not null,
  amount        numeric(10,2) default 0,
  source        text,
  receive_date  date,
  note          text,
  created_by    text,
  created_at    timestamptz default now()
);
create index if not exists idx_sch_student on scholarships(school_id, academic_year, student_id);
alter table scholarships enable row level security;
drop policy if exists "dev all" on scholarships;
create policy "dev all" on scholarships for all using (true) with check (true);

-- 6) เกียรติบัตร
create table if not exists certificates (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references schools(id) on delete cascade,
  academic_year integer not null,
  cert_type     text default 'นักเรียน' check (cert_type in ('นักเรียน','ครู')),
  owner         text not null,
  class         text,
  cert_name     text not null,
  level         text,
  receive_date  date,
  file_url      text,
  created_by    text,
  created_at    timestamptz default now()
);
create index if not exists idx_cert_year on certificates(school_id, academic_year);
alter table certificates enable row level security;
drop policy if exists "dev all" on certificates;
create policy "dev all" on certificates for all using (true) with check (true);

-- 7) วุฒิบัตรอบรม (ครู)
create table if not exists trainings (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references schools(id) on delete cascade,
  academic_year integer not null,
  teacher_name  text not null,
  training_name text not null,
  location      text,
  organizer     text,
  receive_date  date,
  hours         numeric(5,1),
  file_url      text,
  created_at    timestamptz default now()
);
create index if not exists idx_training_year on trainings(school_id, academic_year);
alter table trainings enable row level security;
drop policy if exists "dev all" on trainings;
create policy "dev all" on trainings for all using (true) with check (true);

-- 8) งานสารบรรณ
create table if not exists documents (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references schools(id) on delete cascade,
  academic_year integer not null,
  doc_type      text default 'รับ' check (doc_type in ('รับ','ส่ง')),
  doc_number    text,
  doc_subject   text not null,
  person        text,
  doc_date      date,
  note          text,
  file_url      text,
  created_by    text,
  created_at    timestamptz default now()
);
create index if not exists idx_doc_year on documents(school_id, academic_year);
alter table documents enable row level security;
drop policy if exists "dev all" on documents;
create policy "dev all" on documents for all using (true) with check (true);

select 'eval_attr' as t, count(*) from eval_attr
union all select 'eval_reading', count(*) from eval_reading
union all select 'eval_competency', count(*) from eval_competency
union all select 'deeds', count(*) from deeds
union all select 'scholarships', count(*) from scholarships
union all select 'certificates', count(*) from certificates
union all select 'trainings', count(*) from trainings
union all select 'documents', count(*) from documents;
