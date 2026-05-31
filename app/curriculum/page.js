'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { getSession } from '@/lib/auth';
import { useYear } from '@/lib/year';
import { supabase } from '@/lib/supabase';

const CLASSES = ['อ.2','อ.3','ป.1','ป.2','ป.3','ป.4','ป.5','ป.6'];
const TYPES   = ['พื้นฐาน','เพิ่มเติม','กิจกรรมพัฒนาผู้เรียน'];
const RATIOS  = ['70:30','80:20','60:40','100:0'];

const EMPTY_FORM = {
  subject_id: '', subject_name: '', hours: '', credit: '',
  subject_type: 'พื้นฐาน', score_ratio: '70:30', teacher_name: '',
};

export default function CurriculumPage() {
  const router = useRouter();
  const [s, setS] = useState(null);
  const [year] = useYear();

  useEffect(() => {
    const sess = getSession();
    if (!sess || sess.role === 'parent') { router.replace('/'); return; }
    setS(sess);
  }, [router]);

  if (!s) return null;
  return (
    <>
      <TopBar />
      <div className="wrap">
        <div className="card">
          <h2 style={{ margin: '0 0 14px' }}>📑 จัดการหลักสูตรและรายวิชา ปีการศึกษา {year}</h2>
          <CurrMain session={s} year={year} />
        </div>
      </div>
    </>
  );
}

