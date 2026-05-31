'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { getSession } from '@/lib/auth';
import { useYear } from '@/lib/year';
import { supabase } from '@/lib/supabase';

const CLASSES = ['อ.2','อ.3','ป.1','ป.2','ป.3','ป.4','ป.5','ป.6'];
const EMPTY = { student_id:'', class:'', scholarship_name:'', amount:'', source:'', receive_date:'', note:'' };

export default function ScholarshipsPage() {
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
    <h2 style={{margin:'0 0 14px'}}>💸 ทุนการศึกษา ปีการศึกษา {year}</h2>
    <SchMain session={s} year={year} />
  </div></div></>);
}

function SchMain({ session, year }) {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({...EMPTY});
  const [editId, setEditId] = useState(null);
  const [students, setStudents] = useState([]);
  const [cls, setCls] = useState('');
  const [toast, setToast] = useState('');
  const [filterCls, setFilterCls] = useState('');

  useEffect(() => { load(); }, [year]);
  useEffect(() => { if (cls) loadStudents(); }, [cls, year]);

  async function load() {
    const q = supabase.from('scholarships').select('*').eq('school_id',session.schoolId).eq('academic_year',year).order('receive_date',{ascending:false});
    const { data } = await q;
    setRows(data||[]);
  }
  async function loadStudents() {
    const { data } = await supabase.from('enrollments')
      .select('students!inner(student_id,prefix,first_name,last_name)')
      .eq('school_id',session.schoolId).eq('academic_year',year).eq('class',cls).in('status',['ปกติ','ย้ายเข้า']);
    setStudents((data||[]).map(e=>e.students));
  }
  async function save() {
    if (!form.student_id||!form.scholarship_name) return alert('⚠️ กรอกข้อมูลให้ครบ');
    const payload = { school_id:session.schoolId, academic_year:year, class:cls, ...form,
      amount:parseFloat(form.amount)||0, receive_date:form.receive_date||null };
    const { error } = editId
      ? await supabase.from('scholarships').update(payload).eq('id',editId)
      : await supabase.from('scholarships').insert(payload);
    if (error) return alert('❌ '+error.message);
    setForm({...EMPTY}); setEditId(null); setCls(''); setStudents([]);
    setToast(editId?'✅ แก้ไขแล้ว':'✅ เพิ่มทุนแล้ว'); setTimeout(()=>setToast(''),2000);
    load();
  }
  async function del(id) {
    if (!confirm('ลบรายการนี้?')) return;
    await supabase.from('scholarships').delete().eq('id',id); load();
  }
  function startEdit(r) {
    setEditId(r.id); setCls(r.class);
    setForm({ student_id:r.student_id, class:r.class, scholarship_name:r.scholarship_name,
      amount:r.amount, source:r.source||'', receive_date:r.receive_date||'', note:r.note||'' });
  }

  const filtered = filterCls ? rows.filter(r=>r.class===filterCls) : rows;
  const totalAmt = filtered.reduce((a,r)=>a+Number(r.amount||0),0);

  return (<>
    <div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:10,padding:14,marginBottom:16}}>
      <h4 style={{margin:'0 0 10px',color:'#15803d'}}>{editId?'✏️ แก้ไขทุน':'➕ เพิ่มทุนการศึกษา'}</h4>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:8}}>
        <div><label style={{fontSize:11,fontWeight:600}}>ชั้น</label>
          <select value={cls} onChange={e=>{setCls(e.target.value);setForm(p=>({...p,class:e.target.value,student_id:''}));}}>
            <option value="">-- เลือก --</option>{CLASSES.map(c=><option key={c}>{c}</option>)}
          </select></div>
        <div style={{gridColumn:'span 2'}}><label style={{fontSize:11,fontWeight:600}}>นักเรียน</label>
          <select value={form.student_id} onChange={e=>setForm(p=>({...p,student_id:e.target.value}))}>
            <option value="">-- เลือกชั้นก่อน --</option>
            {students.map(s=><option key={s.student_id} value={s.student_id}>{s.prefix}{s.first_name} {s.last_name}</option>)}
          </select></div>
        <div style={{gridColumn:'span 2'}}><label style={{fontSize:11,fontWeight:600}}>ชื่อทุน *</label>
          <input value={form.scholarship_name} onChange={e=>setForm(p=>({...p,scholarship_name:e.target.value}))} placeholder="เช่น ทุน กสศ." /></div>
        <div><label style={{fontSize:11,fontWeight:600}}>จำนวนเงิน (บาท)</label>
          <input type="number" value={form.amount} onChange={e=>setForm(p=>({...p,amount:e.target.value}))} /></div>
        <div><label style={{fontSize:11,fontWeight:600}}>แหล่งทุน</label>
          <input value={form.source} onChange={e=>setForm(p=>({...p,source:e.target.value}))} placeholder="เช่น กสศ., รัฐบาล" /></div>
        <div><label style={{fontSize:11,fontWeight:600}}>วันที่รับ</label>
          <input type="date" value={form.receive_date} onChange={e=>setForm(p=>({...p,receive_date:e.target.value}))} /></div>
        <div><label style={{fontSize:11,fontWeight:600}}>หมายเหตุ</label>
          <input value={form.note} onChange={e=>setForm(p=>({...p,note:e.target.value}))} /></div>
      </div>
      <div style={{marginTop:10,display:'flex',gap:8}}>
        <button className="success" onClick={save}>💾 {editId?'บันทึกการแก้ไข':'เพิ่มทุน'}</button>
        {editId&&<button className="secondary" onClick={()=>{setEditId(null);setForm({...EMPTY});setCls('');}}>ยกเลิก</button>}
      </div>
    </div>

    <div style={{display:'flex',gap:10,alignItems:'center',marginBottom:10,flexWrap:'wrap'}}>
      <select value={filterCls} onChange={e=>setFilterCls(e.target.value)} style={{width:100}}>
        <option value="">ทุกชั้น</option>{CLASSES.map(c=><option key={c}>{c}</option>)}
      </select>
      <div style={{background:'#dcfce7',color:'#166534',padding:'6px 14px',borderRadius:8,fontWeight:700}}>
        รวม {filtered.length} ทุน · {totalAmt.toLocaleString()} บาท
      </div>
    </div>

    <div style={{overflowX:'auto'}}>
      <table style={{fontSize:13}}>
        <thead><tr><th>#</th><th>ชั้น</th><th>รหัส/ชื่อ</th><th>ชื่อทุน</th><th style={{textAlign:'right'}}>จำนวนเงิน</th><th>แหล่งทุน</th><th>วันที่รับ</th><th>จัดการ</th></tr></thead>
        <tbody>
          {filtered.map((r,i)=>(
            <tr key={r.id}>
              <td>{i+1}</td><td>{r.class}</td><td>{r.student_id}</td>
              <td>{r.scholarship_name}</td>
              <td style={{textAlign:'right',fontWeight:700,color:'#16a34a'}}>{Number(r.amount||0).toLocaleString()}</td>
              <td>{r.source||'—'}</td><td>{r.receive_date||'—'}</td>
              <td><div style={{display:'flex',gap:4}}>
                <button className="secondary" style={{padding:'3px 8px',fontSize:11}} onClick={()=>startEdit(r)}>✏️</button>
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
