'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { getSession } from '@/lib/auth';
import { useYear } from '@/lib/year';
import { supabase } from '@/lib/supabase';

const EMPTY = { teacher_name:'', training_name:'', location:'', organizer:'', receive_date:'', hours:'' };

export default function TrainingsPage() {
  const router = useRouter();
  const [s, setS] = useState(null);
  const [year] = useYear();
  useEffect(() => {
    const sess = getSession();
    if (!sess || sess.role === 'parent') { router.replace('/'); return; }
    setS(sess);
  }, [router]);
  if (!s) return null;
  return (<><TopBar /><div className="wrap"><div className="card">
    <h2 style={{margin:'0 0 14px'}}>🎓 วุฒิบัตรอบรม ปีการศึกษา {year}</h2>
    <TrainingMain session={s} year={year} />
  </div></div></>);
}

function TrainingMain({ session, year }) {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({...EMPTY});
  const [editId, setEditId] = useState(null);
  const [search, setSearch] = useState('');
  const [teachers, setTeachers] = useState([]);
  const [toast, setToast] = useState('');

  useEffect(() => {
    load();
    supabase.from('teachers').select('name').eq('school_id',session.schoolId).eq('hidden',false)
      .then(({data})=>setTeachers((data||[]).map(t=>t.name)));
  }, [year]);

  async function load() {
    const { data } = await supabase.from('trainings').select('*')
      .eq('school_id',session.schoolId).eq('academic_year',year)
      .order('receive_date',{ascending:false});
    setRows(data||[]);
  }
  async function save() {
    if (!form.teacher_name||!form.training_name) return alert('⚠️ กรอกชื่อครูและชื่อการอบรม');
    const payload = { school_id:session.schoolId, academic_year:year, ...form,
      hours:parseFloat(form.hours)||null, receive_date:form.receive_date||null };
    const { error } = editId
      ? await supabase.from('trainings').update(payload).eq('id',editId)
      : await supabase.from('trainings').insert(payload);
    if (error) return alert('❌ '+error.message);
    setForm({...EMPTY}); setEditId(null);
    setToast(editId?'✅ แก้ไขแล้ว':'✅ เพิ่มวุฒิบัตรแล้ว'); setTimeout(()=>setToast(''),2000);
    load();
  }
  async function del(id) {
    if (!confirm('ลบ?')) return;
    await supabase.from('trainings').delete().eq('id',id); load();
  }

  const filtered = search ? rows.filter(r=>r.teacher_name.includes(search)||r.training_name.includes(search)) : rows;

  // สรุปชั่วโมงอบรมต่อครู
  const teacherHrs = {};
  rows.forEach(r=>{ if(r.teacher_name){ teacherHrs[r.teacher_name]=(teacherHrs[r.teacher_name]||0)+(Number(r.hours)||0); }});

  return (<>
    <div style={{background:'#fff7ed',border:'1px solid #fed7aa',borderRadius:10,padding:14,marginBottom:16}}>
      <h4 style={{margin:'0 0 10px',color:'#c2410c'}}>{editId?'✏️ แก้ไข':'➕ เพิ่มวุฒิบัตรอบรม'}</h4>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:8}}>
        <div><label style={{fontSize:11,fontWeight:600}}>ครู/บุคลากร *</label>
          <select value={form.teacher_name} onChange={e=>setForm(p=>({...p,teacher_name:e.target.value}))}>
            <option value="">-- เลือก --</option>
            {teachers.map(t=><option key={t}>{t}</option>)}
          </select></div>
        <div style={{gridColumn:'span 2'}}><label style={{fontSize:11,fontWeight:600}}>ชื่อหลักสูตร/การอบรม *</label>
          <input value={form.training_name} onChange={e=>setForm(p=>({...p,training_name:e.target.value}))} /></div>
        <div><label style={{fontSize:11,fontWeight:600}}>สถานที่</label>
          <input value={form.location} onChange={e=>setForm(p=>({...p,location:e.target.value}))} /></div>
        <div><label style={{fontSize:11,fontWeight:600}}>หน่วยงานจัด</label>
          <input value={form.organizer} onChange={e=>setForm(p=>({...p,organizer:e.target.value}))} /></div>
        <div><label style={{fontSize:11,fontWeight:600}}>วันที่รับ</label>
          <input type="date" value={form.receive_date} onChange={e=>setForm(p=>({...p,receive_date:e.target.value}))} /></div>
        <div><label style={{fontSize:11,fontWeight:600}}>ชั่วโมง</label>
          <input type="number" value={form.hours} onChange={e=>setForm(p=>({...p,hours:e.target.value}))} placeholder="ชม." /></div>
      </div>
      <div style={{marginTop:10,display:'flex',gap:8}}>
        <button className="success" onClick={save}>💾 {editId?'บันทึกการแก้ไข':'เพิ่ม'}</button>
        {editId&&<button className="secondary" onClick={()=>{setEditId(null);setForm({...EMPTY});}}>ยกเลิก</button>}
      </div>
    </div>

    {/* สรุปชั่วโมงครู */}
    {Object.keys(teacherHrs).length>0&&(
      <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:12}}>
        {Object.entries(teacherHrs).map(([name,hrs])=>(
          <div key={name} style={{background:'#fff7ed',border:'1px solid #fed7aa',borderRadius:8,padding:'6px 12px',fontSize:12}}>
            <b>{name}</b>: {hrs} ชม.
          </div>
        ))}
      </div>
    )}

    <div style={{display:'flex',gap:8,marginBottom:10}}>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 ค้นหาครู/หลักสูตร..." style={{width:200}} />
      <span style={{padding:'6px 12px',background:'#fff7ed',color:'#c2410c',borderRadius:8,fontWeight:700,fontSize:13}}>
        {filtered.length} รายการ
      </span>
    </div>

    <div style={{overflowX:'auto'}}>
      <table style={{fontSize:13}}>
        <thead><tr><th>#</th><th>ครู/บุคลากร</th><th>ชื่อหลักสูตร</th><th>หน่วยงานจัด</th><th>ชั่วโมง</th><th>วันที่</th><th>จัดการ</th></tr></thead>
        <tbody>
          {filtered.map((r,i)=>(
            <tr key={r.id}>
              <td>{i+1}</td><td><b>{r.teacher_name}</b></td>
              <td style={{textAlign:'left'}}>{r.training_name}</td>
              <td>{r.organizer||'—'}</td>
              <td style={{textAlign:'center'}}>{r.hours||'—'}</td>
              <td>{r.receive_date||'—'}</td>
              <td><div style={{display:'flex',gap:4}}>
                <button className="secondary" style={{padding:'3px 8px',fontSize:11}} onClick={()=>{setEditId(r.id);setForm({teacher_name:r.teacher_name,training_name:r.training_name,location:r.location||'',organizer:r.organizer||'',receive_date:r.receive_date||'',hours:r.hours||''});}}>✏️</button>
                <button style={{padding:'3px 8px',fontSize:11,background:'#fee2e2',color:'#dc2626',border:'none',borderRadius:6,cursor:'pointer'}} onClick={()=>del(r.id)}>🗑️</button>
              </div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    {toast&&<div className="toast show">{toast}</div>}
  </>);
}
