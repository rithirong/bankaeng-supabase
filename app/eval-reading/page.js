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
  { key:'r1', label:'การอ่าน ข้อ 1', max:5, color:'#dcfce7', tc:'#166534' },
  { key:'r2', label:'การอ่าน ข้อ 2', max:5, color:'#dcfce7', tc:'#166534' },
  { key:'r3', label:'การคิด ข้อ 3',  max:5, color:'#fef3c7', tc:'#92400e' },
  { key:'r4', label:'การคิด ข้อ 4',  max:5, color:'#fef3c7', tc:'#92400e' },
  { key:'r5', label:'เขียน ข้อ 5',   max:5, color:'#fce7f3', tc:'#9d174d' },
];
const MAX_TOTAL = 25;

function qualityLevel(pct) {
  if (pct >= 80) return { label: 'ดีเยี่ยม', color: '#16a34a' };
  if (pct >= 65) return { label: 'ดี', color: '#2563eb' };
  if (pct >= 50) return { label: 'ผ่าน', color: '#d97706' };
  return { label: 'ไม่ผ่าน', color: '#dc2626' };
}

export default function EvalReadingPage() {
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
    <h2 style={{margin:'0 0 14px'}}>📖 ประเมินการอ่าน คิดวิเคราะห์ และเขียน ปีการศึกษา {year}</h2>
    <EvalReadingMain session={s} year={year} />
  </div></div></>);
}

function EvalReadingMain({ session, year }) {
  const [cls, setCls] = useState(session.role === 'teacher' && session.class ? session.class : '');
  const [sem, setSem] = useState(1);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');

  async function load() {
    if (!cls) return alert('⚠️ เลือกชั้น');
    setLoading(true);
    const [enrRes, evalRes] = await Promise.all([
      supabase.from('enrollments').select('students!inner(student_id,prefix,first_name,last_name)')
        .eq('school_id',session.schoolId).eq('academic_year',year).eq('class',cls)
        .in('status',['ปกติ','ย้ายเข้า']),
      supabase.from('eval_reading').select('*')
        .eq('school_id',session.schoolId).eq('academic_year',year).eq('semester',sem).eq('class',cls),
    ]);
    setLoading(false);
    if (enrRes.error) return alert('❌ '+enrRes.error.message);
    const eMap = {};
    (evalRes.data||[]).forEach(r => { eMap[r.student_id] = r; });
    const list = (enrRes.data||[]).map(e => {
      const ev = eMap[e.students.student_id]||{};
      const scores = {};
      ITEMS.forEach(it => { scores[it.key] = ev[it.key]??0; });
      return { ...e.students, class:cls, ...scores };
    });
    setRows(sortByClassAndStudentId(list));
  }

  function setScore(sid, key, val) {
    const item = ITEMS.find(it=>it.key===key);
    const v = Math.min(item.max, Math.max(0, parseInt(val)||0));
    setRows(prev => prev.map(r => r.student_id===sid ? {...r,[key]:v} : r));
  }

  async function save() {
    const records = rows.map(r => {
      const obj = { school_id:session.schoolId, academic_year:year, semester:sem, student_id:r.student_id, class:cls, recorded_by:session.name, updated_at:new Date().toISOString() };
      ITEMS.forEach(it => { obj[it.key] = r[it.key]||0; });
      return obj;
    });
    const { error } = await supabase.from('eval_reading').upsert(records,{onConflict:'school_id,academic_year,semester,student_id'});
    if (error) return alert('❌ '+error.message);
    setToast(`✅ บันทึก ${records.length} คนแล้ว`); setTimeout(()=>setToast(''),2000);
  }

  function doPrint() {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap" rel="stylesheet">
    <style>body{font-family:Sarabun,sans-serif;font-size:11px;margin:8mm}table{border-collapse:collapse;width:100%}th,td{border:1px solid #000;padding:3px 4px;text-align:center}th{background:#e2e8f0}.tl{text-align:left}@page{size:A4 landscape;margin:8mm}</style>
    </head><body>
    <h3 style="text-align:center">ประเมินการอ่าน คิดวิเคราะห์ และเขียน ชั้น${cls} ภาคเรียนที่${sem}/${year}</h3>
    <table><thead><tr><th>#</th><th>รหัส</th><th class="tl">ชื่อ-สกุล</th>
    ${ITEMS.map(it=>`<th>${it.label.split(' ').pop()}<br/><small>(${it.max})</small></th>`).join('')}
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
    w.document.write(html); w.document.close(); setTimeout(()=>w.print(),800);
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
        {rows.length>0 && <><button className="success" onClick={save}>💾 บันทึก</button>
        <button className="secondary" onClick={doPrint}>🖨️ พิมพ์</button></>}
      </div>
    </div>
    <div style={{marginTop:10,padding:10,background:'#eff6ff',borderRadius:8,fontSize:12,color:'#1e40af'}}>
      <b>5 ตัวชี้วัด (เต็ม 5 ต่อข้อ):</b> การอ่าน (ข้อ1-2) · การคิดวิเคราะห์ (ข้อ3-4) · การเขียน (ข้อ5)<br/>
      เกณฑ์: ดีเยี่ยม ≥80% · ดี ≥65% · ผ่าน ≥50% · ไม่ผ่าน &lt;50%
    </div>
    {rows.length>0 && (
      <div style={{overflowX:'auto',marginTop:12}}>
        <table style={{fontSize:12}}>
          <thead>
            <tr>
              <th rowSpan={2}>#</th><th rowSpan={2}>รหัส</th><th rowSpan={2}>ชื่อ-สกุล</th>
              <th colSpan={2} style={{background:'#dcfce7',color:'#166534'}}>การอ่าน</th>
              <th colSpan={2} style={{background:'#fef3c7',color:'#92400e'}}>การคิดวิเคราะห์</th>
              <th style={{background:'#fce7f3',color:'#9d174d'}}>เขียน</th>
              <th rowSpan={2}>รวม</th><th rowSpan={2}>ร้อยละ</th><th rowSpan={2}>ระดับ</th>
            </tr>
            <tr>{ITEMS.map(it=><th key={it.key} style={{background:it.color,color:it.tc,fontSize:11}}>ข้อ{ITEMS.indexOf(it)+1}<br/>({it.max})</th>)}</tr>
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
                    <input type="number" min={0} max={it.max} value={r[it.key]||0}
                      onChange={e=>setScore(r.student_id,it.key,e.target.value)}
                      style={{width:38,textAlign:'center',padding:'2px',border:'1px solid #e2e8f0',borderRadius:4}} />
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
    {toast && <div className="toast show">{toast}</div>}
  </>);
}
