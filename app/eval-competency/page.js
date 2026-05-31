'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { getSession } from '@/lib/auth';
import { useYear } from '@/lib/year';
import { sortByClassAndStudentId } from '@/lib/sort';
import { supabase } from '@/lib/supabase';

const CLASSES = ['อ.2','อ.3','ป.1','ป.2','ป.3','ป.4','ป.5','ป.6'];
const ITEMS = [
  { key:'c1', label:'1.ความสามารถในการสื่อสาร',        color:'#dcfce7', tc:'#166534' },
  { key:'c2', label:'2.ความสามารถในการคิด',            color:'#fef3c7', tc:'#92400e' },
  { key:'c3', label:'3.ความสามารถในการแก้ปัญหา',       color:'#fce7f3', tc:'#9d174d' },
  { key:'c4', label:'4.ความสามารถในการใช้ทักษะชีวิต', color:'#dbeafe', tc:'#1e40af' },
  { key:'c5', label:'5.ความสามารถในการใช้เทคโนโลยี',  color:'#f3e8ff', tc:'#6b21a8' },
];
const MAX_EACH = 3; const MAX_TOTAL = 15;

function qualityLevel(pct) {
  if (pct >= 80) return { label: 'ดีเยี่ยม', color: '#16a34a' };
  if (pct >= 60) return { label: 'ดี', color: '#2563eb' };
  if (pct >= 50) return { label: 'ผ่าน', color: '#d97706' };
  return { label: 'ไม่ผ่าน', color: '#dc2626' };
}

export default function EvalCompetencyPage() {
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
    <h2 style={{margin:'0 0 14px'}}>💡 ประเมินสมรรถนะสำคัญของผู้เรียน ๕ ประการ ปีการศึกษา {year}</h2>
    <EvalCompMain session={s} year={year} />
  </div></div></>);
}

