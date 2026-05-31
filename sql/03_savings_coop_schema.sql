-- ============================================
-- Phase A — Savings + Coop Store tables
-- ============================================
-- รันใน Supabase SQL Editor (เพิ่มเติมจาก 01_schema.sql)
-- ============================================

-- ============================================
-- 💰 savings — รายการฝาก/ถอนเงินออมทรัพย์
-- ============================================
create table if not exists savings (
  id              uuid primary key default gen_random_uuid(),
  school_id       uuid not null references schools(id) on delete cascade,
  academic_year   integer not null,
  student_id      text not null,
  class           text,
  txn_date        date not null,
  type            text not null check (type in ('ฝาก', 'ถอน')),
  amount          numeric(10, 2) not null,
  remark          text,
  recorded_by     text,
  created_at      timestamptz default now(),
  -- FK ไปยัง students (cascade ลบเด็ก → ลบประวัติ + cascade เปลี่ยน student_id)
  constraint fk_savings_student
    foreign key (school_id, student_id)
    references students(school_id, student_id)
    on delete cascade
    on update cascade
);

create index if not exists idx_savings_year_class on savings(school_id, academic_year, class);
create index if not exists idx_savings_student    on savings(school_id, student_id);
create index if not exists idx_savings_date       on savings(school_id, txn_date);

-- RLS — เปิด permissive (จะ tighten ตอน production auth)
alter table savings enable row level security;
drop policy if exists "dev all" on savings;
create policy "dev all" on savings for all using (true) with check (true);

-- ============================================
-- 🛒 coop_entries — รายรับ-รายจ่ายสหกรณ์ร้านค้า
-- ============================================
create table if not exists coop_entries (
  id              uuid primary key default gen_random_uuid(),
  school_id       uuid not null references schools(id) on delete cascade,
  entry_date      date not null,
  type            text not null check (type in ('รายรับ', 'รายจ่าย')),
  category        text,
  description     text,
  amount          numeric(10, 2) not null check (amount > 0),
  receipt_url     text,
  recorded_by     text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists idx_coop_date on coop_entries(school_id, entry_date);
create index if not exists idx_coop_type on coop_entries(school_id, type);

alter table coop_entries enable row level security;
drop policy if exists "dev all" on coop_entries;
create policy "dev all" on coop_entries for all using (true) with check (true);

-- trigger updated_at สำหรับ coop_entries
drop trigger if exists trg_coop_updated_at on coop_entries;
create trigger trg_coop_updated_at
  before update on coop_entries
  for each row execute function set_updated_at();

-- ============================================
-- ตรวจสอบ
-- ============================================
select 'savings' as t, count(*) from savings
union all select 'coop_entries', count(*) from coop_entries;