function CurrMain({ session, year }) {
  const [cls, setCls] = useState(session.role === 'teacher' && session.class ? session.class : '');
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editId, setEditId] = useState(null); // uuid ของ record ที่กำลังแก้
  const [toast, setToast] = useState('');
  const [teacherList, setTeacherList] = useState([]);
  const [showTeacherDrop, setShowTeacherDrop] = useState(false);

  // โหลดรายชื่อครู
  useEffect(() => {
    supabase.from('teachers').select('name').eq('school_id', session.schoolId).eq('hidden', false)
      .then(({ data }) => setTeacherList((data || []).map(t => t.name)));
  }, []);

  useEffect(() => { if (cls) load(); }, [cls, year]);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('curriculum')
      .select('*')
      .eq('school_id', session.schoolId)
      .eq('academic_year', year)
      .eq('class', cls)
      .order('sort_order').order('created_at');
    setLoading(false);
    if (error) return alert('❌ ' + error.message);
    setSubjects(data || []);
  }

  function setF(k, v) { setForm(p => ({ ...p, [k]: v })); }

  function startEdit(row) {
    setEditId(row.id);
    setForm({
      subject_id: row.subject_id,
      subject_name: row.subject_name,
      hours: row.hours ?? '',
      credit: row.credit ?? '',
      subject_type: row.subject_type,
      score_ratio: row.score_ratio,
      teacher_name: row.teacher_name || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() { setEditId(null); setForm({ ...EMPTY_FORM }); }

  async function save() {
    if (!form.subject_id.trim() || !form.subject_name.trim()) return alert('⚠️ กรุณากรอกรหัสวิชาและชื่อวิชา');
    if (!cls) return alert('⚠️ เลือกชั้นก่อน');
    const hrs = parseFloat(form.hours) || 0;
    const crd = hrs > 0 ? parseFloat((hrs / 40).toFixed(2)) : (parseFloat(form.credit) || 0);
    const payload = {
      school_id: session.schoolId,
      academic_year: year,
      class: cls,
      subject_id: form.subject_id.trim(),
      subject_name: form.subject_name.trim(),
      hours: hrs,
      credit: crd,
      subject_type: form.subject_type,
      score_ratio: form.score_ratio,
      teacher_name: form.teacher_name.trim() || null,
      sort_order: editId ? undefined : subjects.length,
      updated_at: new Date().toISOString(),
    };
    if (payload.sort_order === undefined) delete payload.sort_order;

    const { error } = editId
      ? await supabase.from('curriculum').update(payload).eq('id', editId)
      : await supabase.from('curriculum').upsert(payload, { onConflict: 'school_id,academic_year,class,subject_id' });
    if (error) return alert('❌ ' + error.message);
    showToast(editId ? '✅ แก้ไขวิชาแล้ว' : '✅ เพิ่มวิชาแล้ว');
    cancelEdit();
    load();
  }

  async function del(row) {
    if (!confirm(`ลบวิชา "${row.subject_name}"?`)) return;
    await supabase.from('curriculum').delete().eq('id', row.id);
    load();
  }

  // คัดลอกจากปีที่แล้ว
  async function copyFromLastYear() {
    if (!cls) return alert('⚠️ เลือกชั้นก่อน');
    if (!confirm(`คัดลอกหลักสูตร ${cls} จากปีการศึกษา ${year - 1} มาใส่ปี ${year}?`)) return;
    const { data, error } = await supabase
      .from('curriculum').select('*')
      .eq('school_id', session.schoolId).eq('academic_year', year - 1).eq('class', cls);
    if (error) return alert('❌ ' + error.message);
    if (!data?.length) return alert(`ไม่พบข้อมูลหลักสูตร ${cls} ปี ${year - 1}`);
    const rows = data.map(r => ({
      school_id: r.school_id, academic_year: year, class: r.class,
      subject_id: r.subject_id, subject_name: r.subject_name,
      hours: r.hours, credit: r.credit,
      subject_type: r.subject_type, score_ratio: r.score_ratio,
      teacher_name: r.teacher_name, sort_order: r.sort_order,
    }));
    const { error: e2 } = await supabase.from('curriculum')
      .upsert(rows, { onConflict: 'school_id,academic_year,class,subject_id' });
    if (e2) return alert('❌ ' + e2.message);
    showToast(`✅ คัดลอก ${rows.length} วิชาจากปี ${year - 1} สำเร็จ`);
    load();
  }

  // คัดลอกจากชั้นอื่น
  async function copyFromClass(srcCls) {
    if (!srcCls) return;
    if (!cls) return alert('⚠️ เลือกชั้นปลายทางก่อน');
    if (srcCls === cls) return alert('ต้นทางและปลายทางเป็นชั้นเดียวกัน');
    if (!confirm(`คัดลอกหลักสูตรจาก ${srcCls} มาใส่ ${cls} (ปี ${year})?`)) return;
    const { data, error } = await supabase
      .from('curriculum').select('*')
      .eq('school_id', session.schoolId).eq('academic_year', year).eq('class', srcCls);
    if (error) return alert('❌ ' + error.message);
    if (!data?.length) return alert(`ไม่พบข้อมูลหลักสูตร ${srcCls}`);
    const rows = data.map(r => ({
      school_id: r.school_id, academic_year: year, class: cls,
      subject_id: r.subject_id, subject_name: r.subject_name,
      hours: r.hours, credit: r.credit,
      subject_type: r.subject_type, score_ratio: r.score_ratio,
      teacher_name: r.teacher_name, sort_order: r.sort_order,
    }));
    const { error: e2 } = await supabase.from('curriculum')
      .upsert(rows, { onConflict: 'school_id,academic_year,class,subject_id' });
    if (e2) return alert('❌ ' + e2.message);
    showToast(`✅ คัดลอก ${rows.length} วิชาจาก ${srcCls} สำเร็จ`);
    load();
  }

  function showToast(m) { setToast(m); setTimeout(() => setToast(''), 2200); }

  function toggleTeacher(name) {
    const cur = form.teacher_name;
    const list = cur ? cur.split(',').map(s => s.trim()).filter(Boolean) : [];
    const idx = list.indexOf(name);
    if (idx >= 0) list.splice(idx, 1); else list.push(name);
    setF('teacher_name', list.join(', '));
  }

  // สรุปชั่วโมงตามประเภท
  const sumHours = (type) => subjects.filter(s => s.subject_type === type).reduce((a, s) => a + (Number(s.hours) || 0), 0);
  const totalHours = subjects.reduce((a, s) => a + (Number(s.hours) || 0), 0);

  // สรุปชั่วโมงครู
  const teacherHrs = {};
  subjects.forEach(s => {
    if (!s.teacher_name) return;
    s.teacher_name.split(',').forEach(t => {
      const tn = t.trim();
      if (!tn) return;
      if (!teacherHrs[tn]) teacherHrs[tn] = { total: 0, subs: [] };
      const hpw = (Number(s.hours) || 0) / 40;
      teacherHrs[tn].total += hpw;
      teacherHrs[tn].subs.push(`${s.subject_name}(${hpw.toFixed(1)})`);
    });
  });

  return (
    <>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600 }}>ชั้นเรียน</label>
          <select value={cls} onChange={e => setCls(e.target.value)}>
            <option value="">-- เลือก --</option>
            {CLASSES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        {cls && (
          <>
            <button className="secondary" style={{ marginTop: 18 }} onClick={copyFromLastYear}>
              🔄 ดึงจากปีที่แล้ว ({year - 1})
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 18, background: '#fef3c7', padding: '6px 10px', borderRadius: 8, border: '1px solid #fcd34d' }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>📥 คัดลอกจากชั้น:</span>
              <select defaultValue="" onChange={e => { copyFromClass(e.target.value); e.target.value = ''; }}
                style={{ width: 80, padding: '4px 6px' }}>
                <option value="">เลือก</option>
                {CLASSES.filter(c => c !== cls).map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </>
        )}
      </div>

      {/* สรุปชั่วโมง */}
      {subjects.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, background: '#f0fdf4', padding: 10, borderRadius: 8, border: '1px solid #bbf7d0', flexWrap: 'wrap' }}>
          {TYPES.map(t => (
            <div key={t} style={{ textAlign: 'center', minWidth: 80 }}>
              <div style={{ fontSize: 11, color: '#64748b' }}>{t}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#15803d' }}>{sumHours(t)}</div>
            </div>
          ))}
          <div style={{ textAlign: 'center', minWidth: 80, borderLeft: '1px solid #bbf7d0', paddingLeft: 10 }}>
            <div style={{ fontSize: 11, color: '#64748b' }}>รวม</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#dc2626' }}>{totalHours}</div>
          </div>
          <div style={{ fontSize: 11, color: '#64748b', alignSelf: 'center' }}>ชั่วโมง/ปี</div>
        </div>
      )}

      {/* ฟอร์มเพิ่ม/แก้ไข */}
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, marginBottom: 16 }}>
        <h4 style={{ margin: '0 0 10px', color: editId ? '#b45309' : '#1e40af' }}>
          {editId ? '✏️ แก้ไขรายวิชา' : '➕ เพิ่มรายวิชา'}
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600 }}>รหัสวิชา *</label>
            <input value={form.subject_id} onChange={e => setF('subject_id', e.target.value)} placeholder="เช่น ท11101" />
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <label style={{ fontSize: 11, fontWeight: 600 }}>ชื่อวิชา *</label>
            <input value={form.subject_name} onChange={e => setF('subject_name', e.target.value)} placeholder="เช่น ภาษาไทย" />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600 }}>ชั่วโมง/ปี</label>
            <input type="number" min="0" step="1" value={form.hours}
              onChange={e => { setF('hours', e.target.value); setF('credit', e.target.value ? (e.target.value / 40).toFixed(2) : ''); }}
              placeholder="ชม." />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600 }}>หน่วยกิต</label>
            <input type="number" step="0.5" value={form.credit}
              onChange={e => setF('credit', e.target.value)} placeholder="อัตโนมัติ" style={{ background: '#f1f5f9' }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600 }}>ประเภท</label>
            <select value={form.subject_type} onChange={e => setF('subject_type', e.target.value)}>
              {TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600 }}>สัดส่วน (ระหว่าง:ปลาย)</label>
            <select value={form.score_ratio} onChange={e => setF('score_ratio', e.target.value)}>
              {RATIOS.map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
        </div>

        {/* เลือกครูผู้สอน */}
        <div style={{ marginTop: 10 }}>
          <label style={{ fontSize: 11, fontWeight: 600 }}>ครูผู้สอน</label>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <button type="button" className="secondary" style={{ fontSize: 12 }}
              onClick={() => setShowTeacherDrop(p => !p)}>
              👨‍🏫 เลือกครู ▼
            </button>
            {showTeacherDrop && (
              <div style={{ position: 'absolute', top: '100%', left: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 8, zIndex: 50, minWidth: 200, maxHeight: 200, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                {teacherList.map(t => {
                  const checked = form.teacher_name.split(',').map(s => s.trim()).includes(t);
                  return (
                    <div key={t} onClick={() => toggleTeacher(t)}
                      style={{ padding: '6px 8px', cursor: 'pointer', background: checked ? '#dbeafe' : 'transparent', borderRadius: 4, marginBottom: 2, fontSize: 13 }}>
                      {checked ? '✅' : '☐'} {t}
                    </div>
                  );
                })}
                <button type="button" className="secondary" style={{ width: '100%', marginTop: 6, fontSize: 12 }}
                  onClick={() => setShowTeacherDrop(false)}>ปิด</button>
              </div>
            )}
          </div>
          <input value={form.teacher_name}
            onChange={e => setF('teacher_name', e.target.value)}
            placeholder="หรือพิมพ์ชื่อ (คั่นด้วย ,)"
            style={{ marginLeft: 8, width: 280 }} />
        </div>

        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button className="success" onClick={save}>💾 {editId ? 'บันทึกการแก้ไข' : 'เพิ่มวิชา'}</button>
          {editId && <button className="secondary" onClick={cancelEdit}>ยกเลิก</button>}
        </div>
      </div>

      {/* ตารางวิชา */}
      {loading && <div style={{ textAlign: 'center', padding: 20, color: '#64748b' }}>⏳ กำลังโหลด...</div>}

      {!loading && subjects.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ fontSize: 13 }}>
            <thead>
              <tr>
                <th>#</th>
                <th>รหัสวิชา</th>
                <th>ชื่อวิชา</th>
                <th style={{ textAlign: 'center' }}>ชม.</th>
                <th style={{ textAlign: 'center' }}>นก.</th>
                <th>ประเภท</th>
                <th style={{ textAlign: 'center' }}>สัดส่วน</th>
                <th>ครูผู้สอน</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((row, i) => (
                <tr key={row.id} style={{ background: editId === row.id ? '#fef3c7' : 'transparent' }}>
                  <td>{i + 1}</td>
                  <td><b>{row.subject_id}</b></td>
                  <td>{row.subject_name}</td>
                  <td style={{ textAlign: 'center' }}>{row.hours || '—'}</td>
                  <td style={{ textAlign: 'center' }}>{row.credit || '—'}</td>
                  <td>
                    <span style={{
                      fontSize: 11, padding: '2px 6px', borderRadius: 4, fontWeight: 600,
                      background: row.subject_type === 'พื้นฐาน' ? '#dbeafe' : row.subject_type === 'เพิ่มเติม' ? '#dcfce7' : '#fef3c7',
                      color: row.subject_type === 'พื้นฐาน' ? '#1e40af' : row.subject_type === 'เพิ่มเติม' ? '#166534' : '#92400e',
                    }}>{row.subject_type}</span>
                  </td>
                  <td style={{ textAlign: 'center' }}>{row.score_ratio}</td>
                  <td style={{ fontSize: 12, color: '#475569' }}>{row.teacher_name || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="secondary" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => startEdit(row)}>✏️</button>
                      <button style={{ padding: '3px 8px', fontSize: 11, background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, cursor: 'pointer' }} onClick={() => del(row)}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && cls && subjects.length === 0 && (
        <div style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}>
          ยังไม่มีรายวิชา — กรอกฟอร์มด้านบนเพื่อเพิ่มวิชาแรก
        </div>
      )}

      {/* สรุปชั่วโมงครู */}
      {Object.keys(teacherHrs).length > 0 && (
        <div style={{ marginTop: 20, background: '#f0f9ff', border: '2px solid #bae6fd', borderRadius: 12, padding: 14 }}>
          <h4 style={{ margin: '0 0 10px', color: '#0369a1' }}>👨‍🏫 สรุปชั่วโมงสอน (ชม./สัปดาห์)</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {Object.entries(teacherHrs).sort((a, b) => b[1].total - a[1].total).map(([name, info]) => (
              <div key={name} style={{ background: '#fff', border: '1px solid #bae6fd', borderRadius: 8, padding: '8px 12px', minWidth: 140 }}>
                <div style={{ fontWeight: 700, color: '#0369a1', fontSize: 13 }}>{name}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#0c4a6e' }}>{info.total.toFixed(1)} <span style={{ fontSize: 12, color: '#64748b' }}>ชม./สัปดาห์</span></div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{info.subs.join(', ')}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {toast && <div className="toast show">{toast}</div>}
    </>
  );
}
