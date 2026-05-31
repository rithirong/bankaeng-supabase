'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { getSession } from '@/lib/auth';
import { useYear } from '@/lib/year';
import { supabase } from '@/lib/supabase';

const CERT_TYPES = ['นักเรียน','ครู'];
const LEVELS = ['ระดับโรงเรียน','ระดับเขต','ระดับจังหวัด','ระดับภาค','ระดับประเทศ','นานาชาติ'];
const EMPTY = { cert_type:'นักเรียน', owner:'', class:'', cert_name:'', level:'', receive_date:'' };

export default function CertificatesPage() {
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
    <h2 style={{margin:'0 0 14px'}}>🏆 เกียรติบัตร ปีการศึกษา {year}</h2>
    <CertMain session={s} year={year} />
  </div></div></>);
}

function CertMain({ session, year }) {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({...EMPTY});
  const [editId, setEditId] = useState(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [toast, setToast] = useState('');

  useEffect(() => { load(); }, [year]);

  async function load() {
    const { data } = await supabase.from('certificates').select('*')
      .eq('school_id',session.schoolId).eq('academic_year',year)
      .order('receive_date',{ascending:false});
    setRows(data||[]);
  }
  async function save() {
    if (!form.owner||!form.cert_name) return alert('⚠️ กรอกชื่อผู้รับและชื่อเกียรติบัตร');
    const payload = { school_id:session.schoolId, academic_year:year, ...form, receive_date:form.receive_date||null, created_by:session.name };
    const { error } = editId
      ? await supabase.from('certificates').update(payload).eq('id',editId)
      : await supabase.from('certificates').insert(payload);
    if (error) return alert('❌ '+error.message);
    setForm({...EMPTY}); setEditId(null);
    setToast(editId?'✅ แก้ไขแล้ว':'✅ เพิ่มเกียรติบัตรแล้ว'); setTimeout(()=>setToast(''),2000);
    load();
  }
  async function del(id) {
    if (!confirm('ลบ?')) return;
    await supabase.from('certificates').delete().eq('id',id); load();
  }

  const filtered = rows.filter(r => {
    if (filterType && r.cert_type !== filterType) return false;
    if (search && !r.owner.includes(search) && !r.cert_name.includes(search)) return false;
    return true;
  });

  const levelColor = { 'ระดับโรงเรียน':'#dbeafe', 'ระดับเขต':'#dcfce7', 'ระดับจังหวัด':'#fef3c7',
    'ระดับภาค':'#fce7f3', 'ระดับประเทศ':'#fee2e2', 'นานาชาติ':'#f3e8ff' };

  return (<>
    <div style={{background:'#fffbeb',border:'1px solid #fcd34d',borderRadius:10,padding:14,marginBottom:16}}>
      <h4 style={{margin:'0 0 10px',color:'#b45309'}}>{editId?'✏️ แก้ไข':'➕ เพิ่มเกียรติบัตร'}</h4>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:8}}>
        <div><label style={{fontSize:11,fontWeight:600}}>ประเภท</label>
          <select value={form.cert_type} onChange={e=>setForm(p=>({...p,cert_type:e.target.value}))}>
            {CERT_TYPES.map(t=><option key={t}>{t}</option>)}
          </select></div>
        <div style={{gridColumn:'span 2'}}><label style={{fontSize:11,fontWeight:600}}>ชื่อผู้รับ *</label>
          <input value={form.owner} onChange={e=>setForm(p=>({...p,owner:e.target.value}))} placeholder="ชื่อ-สกุล" /></div>
        {form.cert_type==='นักเรียน'&&<div><label style={{fontSize:11,fontWeight:600}}>ชั้น</label>
          <input value={form.class} onChange={e=>setForm(p=>({...p,class:e.target.value}))} placeholder="เช่น ป.4" /></div>}
        <div style={{gridColumn:'span 2'}}><label style={{fontSize:11,fontWeight:600}}>ชื่อเกียรติบัตร *</label>
          <input value={form.cert_name} onChange={e=>setForm(p=>({...p,cert_name:e.target.value}))} placeholder="เช่น รางวัลชนะเลิศ..." /></div>
        <div><label style={{fontSize:11,fontWeight:600}}>ระดับ</label>
          <select value={form.level} onChange={e=>setForm(p=>({...p,level:e.target.value}))}>
            <option value="">-- เลือก --</option>{LEVELS.map(l=><option key={l}>{l}</option>)}
          </select></div>
        <div><label style={{fontSize:11,fontWeight:600}}>วันที่รับ</label>
          <input type="date" value={form.receive_date} onChange={e=>setForm(p=>({...p,receive_date:e.target.value}))} /></div>
      </div>
      <div style={{marginTop:10,display:'flex',gap:8}}>
        <button className="success" onClick={save}>💾 {editId?'บันทึกการแก้ไข':'เพิ่ม'}</button>
        {editId&&<button className="secondary" onClick={()=>{setEditId(null);setForm({...EMPTY});}}>ยกเลิก</button>}
      </div>
    </div>

    <div style={{display:'flex',gap:8,marginBottom:10,flexWrap:'wrap'}}>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 ค้นหาชื่อ/รางวัล..." style={{width:200}} />
      <select value={filterType} onChange={e=>setFilterType(e.target.value)} style={{width:120}}>
        <option value="">ทุกประเภท</option>{CERT_TYPES.map(t=><option key={t}>{t}</option>)}
      </select>
      <div style={{padding:'6px 14px',background:'#fffbeb',color:'#b45309',borderRadius:8,fontWeight:700}}>
        รวม {filtered.length} รายการ
      </div>
    </div>

    <div style={{overflowX:'auto'}}>
      <table style={{fontSize:13}}>
        <thead><tr><th>#</th><th>ประเภท</th><th>ชื่อผู้รับ</th><th>ชั้น</th><th>ชื่อเกียรติบัตร</th><th>ระดับ</th><th>วันที่</th><th>จัดการ</th></tr></thead>
        <tbody>
          {filtered.map((r,i)=>(
            <tr key={r.id}>
              <td>{i+1}</td>
              <td><span style={{background:r.cert_type==='ครู'?'#fce7f3':'#dbeafe',color:r.cert_type==='ครู'?'#9d174d':'#1e40af',padding:'2px 8px',borderRadius:6,fontSize:11,fontWeight:700}}>{r.cert_type}</span></td>
              <td><b>{r.owner}</b></td><td>{r.class||'—'}</td>
              <td style={{textAlign:'left'}}>{r.cert_name}</td>
              <td><span style={{background:levelColor[r.level]||'#f1f5f9',padding:'2px 6px',borderRadius:4,fontSize:11}}>{r.level||'—'}</span></td>
              <td>{r.receive_date||'—'}</td>
              <td><div style={{display:'flex',gap:4}}>
                <button className="secondary" style={{padding:'3px 8px',fontSize:11}} onClick={()=>{setEditId(r.id);setForm({cert_type:r.cert_type,owner:r.owner,class:r.class||'',cert_name:r.cert_name,level:r.level||'',receive_date:r.receive_date||''});}}>✏️</button>
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
