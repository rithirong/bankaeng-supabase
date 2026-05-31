-- ============================================
-- Seed data
-- ============================================

-- ====== ครู / Admin ======
-- หมายเหตุ: ตอน POC เก็บ password เป็น text ตรงๆ (ใน column password_hash)
--   จะเปลี่ยนเป็น bcrypt hash ตอนทำระบบ auth จริงใน app
insert into teachers (school_id, username, password_hash, name, class, role, position) values
  ((select id from schools where code = 'BK001'), 'admin',    'admin123',    'แอดมินระบบ',           'Admin', 'admin',   'ผู้ดูแลระบบ'),
  ((select id from schools where code = 'BK001'), 'teacher1', 'pass1234',    'นางสาวสมหญิง ใจดี',    'ป.1',   'teacher', 'ครูประจำชั้น'),
  ((select id from schools where code = 'BK001'), 'teacher2', 'pass1234',    'นายสมชาย ตั้งใจ',       'ป.2',   'teacher', 'ครูประจำชั้น'),
  ((select id from schools where code = 'BK001'), 'teacher3', 'pass1234',    'นางสมศรี รักเรียน',     'ป.3',   'teacher', 'ครูประจำชั้น')
on conflict (school_id, username) do nothing;

-- ====== นักเรียน 30 คน (ป.1-ป.6) ======
insert into students (school_id, student_id, class, no_in_class, prefix, first_name, last_name, gender, dob) values
-- ป.1
((select id from schools where code='BK001'), '4801', 'ป.1', 1, 'เด็กชาย', 'ภูมิรพี',   'โผผิน',         'ช', '2018-04-12'),
((select id from schools where code='BK001'), '4802', 'ป.1', 2, 'เด็กชาย', 'วงษกร',    'ชัยพงษ์',       'ช', '2018-05-09'),
((select id from schools where code='BK001'), '4803', 'ป.1', 3, 'เด็กหญิง', 'กรรณลดา',  'เกตุกลมเกลา', 'ญ', '2018-09-13'),
((select id from schools where code='BK001'), '4804', 'ป.1', 4, 'เด็กหญิง', 'ญาณิษา',   'บุญรอด',      'ญ', '2018-12-16'),
((select id from schools where code='BK001'), '4805', 'ป.1', 5, 'เด็กหญิง', 'วรวลัญช์',  'คำปัญโญ',     'ญ', '2018-07-07'),
-- ป.2
((select id from schools where code='BK001'), '4701', 'ป.2', 1, 'เด็กชาย', 'อิทธิพัทธ์', 'มีแก้ว',       'ช', '2017-09-25'),
((select id from schools where code='BK001'), '4702', 'ป.2', 2, 'เด็กชาย', 'ธนกฤต',    'แสงทอง',      'ช', '2017-03-18'),
((select id from schools where code='BK001'), '4703', 'ป.2', 3, 'เด็กหญิง', 'ศิริรัตน์',   'ชมชิต',       'ญ', '2017-01-28'),
((select id from schools where code='BK001'), '4704', 'ป.2', 4, 'เด็กหญิง', 'พิมพ์วิภา',  'อ่อนหวาน',     'ญ', '2017-06-15'),
((select id from schools where code='BK001'), '4705', 'ป.2', 5, 'เด็กชาย', 'ณัฐภัทร',   'พรหมสุข',     'ช', '2017-11-02'),
-- ป.3
((select id from schools where code='BK001'), '4601', 'ป.3', 1, 'เด็กชาย', 'กิตติศักดิ์', 'รุ่งเรือง',     'ช', '2016-02-14'),
((select id from schools where code='BK001'), '4602', 'ป.3', 2, 'เด็กหญิง', 'ปริยากร',   'ทับทิม',      'ญ', '2016-08-22'),
((select id from schools where code='BK001'), '4603', 'ป.3', 3, 'เด็กชาย', 'อภิวัฒน์',   'จันทร์เพ็ญ',    'ช', '2016-05-05'),
((select id from schools where code='BK001'), '4604', 'ป.3', 4, 'เด็กหญิง', 'ปัณฑิตา',   'ศรีสุข',       'ญ', '2016-10-30'),
((select id from schools where code='BK001'), '4605', 'ป.3', 5, 'เด็กหญิง', 'ภัทรวดี',    'มาลัย',       'ญ', '2016-12-01'),
-- ป.4
((select id from schools where code='BK001'), '4501', 'ป.4', 1, 'เด็กชาย', 'ปุณยวีร์',   'แสนสุข',      'ช', '2015-07-19'),
((select id from schools where code='BK001'), '4502', 'ป.4', 2, 'เด็กหญิง', 'กชกร',     'ดอกไม้',      'ญ', '2015-04-23'),
((select id from schools where code='BK001'), '4503', 'ป.4', 3, 'เด็กชาย', 'จิรภัทร',    'นกน้อย',      'ช', '2015-09-11'),
((select id from schools where code='BK001'), '4504', 'ป.4', 4, 'เด็กหญิง', 'นิชาภา',    'ปลายฟ้า',     'ญ', '2015-01-08'),
((select id from schools where code='BK001'), '4505', 'ป.4', 5, 'เด็กชาย', 'ธีรเดช',    'ภูเขา',        'ช', '2015-11-27'),
-- ป.5
((select id from schools where code='BK001'), '4401', 'ป.5', 1, 'เด็กหญิง', 'แพรวา',     'สายลม',      'ญ', '2014-03-15'),
((select id from schools where code='BK001'), '4402', 'ป.5', 2, 'เด็กชาย', 'รัฐภูมิ',     'เพชรงาม',    'ช', '2014-06-04'),
((select id from schools where code='BK001'), '4403', 'ป.5', 3, 'เด็กหญิง', 'ชนิดาภา',   'ทองคำ',      'ญ', '2014-10-21'),
((select id from schools where code='BK001'), '4404', 'ป.5', 4, 'เด็กชาย', 'พีรพล',     'ใสสะอาด',    'ช', '2014-08-09'),
((select id from schools where code='BK001'), '4405', 'ป.5', 5, 'เด็กหญิง', 'ลลิตา',     'รุ่งอรุณ',     'ญ', '2014-12-25'),
-- ป.6
((select id from schools where code='BK001'), '4301', 'ป.6', 1, 'เด็กชาย', 'นรวิชญ์',   'ภูริปัญญา',    'ช', '2013-05-30'),
((select id from schools where code='BK001'), '4302', 'ป.6', 2, 'เด็กหญิง', 'อรปรียา',   'ดวงดาว',     'ญ', '2013-08-14'),
((select id from schools where code='BK001'), '4303', 'ป.6', 3, 'เด็กชาย', 'ภัทรพล',    'สายฝน',      'ช', '2013-02-07'),
((select id from schools where code='BK001'), '4304', 'ป.6', 4, 'เด็กหญิง', 'ฐิติกานต์',  'ทุ่งเขียว',    'ญ', '2013-11-19'),
((select id from schools where code='BK001'), '4305', 'ป.6', 5, 'เด็กชาย', 'วรเมธ',    'พลังงาน',     'ช', '2013-04-03')
on conflict (school_id, student_id) do nothing;

-- ตรวจสอบ
select 'schools' as t, count(*) as n from schools
union all select 'teachers', count(*) from teachers
union all select 'students', count(*) from students;
