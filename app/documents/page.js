'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { getSession } from '@/lib/auth';
import { useYear } from '@/lib/year';
import { supabase } from '@/lib/supabase';

const DOC_TYPES = ['รับ','ส่ง'];
const EMPTY = { doc_type:'รับ', doc_number:'', doc_subject:'', person:'', doc_date:'', note:'' };

export default function DocumentsPage() {
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
    <h2 style={{margin:'0 0 14px'}}>📝 งานสารบรรณ ปีการศึกษา {year}</h2>
    <DocMain session={s} year={year} />
  </div></div></>);
}

function DocMain({ session, year }) {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({...EMPTY});
  const [editId, setEditId] = useState(null);
  const [filterType, setFilterType] = useState('');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');

  useEffect(() => { load(); }, [year]);

  async function load() {
    const { data } = await supabase.from('documents').select('*')
      .eq('school_id',session.schoolId).eq('academic_year',year)
      .order('doc_date',{ascending:false});
    setRows(data||[]);
  }
  async function save() {
    if (!form.doc_subject) return alert('⚠️ กรอกเรื่อง');
    const payload = { school_id:session.schoolId, academic_year:year, ...form,
      doc_date:form.doc_date||null, created_by:session.name };
    const { error } = editId
      ? await supabase.from('documents').update(payload).eq('id',editId)
      : await supabase.from('documents').insert(payload);
    if (error) return alert('❌ '+error.message);
    setForm({...EMPTY}); setEditId(null);
    setToast(editId?'✅ แก้ไขแล้ว':'✅ บันทึกแล้ว'); setTimeout(()=>setToast(''),2000);
    load();
  }
  async function del(id) {
    if (!confirm('ลบ?')) return;
    await supabase.from('documents').delete().eq('id',id); load();
  }

  const filtered = rows.filter(r=>{
    if (filterType&&r.doc_type!==filterType) return false;
    if (search&&!r.doc_subject.includes(search)&&!(r.person||'').includes(search)&&!(r.doc_number||'').includes(search)) return false;
    return true;
  });

  const typeColor = { 'รับ':{ bg:'#dbeafe', fg:'#1e40af' }, 'ส่ง':{ bg:'#dcfce7', fg:'#166534' }};

  return (<>
    <div style={{background:'#f1f5f9',border:'1px solid #e2e8f0',borderRadius:10,padding:14,marginBottom:16}}>
      <h4 style={{margin:'0 0 10px',color:'#334155'}}>{editId?'✏️ แก้ไข':'➕ เพิ่มเอกสาร'}</h4>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:8}}>
        <div><label style={{fontSize:11,fontWeight:600}}>ประเภท</label>
          <select value={form.doc_type} onChange={e=>setForm(p=>({...p,doc_type:e.target.value}))}>
            {DOC_TYPES.map(t=><option key={t}>{t}</option>)}
          </select></div>
        <div><label style={{fontSize:11,fontWeight:600}}>เลขที่</label>
          <input value={form.doc_number} onChange={e=>setForm(p=>({...p,doc_number:e.target.value}))} placeholder="เช่น สพป./001" /></div>
        <div style={{gridColumn:'span 2'}}><label style={{fontSize:11,fontWeight:600}}>เรื่อง *</label>
          <input value={form.doc_subject} onChange={e=>setForm(p=>({...p,doc_subject:e.target.value}))} /></div>
        <div><label style={{fontSize:11,fontWeight:600}}>จาก/ถึง</label>
          <input value={form.person} onChange={e=>setForm(p=>({...p,person:e.target.value}))} placeholder="หน่วยงาน/บุคคล" /></div>
        <div><label style={{fontSize:11,fontWeight:600}}>วันที่</label>
          <input type="date" value={form.doc_date} onChange={e=>setForm(p=>({...p,doc_date:e.target.value}))} /></div>
        <div><label style={{fontSize:11,fontWeight:600}}>หมายเหตุ</label>
          <input value={form.note} onChange={e=>setForm(p=>({...p,note:e.target.value}))} /></div>
      </div>
      <div style={{marginTop:10,display:'flex',gap:8}}>
        <button className="success" onClick={save}>💾 {editId?'บันทึกการแก้ไข':'บันทึก'}</button>
        {editId&&<button className="secondary" onClick={()=>{setEditId(null);setForm({...EMPTY});}}>ยกเลิก</button>}
      </div>
    </div>

    <div style={{display:'flex',gap:8,marginBottom:10,flexWrap:'wrap',alignItems:'center'}}>
      {DOC_TYPES.map(t=>(
        <button key={t} onClick={()=>setFilterType(filterType===t?'':t)}
          style={{padding:'6px 14px',border:'none',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:13,
            background:filterType===t?typeColor[t].bg:'#f1f5f9',color:filterType===t?typeColor[t].fg:'#64748b'}}>
          {t==='รับ'?'📥':'📤'} {t} ({rows.filter(r=>r.doc_type===t).length})
        </button>
      ))}
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 ค้นหา..." style={{width:180}} />
    </div>

    <div style={{overflowX:'auto'}}>
      <table style={{fontSize:13}}>
        <thead><tr><th>#</th><th>ประเภท</th><th>เลขที่</th><th>เรื่อง</th><th>จาก/ถึง</th><th>วันที่</th><th>จัดการ</th></tr></thead>
        <tbody>
          {filtered.map((r,i)=>{
            const c=typeColor[r.doc_type]||{bg:'#f1f5f9',fg:'#475569'};
            return (<tr key={r.id}>
              <td>{i+1}</td>
              <td><span style={{background:c.bg,color:c.fg,padding:'2px 8px',borderRadius:6,fontSize:11,fontWeight:700}}>{r.doc_type}</span></td>
              <td style={{fontSize:11,color:'#64748b'}}>{r.doc_number||'—'}</td>
              <td style={{textAlign:'left'}}>{r.doc_subject}</td>
              <td>{r.person||'—'}</td><td>{r.doc_date||'—'}</td>
              <td><div style={{display:'flex',gap:4}}>
                <button className="secondary" style={{padding:'3px 8px',fontSize:11}}
                  onClick={()=>{setEditId(r.id);setForm({doc_type:r.doc_type,doc_number:r.doc_number||'',doc_subject:r.doc_subject,person:r.person||'',doc_date:r.doc_date||'',note:r.note||''});}}>✏️</button>
                <button style={{padding:'3px 8px',fontSize:11,background:'#fee2e2',color:'#dc2626',border:'none',borderRadius:6,cursor:'pointer'}} onClick={()=>del(r.id)}>🗑️</button>
              </div></td>
            </tr>);
          })}
        </tbody>
      </table>
    </div>
    {toast&&<div className="toast show">{toast}</div>}
  </>);
}
