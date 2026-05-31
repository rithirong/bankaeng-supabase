'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { getSession } from '@/lib/auth';
import { useYear } from '@/lib/year';
import { supabase } from '@/lib/supabase';

const CLASSES = ['อ.2','อ.3','ป.1','ป.2','ป.3','ป.4','ป.5','ป.6'];

export default function DeedsPage() {
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
    <h2 style={{margin:'0 0 14px'}}>📖 สมุดบันทึกความดี ปีการศึกษา {year}</h2>
    <DeedsMain session={s} year={year} />
  </div></div></>);
}

function DeedsMain({ session, year }) {
  const [tab, setTab] = useState('pending');
  const [cls, setCls] = useState('');
  const [students, setStudents] = useState([]);
  const [form, setForm] = useState({ student_id:'', date: new Date().toISOString().slice(0,10), detail:'' });
  const [deeds, setDeeds] = useState([]);
  const [toast, setToast] = useState('');

  useEffect(() => { loadDeeds(); }, [year, tab]);
  useEffect(() => { if (cls) loadStudents(); }, [cls, year]);

  async function loadStudents() {
    const { data } = await supabase.from('enrollments')
      .select('students!inner(student_id,prefix,first_name,last_name)')
      .eq('school_id',session.schoolId).eq('academic_year',year).eq('class',cls)
      .in('status',['ปกติ','ย้ายเข้า']);
    setStudents((data||[]).map(e=>e.students));
  }

  async function loadDeeds() {
    const { data, error } = await supabase.from('deeds')
      .select('*, students:student_id(prefix,first_name,last_name)')
      .eq('school_id',session.schoolId).eq('academic_year',year)
      .eq('status', tab==='pending'?'รอรับรอง':'รับรองแล้ว')
      .order('deed_date', { ascending: false });
    if (!error) setDeeds(data||[]);
  }

  async function submit() {
    if (!form.student_id||!form.detail||!form.date) return alert('⚠️ กรอกข้อมูลให้ครบ');
    const stu = students.find(s=>s.student_id===form.student_id);
    const cls2 = cls;
    const { error } = await supabase.from('deeds').insert({
      school_id:session.schoolId, academic_year:year, student_id:form.student_id,
      class:cls2, deed_date:form.date, detail:form.detail,
      status:'รอรับรอง', created_by:session.name
    });
    if (error) return alert('❌ '+error.message);
    setForm(p=>({...p,detail:''}));
    setToast('✅ บันทึกความดีแล้ว'); setTimeout(()=>setToast(''),2000);
    loadDeeds();
  }

  async function approve(id) {
    await supabase.from('deeds').update({ status:'รับรองแล้ว', approved_by:session.name }).eq('id',id);
    loadDeeds();
  }

  async function del(id) {
    if (!confirm('ลบรายการนี้?')) return;
    await supabase.from('deeds').delete().eq('id',id);
    loadDeeds();
  }

  const tabStyle = (t) => ({
    padding:'8px 18px', border:'none', cursor:'pointer', fontWeight:700, fontSize:13, borderRadius:8,
    background: tab===t ? (t==='pending'?'#dc2626':'#16a34a') : '#e2e8f0',
    color: tab===t ? '#fff' : '#475569',
  });

  return (<>
    {/* ฟอร์มบันทึก */}
    <div style={{background:'#faf5ff',border:'1px solid #e9d5ff',borderRadius:10,padding:14,marginBottom:16}}>
      <h4 style={{margin:'0 0 10px',color:'#7c3aed'}}>✏️ บันทึกความดีใหม่</h4>
      <div style={{display:'flex',flexWrap:'wrap',gap:8,alignItems:'flex-end'}}>
        <div><label style={{fontSize:11,fontWeight:600}}>ชั้น</label>
          <select value={cls} onChange={e=>setCls(e.target.value)} style={{width:80}}>
            <option value="">-- --</option>{CLASSES.map(c=><option key={c}>{c}</option>)}
          </select></div>
        <div><label style={{fontSize:11,fontWeight:600}}>นักเรียน</label>
          <select value={form.student_id} onChange={e=>setForm(p=>({...p,student_id:e.target.value}))} style={{minWidth:180}}>
            <option value="">-- เลือกชั้นก่อน --</option>
            {students.map(s=><option key={s.student_id} value={s.student_id}>{s.prefix}{s.first_name} {s.last_name}</option>)}
          </select></div>
        <div><label style={{fontSize:11,fontWeight:600}}>วันที่</label>
          <input type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))} /></div>
        <div style={{flex:2,minWidth:200}}>
          <label style={{fontSize:11,fontWeight:600}}>รายละเอียดความดี</label>
          <input value={form.detail} onChange={e=>setForm(p=>({...p,detail:e.target.value}))}
            placeholder="เช่น ช่วยเก็บขยะ, ช่วยเหลือเพื่อน..." style={{width:'100%'}} />
        </div>
        <button className="success" onClick={submit}>💾 บันทึก</button>
      </div>
    </div>

    {/* รายการ */}
    <div style={{display:'flex',gap:4,marginBottom:10}}>
      <button style={tabStyle('pending')} onClick={()=>setTab('pending')}>รอรับรอง</button>
      <button style={tabStyle('approved')} onClick={()=>setTab('approved')}>รับรองแล้ว ✅</button>
    </div>

    {deeds.length===0 ? (
      <div style={{textAlign:'center',padding:30,color:'#94a3b8'}}>ไม่มีรายการ</div>
    ) : (
      <div style={{overflowX:'auto'}}>
        <table style={{fontSize:13}}>
          <thead><tr><th>#</th><th>วันที่</th><th>รหัส</th><th>ชื่อ</th><th>รายละเอียดความดี</th><th>บันทึกโดย</th><th>จัดการ</th></tr></thead>
          <tbody>
            {deeds.map((d,i)=>(
              <tr key={d.id}>
                <td>{i+1}</td>
                <td>{d.deed_date}</td>
                <td>{d.student_id}</td>
                <td>{d.students?.prefix}{d.students?.first_name} {d.students?.last_name}</td>
                <td style={{textAlign:'left'}}>{d.detail}</td>
                <td style={{fontSize:11,color:'#64748b'}}>{d.created_by}</td>
                <td>
                  <div style={{display:'flex',gap:4}}>
                    {tab==='pending' && session.role==='admin' && (
                      <button style={{padding:'3px 8px',fontSize:11,background:'#dcfce7',color:'#166534',border:'none',borderRadius:6,cursor:'pointer'}}
                        onClick={()=>approve(d.id)}>✅ รับรอง</button>
                    )}
                    <button style={{padding:'3px 8px',fontSize:11,background:'#fee2e2',color:'#dc2626',border:'none',borderRadius:6,cursor:'pointer'}}
                      onClick={()=>del(d.id)}>🗑️</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
    {toast&&<div className="toast show">{toast}</div>}
  </>);
}
