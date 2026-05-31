'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { getSession } from '@/lib/auth';
import { useYear } from '@/lib/year';
import { supabase } from '@/lib/supabase';

export default function Papol1Page() {
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
    <h2 style={{margin:'0 0 14px'}}>📄 ทะเบียนคุม ปพ.1 ออนไลน์</h2>
    <Papol1Main session={s} year={year} />
  </div></div></>);
}

function Papol1Main({ session, year }) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [form, setForm] = useState({ student_id:'', student_name:'', file_url:'', note:'' });
  const [toast, setToast] = useState('');
  const isAdmin = session.role === 'admin';

  async function doSearch() {
    if (!search.trim()) return alert('⚠️ พิมพ์ข้อมูลค้นหาก่อน');
    const q = search.trim();
    const { data: stuData } = await supabase.from('students').select('student_id,prefix,first_name,last_name,class')
      .eq('school_id',session.schoolId)
      .or(`student_id.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`);
    if (!stuData?.length) { setResults([]); setSearched(true); return; }
    const ids = stuData.map(s=>s.student_id);
    const { data: p1Data } = await supabase.from('papol1_records').select('*')
      .eq('school_id',session.schoolId).in('student_id',ids);
    const p1Map = {};
    (p1Data||[]).forEach(r=>{ p1Map[r.student_id]=r; });
    setResults(stuData.map(s=>({ ...s, papol1: p1Map[s.student_id]||null })));
    setSearched(true);
  }

  async function save() {
    if (!form.student_id) return alert('⚠️ กรอกเลขประจำตัว');
    const payload = { school_id:session.schoolId, ...form, uploaded_by:session.name };
    const { error } = editRow
      ? await supabase.from('papol1_records').update(payload).eq('id',editRow.id)
      : await supabase.from('papol1_records').upsert(payload, { onConflict:'school_id,student_id' });
    if (error) return alert('❌ '+error.message);
    setEditRow(null); setForm({ student_id:'', student_name:'', file_url:'', note:'' });
    setToast('✅ บันทึกแล้ว'); setTimeout(()=>setToast(''),2000);
    if (searched) doSearch();
  }

  return (<>
    <div style={{background:'#e7f3ff',border:'1px solid #b8daff',borderRadius:10,padding:14,marginBottom:14}}>
      <h4 style={{margin:'0 0 10px',color:'#1e40af'}}>🔍 ค้นหานักเรียน</h4>
      <div style={{display:'flex',gap:8}}>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&doSearch()}
          placeholder="พิมพ์ชื่อ / นามสกุล / เลขประจำตัว" style={{flex:1}} />
        <button onClick={doSearch}>🔍 ค้นหา</button>
      </div>
    </div>

    {isAdmin&&(
      <div style={{background:'#fef3c7',border:'1px solid #fcd34d',borderRadius:10,padding:14,marginBottom:14}}>
        <h4 style={{margin:'0 0 10px',color:'#b45309'}}>📤 {editRow?'แก้ไข':'เพิ่ม/อัปเดต'} ลิงก์ ปพ.1</h4>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:8}}>
          <div><label style={{fontSize:11,fontWeight:600}}>เลขประจำตัวนักเรียน</label>
            <input value={form.student_id} onChange={e=>setForm(p=>({...p,student_id:e.target.value}))} /></div>
          <div><label style={{fontSize:11,fontWeight:600}}>ชื่อ-สกุล</label>
            <input value={form.student_name} onChange={e=>setForm(p=>({...p,student_name:e.target.value}))} /></div>
          <div style={{gridColumn:'span 2'}}><label style={{fontSize:11,fontWeight:600}}>URL ไฟล์ ปพ.1 (Google Drive / อื่นๆ)</label>
            <input value={form.file_url} onChange={e=>setForm(p=>({...p,file_url:e.target.value}))} placeholder="https://drive.google.com/..." /></div>
          <div><label style={{fontSize:11,fontWeight:600}}>หมายเหตุ</label>
            <input value={form.note} onChange={e=>setForm(p=>({...p,note:e.target.value}))} /></div>
        </div>
        <div style={{marginTop:10,display:'flex',gap:8}}>
          <button className="success" onClick={save}>💾 บันทึก</button>
          {editRow&&<button className="secondary" onClick={()=>{setEditRow(null);setForm({student_id:'',student_name:'',file_url:'',note:''});}}>ยกเลิก</button>}
        </div>
      </div>
    )}

    {searched&&(
      results.length===0 ? (
        <div style={{textAlign:'center',padding:30,color:'#94a3b8'}}>ไม่พบข้อมูลที่ค้นหา</div>
      ) : (
        <div style={{overflowX:'auto'}}>
          <table style={{fontSize:13}}>
            <thead><tr><th>#</th><th>รหัส</th><th>ชื่อ-สกุล</th><th>ชั้น</th><th>ปพ.1</th>{isAdmin&&<th>จัดการ</th>}</tr></thead>
            <tbody>
              {results.map((r,i)=>(
                <tr key={r.student_id}>
                  <td>{i+1}</td><td><b>{r.student_id}</b></td>
                  <td>{r.prefix}{r.first_name} {r.last_name}</td><td>{r.class}</td>
                  <td>
                    {r.papol1?.file_url
                      ? <a href={r.papol1.file_url} target="_blank" rel="noreferrer"
                          style={{color:'#1e40af',fontWeight:700}}>📄 เปิด ปพ.1</a>
                      : <span style={{color:'#94a3b8',fontSize:11}}>ยังไม่มีไฟล์</span>
                    }
                  </td>
                  {isAdmin&&<td>
                    <button className="secondary" style={{padding:'3px 8px',fontSize:11}}
                      onClick={()=>{setEditRow(r.papol1||{id:null});setForm({student_id:r.student_id,student_name:`${r.prefix||''}${r.first_name} ${r.last_name}`,file_url:r.papol1?.file_url||'',note:r.papol1?.note||''});}}>✏️</button>
                  </td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    )}
    {toast&&<div className="toast show">{toast}</div>}
  </>);
}
