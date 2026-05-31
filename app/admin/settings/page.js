'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { getSession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export default function AdminSettingsPage() {
  const router = useRouter();
  const [s, setS] = useState(null);
  useEffect(() => {
    const sess = getSession();
    if (!sess || sess.role !== 'admin') { router.replace('/dashboard'); return; }
    setS(sess);
  }, [router]);
  if (!s) return null;
  return (<><TopBar /><div className="wrap"><div className="card">
    <h2 style={{margin:'0 0 14px'}}>⚙️ ตั้งค่าระบบ (ผู้ดูแลระบบ)</h2>
    <SettingsMain session={s} />
  </div></div></>);
}

function SettingsMain({ session }) {
  const [school, setSchool] = useState(null);
  const [form, setForm] = useState({ name:'', address:'', area:'', director:'', academic_head:'' });
  const [toast, setToast] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from('schools').select('*').eq('id',session.schoolId).single();
    if (data) {
      setSchool(data);
      setForm({ name:data.name||'', address:data.address||'', area:data.area||'',
        director:data.director||'', academic_head:data.academic_head||'' });
    }
  }

  async function save() {
    const { error } = await supabase.from('schools').update(form).eq('id',session.schoolId);
    if (error) return alert('❌ '+error.message);
    setToast('✅ บันทึกข้อมูลแล้ว'); setTimeout(()=>setToast(''),2000);
    load();
  }

  return (<>
    <div style={{background:'#fef3c7',border:'1px solid #fcd34d',borderRadius:10,padding:16,marginBottom:16}}>
      <h4 style={{margin:'0 0 14px',color:'#b45309'}}>📝 ข้อมูลโรงเรียน</h4>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(250px,1fr))',gap:10}}>
        {[['ชื่อโรงเรียน','name'],['สังกัด / เขตพื้นที่การศึกษา','area'],
          ['ที่อยู่โรงเรียน','address'],['ชื่อผู้อำนวยการ','director'],
          ['ชื่อหัวหน้าฝ่ายวิชาการ','academic_head']].map(([label,key])=>(
          <div key={key}>
            <label style={{fontSize:12,fontWeight:600}}>{label}</label>
            <input value={form[key]} onChange={e=>setForm(p=>({...p,[key]:e.target.value}))} />
          </div>
        ))}
      </div>
      <button className="success" style={{marginTop:14}} onClick={save}>💾 บันทึกข้อมูล</button>
    </div>

    {school&&(
      <div style={{background:'#f0f9ff',border:'1px solid #bae6fd',borderRadius:10,padding:14}}>
        <h4 style={{margin:'0 0 10px',color:'#0369a1'}}>ℹ️ ข้อมูลปัจจุบัน</h4>
        <div style={{fontSize:13,display:'grid',gap:4}}>
          <div>🏫 <b>โรงเรียน:</b> {school.name}</div>
          <div>📍 <b>ที่อยู่:</b> {school.address||'—'}</div>
          <div>🏢 <b>สังกัด:</b> {school.area||'—'}</div>
          <div>👨‍💼 <b>ผู้อำนวยการ:</b> {school.director||'—'}</div>
          <div>👩‍🏫 <b>หัวหน้าวิชาการ:</b> {school.academic_head||'—'}</div>
        </div>
      </div>
    )}
    {toast&&<div className="toast show">{toast}</div>}
  </>);
}