function EvalCompMain({ session, year }) {
  const [cls, setCls] = useState(session.role==='teacher'&&session.class?session.class:'');
  const [sem, setSem] = useState(1);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');

  async function load() {
    if (!cls) return alert('⚠️ เลือกชั้น');
    setLoading(true);
    const [enrRes, evalRes] = await Promise.all([
      supabase.from('enrollments').select('students!inner(student_id,prefix,first_name,last_name)')
        .eq('school_id',session.schoolId).eq('academic_year',year).eq('class',cls).in('status',['ปกติ','ย้ายเข้า']),
      supabase.from('eval_competency').select('*')
        .eq('school_id',session.schoolId).eq('academic_year',year).eq('semester',sem).eq('class',cls),
    ]);
    setLoading(false);
    if (enrRes.error) return alert('❌ '+enrRes.error.message);
    const eMap={};
    (evalRes.data||[]).forEach(r=>{eMap[r.student_id]=r;});
    const list=(enrRes.data||[]).map(e=>{
      const ev=eMap[e.students.student_id]||{};
      const s={};
      ITEMS.forEach(it=>{s[it.key]=ev[it.key]??0;});
      return{...e.students,class:cls,...s};
    });
    setRows(sortByClassAndStudentId(list));
  }

  function setScore(sid,key,val){
    const v=Math.min(MAX_EACH,Math.max(0,parseInt(val)||0));
    setRows(prev=>prev.map(r=>r.student_id===sid?{...r,[key]:v}:r));
  }

  async function save(){
    const records=rows.map(r=>{
      const obj={school_id:session.schoolId,academic_year:year,semester:sem,student_id:r.student_id,class:cls,recorded_by:session.name,updated_at:new Date().toISOString()};
      ITEMS.forEach(it=>{obj[it.key]=r[it.key]||0;});
      return obj;
    });
    const{error}=await supabase.from('eval_competency').upsert(records,{onConflict:'school_id,academic_year,semester,student_id'});
    if(error)return alert('❌ '+error.message);
    setToast(`✅ บันทึก ${records.length} คนแล้ว`);setTimeout(()=>setToast(''),2000);
  }

  function doPrint(){
    const html=`<!DOCTYPE html><html><head><meta charset="utf-8">
    <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap" rel="stylesheet">
    <style>body{font-family:Sarabun,sans-serif;font-size:11px;margin:8mm}table{border-collapse:collapse;width:100%}th,td{border:1px solid #000;padding:3px;text-align:center}th{background:#e2e8f0}.tl{text-align:left}@page{size:A4 landscape;margin:8mm}</style>
    </head><body>
    <h3 style="text-align:center">ประเมินสมรรถนะสำคัญของผู้เรียน ชั้น${cls} ภาคเรียนที่${sem}/${year}</h3>
    <table><thead><tr><th>#</th><th>รหัส</th><th class="tl">ชื่อ-สกุล</th>
    ${ITEMS.map(it=>`<th style="font-size:9px">${it.label.split('.').slice(1).join('.').trim()}<br/>(${MAX_EACH})</th>`).join('')}
    <th>รวม(${MAX_TOTAL})</th><th>ร้อยละ</th><th>ระดับ</th></tr></thead><tbody>
    ${rows.map((r,i)=>{
      const tot=ITEMS.reduce((a,it)=>a+(r[it.key]||0),0);
      const pct=Math.round(tot/MAX_TOTAL*100);
      const q=qualityLevel(pct);
      return `<tr><td>${i+1}</td><td>${r.student_id}</td><td class="tl">${r.prefix||''}${r.first_name} ${r.last_name}</td>
      ${ITEMS.map(it=>`<td>${r[it.key]||0}</td>`).join('')}
      <td><b>${tot}</b></td><td>${pct}%</td><td>${q.label}</td></tr>`;
    }).join('')}</tbody></table></body></html>`;
    const w=window.open('','_blank','width=900,height=600');
    w.document.write(html);w.document.close();setTimeout(()=>w.print(),800);
  }

  return (<>
    <div className="row">
      <div><label style={{fontSize:12,fontWeight:600}}>ชั้นเรียน</label>
        <select value={cls} onChange={e=>setCls(e.target.value)}>
          <option value="">-- เลือก --</option>{CLASSES.map(c=><option key={c}>{c}</option>)}
        </select></div>
      <div><label style={{fontSize:12,fontWeight:600}}>ภาคเรียน</label>
        <select value={sem} onChange={e=>setSem(Number(e.target.value))}>
          <option value={1}>ภาคเรียนที่ 1</option><option value={2}>ภาคเรียนที่ 2</option>
        </select></div>
      <div style={{display:'flex',gap:8,alignItems:'end'}}>
        <button onClick={load} disabled={loading}>{loading?'⏳...':'📋 โหลด'}</button>
        {rows.length>0&&<><button className="success" onClick={save}>💾 บันทึก</button>
        <button className="secondary" onClick={doPrint}>🖨️ พิมพ์</button></>}
      </div>
    </div>
    <div style={{marginTop:10,padding:10,background:'#eff6ff',borderRadius:8,fontSize:12,color:'#1e40af'}}>
      <b>5 สมรรถนะ (เต็ม {MAX_EACH} ต่อข้อ รวม {MAX_TOTAL}):</b> {ITEMS.map(it=>it.label).join(' · ')}<br/>
      เกณฑ์: ดีเยี่ยม ≥80% · ดี ≥60% · ผ่าน ≥50% · ไม่ผ่าน &lt;50%
    </div>
    {rows.length>0&&(
      <div style={{overflowX:'auto',marginTop:12}}>
        <table style={{fontSize:12}}>
          <thead>
            <tr><th rowSpan={2}>#</th><th rowSpan={2}>รหัส</th><th rowSpan={2}>ชื่อ-สกุล</th>
            {ITEMS.map(it=><th key={it.key} style={{background:it.color,color:it.tc,fontSize:10,minWidth:60}}>{it.label}</th>)}
            <th rowSpan={2}>รวม</th><th rowSpan={2}>ร้อยละ</th><th rowSpan={2}>ระดับ</th></tr>
            <tr>{ITEMS.map(it=><th key={it.key} style={{background:it.color,color:it.tc,fontSize:10}}>({MAX_EACH})</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r,i)=>{
              const tot=ITEMS.reduce((a,it)=>a+(r[it.key]||0),0);
              const pct=Math.round(tot/MAX_TOTAL*100);
              const q=qualityLevel(pct);
              return (<tr key={r.student_id}>
                <td>{i+1}</td><td><b>{r.student_id}</b></td>
                <td style={{textAlign:'left'}}>{r.prefix}{r.first_name} {r.last_name}</td>
                {ITEMS.map(it=>(
                  <td key={it.key} style={{padding:2}}>
                    <input type="number" min={0} max={MAX_EACH} value={r[it.key]||0}
                      onChange={e=>setScore(r.student_id,it.key,e.target.value)}
                      style={{width:38,textAlign:'center',padding:'2px',border:'1px solid #e2e8f0',borderRadius:4}}/>
                  </td>
                ))}
                <td style={{fontWeight:700}}>{tot}</td>
                <td>{pct}%</td>
                <td style={{fontWeight:700,color:q.color}}>{q.label}</td>
              </tr>);
            })}
          </tbody>
        </table>
      </div>
    )}
    {toast&&<div className="toast show">{toast}</div>}
  </>);
}
