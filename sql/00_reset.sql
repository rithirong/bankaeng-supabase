-- ============================================
-- 🧹 RESET — ล้างทุกตารางใน DB ให้ว่าง
-- ============================================
-- ใช้ในกรณี:
--   - เคยรัน schema/seed แล้วเจอ error
--   - อยากเริ่มต้นใหม่ทั้งหมด
--
-- ⚠️ ห้ามรันบน production! (จะลบข้อมูลทั้งหมด)
-- ============================================

-- drop table cascade จะลบ policy, trigger, index, foreign key ของตารางนั้นให้อัตโนมัติ
-- ไม่ต้อง drop policy แยก (เพราะถ้าตารางไม่มีจะ error)

drop table if exists attendance cascade;
drop table if exists students   cascade;
drop table if exists teachers   cascade;
drop table if exists schools    cascade;
drop function if exists set_updated_at() cascade;

select 'reset complete — รัน 01_schema.sql ต่อได้เลย' as status;
