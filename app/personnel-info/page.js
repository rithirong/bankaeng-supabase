'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { getSession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { makePrintWindow, makePrintHeader } from '@/lib/printTemplate';

export default function PersonnelInfoPage() {
  const router = useRouter();
  const [s, setS] = useState(null);
  useEffect(() => {
    const sess = getSession();
    if (!sess || sess.role === 'parent') { router.replace('/'); return; }
    setS(sess);
  }, [router]);
  if (!s) return null;
  return (<><TopBar /><div className="wrap"><div className="card">
    <h2 style={{margin:'0 0 14px'}}>👤 ข้อมูลบุคลากร</h2>
    <PersonnelMain session={s} />
  </div></div></>);
}

const EMPTY_PROFILE = {
  national_id:'', dob:'', phone:'', position:'ครู', position_level:'',
  edu_degree:'', edu_major:'', edu_institute:'', start_date:'', address:''
};

function PersonnelMain({ session }) {
  const [view, setView] = useState('cards'); // cards | table | edit
  const [teachers, setTeachers] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [editTeacher, setEditTeacher] = useState(null);
  const [form, setForm] = useState({...EMPTY_PROFILE});
  const [toast, setToast] = useState('');
  const isAdmin = session.role === 'admin';

  useEffect(() => { load(); }, []);

  async function load() {
    const [tRes, pRes] = await Promise.all([
      supabase.from('teachers').select('id,name,class,role,phone,position').eq('school_id',session.schoolId).eq('hidden',false).order('name'),
      supabase.from('teacher_profiles').select('*').eq('school_id',session.schoolId),
    ]);
    setTeachers(tRes.data||[]);
    const pm = {};
    (pRes.data||[]).forEach(p=>{ pm[p.teacher_id]=p; });
    setProfiles(pm);
  }

  function openEdit(teacher) {
    const p = profiles[teacher.id] || {};
    setForm({ national_id:p.national_id||'', dob:p.dob||'', phone:p.phone||teacher.phone||'',
      position:p.position||teacher.position||'ครู', position_level:p.position_level||'',
      edu_degree:p.edu_degree||'', edu_major:p.edu_major||'',
      edu_institute:p.edu_institute||'', start_date:p.start_date||'', address:p.address||'' });
    setEditTeacher(teacher);
    setView('edit');
  }

  async function saveProfile() {
    const payload = { school_id:session.schoolId, teacher_id:editTeacher.id, ...form,
      dob:form.dob||null, start_date:form.start_date||null, updated_at:new Date().toISOString() };
    const { error } = await supabase.from('teacher_profiles')
      .upsert(payload, { onConflict:'school_id,teacher_id' });
    if (error) return alert('❌ '+error.message);
    // อัปเดตข้อมูลหลักใน teachers
    await supabase.from('teachers').update({ phone:form.phone, position:form.position }).eq('id',editTeacher.id);
    setToast('✅ บันทึกข้อมูลแล้ว'); setTimeout(()=>setToast(''),2000);
    setView('cards'); load();
  }

  function doPrint() {
    const schoolName = session.school?.name || 'โรงเรียนบ้านแก่ง';
    const tbody = teachers.map((t,i)=>{
      const p=profiles[t.id]||{};
      return `<tr><td>${i+1}</td><td class="text-left"><b>${t.name}</b></td>
      <td>${p.position||t.position||'—'}</td><td>${t.class||'—'}</td>
      <td>${p.phone||t.phone||'—'}</td><td>${p.edu_degree||'—'}</td>
      <td>${p.edu_major||'—'}</td><td>${p.start_date||'—'}</td></tr>`;
    }).join('');
    const html = `
      ${makePrintHeader(schoolName, 'ทำเนียบบุคลากร', schoolName)}
      <table><thead><tr><th>#</th><th>ชื่อ-สกุล</th><th>ตำแหน่ง</th><th>ประจำชั้น</th><th>เบอร์ติดต่อ</th><th>วุฒิการศึกษา</th><th>สาขา</th><th>วันบรรจุ</th></tr></thead>
      <tbody>${tbody}</tbody></table>
    `;
    makePrintWindow(html, 'landscape');
  }

  if (view==='edit' && editTeacher) return (
    <>
      <button className="secondary" style={{marginBottom:14}} onClick={()=>setView('cards')}>← กลับ</button>
      <h3 style={{margin:'0 0 14px',color:'#1e40af'}}>✏️ แก้ไขข้อมูล: {editTeacher.name}</h3>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:10}}>
        {[['ตำแหน่ง','position'],['วิทยฐานะ/ระดับ','position_level'],['เลขบัตรประชาชน','national_id'],
          ['เบอร์โทร','phone'],['วุฒิการศึกษา','edu_degree'],['สาขาวิชา','edu_major'],
          ['สถาบันการศึกษา','edu_institute']].map(([label,key])=>(
          <div key={key}><label style={{fontSize:11,fontWeight:600}}>{label}</label>
            <input value={form[key]} onChange={e=>setForm(p=>({...p,[key]:e.target.value}))} /></div>
        ))}
        <div><label style={{fontSize:11,fontWeight:600}}>วันเดือนปีเกิด</label>
          <input type="date" value={form.dob} onChange={e=>setForm(p=>({...p,dob:e.target.value}))} /></div>
        <div><label style={{fontSize:11,fontWeight:600}}>วันบรรจุ/เริ่มงาน</label>
          <input type="date" value={form.start_date} onChange={e=>setForm(p=>({...p,start_date:e.target.value}))} /></div>
        <div style={{gridColumn:'span 2'}}><label style={{fontSize:11,fontWeight:600}}>ที่อยู่</label>
          <input value={form.address} onChange={e=>setForm(p=>({...p,address:e.target.value}))} /></div>
      </div>
      <div style={{marginTop:14,display:'flex',gap:8}}>
        <button className="success" onClick={saveProfile}>💾 บันทึก</button>
        <button className="secondary" onClick={()=>setView('cards')}>ยกเลิก</button>
      </div>
      {toast&&<div className="toast show">{toast}</div>}
    </>
  );

  return (<>
    <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap'}}>
      <button className={view==='cards'?'success':'secondary'} onClick={()=>setView('cards')}>👤 การ์ด</button>
      {isAdmin&&<button className={view==='table'?'success':'secondary'} onClick={()=>setView('table')}>📑 ตาราง</button>}
      <button className="secondary" onClick={doPrint}>🖨️ พิมพ์ทำเนียบ</button>
    </div>

    {view==='cards' && (
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:14}}>
        {teachers.map(t=>{
          const p=profiles[t.id]||{};
          const canEdit = isAdmin || t.id===session.teacherId;
          return (
            <div key={t.id} style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:12,padding:16,boxShadow:'0 2px 4px rgba(0,0,0,0.05)'}}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                <div style={{width:50,height:50,borderRadius:'50%',background:'#dbeafe',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>👨‍🏫</div>
                <div>
                  <div style={{fontWeight:700,fontSize:14,color:'#1e293b'}}>{t.name}</div>
                  <div style={{fontSize:12,color:'#64748b'}}>{p.position||t.position||'ครู'}</div>
                </div>
              </div>
              <div style={{fontSize:12,color:'#475569',display:'grid',gap:3}}>
                {t.class&&<div>🏫 ประจำชั้น: <b>{t.class}</b></div>}
                {(p.phone||t.phone)&&<div>📱 {p.phone||t.phone}</div>}
                {p.edu_degree&&<div>🎓 {p.edu_degree} {p.edu_major?`(${p.edu_major})`:''}</div>}
                {p.start_date&&<div>📅 บรรจุ: {p.start_date}</div>}
              </div>
              {canEdit&&<button className="secondary" style={{width:'100%',marginTop:10,fontSize:12}} onClick={()=>openEdit(t)}>✏️ แก้ไขข้อมูล</button>}
            </div>
          );
        })}
      </div>
    )}

    {view==='table' && (
      <div style={{overflowX:'auto'}}>
        <table style={{fontSize:13}}>
          <thead><tr><th>#</th><th>ชื่อ-สกุล</th><th>ตำแหน่ง</th><th>ประจำชั้น</th><th>เบอร์โทร</th><th>วุฒิ</th><th>บรรจุ</th><th>จัดการ</th></tr></thead>
          <tbody>
            {teachers.map((t,i)=>{
              const p=profiles[t.id]||{};
              return (<tr key={t.id}>
                <td>{i+1}</td><td><b>{t.name}</b></td>
                <td>{p.position||t.position||'—'}</td><td>{t.class||'—'}</td>
                <td>{p.phone||t.phone||'—'}</td>
                <td>{p.edu_degree||'—'}</td><td>{p.start_date||'—'}</td>
                <td><button className="secondary" style={{padding:'3px 8px',fontSize:11}} onClick={()=>openEdit(t)}>✏️</button></td>
              </tr>);
            })}
          </tbody>
        </table>
      </div>
    )}
    {toast&&<div className="toast show">{toast}</div>}
  </>);
}
