'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { getSession } from '@/lib/auth';
import { useYear } from '@/lib/year';
import { sortByClassAndStudentId } from '@/lib/sort';
import { supabase } from '@/lib/supabase';
import { makePrintWindow, makePrintHeader, makeSignature2, makeNoteBox } from '@/lib/printTemplate';

const CLASSES = ['อ.2','อ.3','ป.1','ป.2','ป.3','ป.4','ป.5','ป.6'];
const ITEMS = [
  'รักชาติ ศาสน์ กษัตริย์','ซื่อสัตย์สุจริต','มีวินัย','ใฝ่เรียนรู้',
  'อยู่อย่างพอเพียง','มุ่งมั่นในการทำงาน','รักความเป็นไทย','มีจิตสาธารณะ'
];
const MAX_EACH = 3; const MAX_TOTAL = 24;
const FIELDS = ['s1','s2','s3','s4','s5','s6','s7','s8'];

function qualityLevel(pct) {
  if (pct >= 80) return { label: 'ดีเยี่ยม', color: '#16a34a' };
  if (pct >= 60) return { label: 'ดี', color: '#2563eb' };
  if (pct >= 50) return { label: 'ผ่าน', color: '#d97706' };
  return { label: 'ไม่ผ่าน', color: '#dc2626' };
}

export default function EvalAttrPage() {
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
    <h2 style={{margin:'0 0 14px'}}>⭐ ประเมินคุณลักษณะอันพึงประสงค์ ปีการศึกษา {year}</h2>
    <EvalMain session={s} year={year} table="eval_attr" fields={FIELDS} items={ITEMS} maxEach={MAX_EACH} maxTotal={MAX_TOTAL} title="คุณลักษณะอันพึงประสงค์" />
  </div></div></>);
}

function EvalMain({ session, year, table, fields, items, maxEach, maxTotal, title }) {
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
      supabase.from(table).select('*')
        .eq('school_id',session.schoolId).eq('academic_year',year).eq('semester',sem).eq('class',cls),
    ]);
    setLoading(false);
    if (enrRes.error) return alert('❌ '+enrRes.error.message);
    const eMap = {};
    (evalRes.data||[]).forEach(r => { eMap[r.student_id] = r; });
    const list = (enrRes.data||[]).map(e => {
      const ev = eMap[e.students.student_id] || {};
      const scores = {};
      fields.forEach(f => { scores[f] = ev[f] ?? 0; });
      return { ...e.students, class: cls, ...scores };
    });
    setRows(sortByClassAndStudentId(list));
  }

  function setScore(sid, field, val) {
    const v = Math.min(maxEach, Math.max(0, parseInt(val)||0));
    setRows(prev => prev.map(r => r.student_id===sid ? {...r,[field]:v} : r));
  }

  async function save() {
    const records = rows.map(r => {
      const obj = { school_id:session.schoolId, academic_year:year, semester:sem, student_id:r.student_id, class:cls, recorded_by:session.name, updated_at:new Date().toISOString() };
      fields.forEach(f => { obj[f] = r[f]||0; });
      return obj;
    });
    const { error } = await supabase.from(table).upsert(records, { onConflict:'school_id,academic_year,semester,student_id' });
    if (error) return alert('❌ '+error.message);
    setToast(`✅ บันทึก ${records.length} คนแล้ว`);
    setTimeout(()=>setToast(''),2000);
  }

  function doPrint() {
    const schoolName = session.school?.name || 'โรงเรียนบ้านแก่ง';
    const counts = { ดีเยี่ยม:0, ดี:0, ผ่าน:0, ไม่ผ่าน:0 };
    const tbody = rows.map((r,i)=>{
      const tot=fields.reduce((a,f)=>a+(r[f]||0),0);
      const pct=Math.round(tot/maxTotal*100);
      const q=qualityLevel(pct);
      counts[q.label]=(counts[q.label]||0)+1;
      return `<tr><td>${i+1}</td><td>${r.student_id}</td><td class="text-left">${r.prefix||''}${r.first_name} ${r.last_name}</td>
      ${fields.map(f=>`<td>${r[f]||0}</td>`).join('')}
      <td class="col-total">${tot}</td><td>${pct}%</td><td>${q.label}</td></tr>`;
    }).join('');
    const note = makeNoteBox(`<b>📊 สรุปผลการประเมิน (รวม ${rows.length} คน):</b><br/>
      - ดีเยี่ยม: ${counts.ดีเยี่ยม} คน &nbsp; - ดี: ${counts.ดี} คน &nbsp; - ผ่าน: ${counts.ผ่าน} คน &nbsp; - ไม่ผ่าน: ${counts.ไม่ผ่าน} คน`);
    const html = `
      ${makePrintHeader(schoolName, `รายงานประเมิน${title}`, `ชั้น ${cls} ภาคเรียนที่ ${sem} ปีการศึกษา ${year}`)}
      <table><thead>
        <tr><th rowspan="2">#</th><th rowspan="2">รหัส</th><th rowspan="2">ชื่อ-สกุล</th>
        ${items.map((_,i)=>`<th>${i+1}</th>`).join('')}
        <th rowspan="2">รวม(${maxTotal})</th><th rowspan="2">ร้อยละ</th><th rowspan="2">ระดับ</th></tr>
        <tr>${items.map(n=>`<th><div class="vertical-text" style="font-size:9px;">${n}</div></th>`).join('')}</tr>
      </thead><tbody>${tbody}</tbody></table>
      ${note}
      ${makeSignature2(session.name, session.school?.director, schoolName)}
    `;
    makePrintWindow(html, 'landscape');
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
      <b>คุณลักษณะ {items.length} ข้อ:</b> {items.map((n,i)=>`ข้อ${i+1}. ${n}`).join(' | ')}<br/>
      เกณฑ์: ดีเยี่ยม (80-100%) · ดี (60-79%) · ผ่าน (50-59%) · ไม่ผ่าน (ต่ำกว่า 50%) · พิมพ์คะแนน 0-{maxEach}
    </div>

    {rows.length>0 && (
      <div style={{overflowX:'auto',marginTop:12}}>
        <table style={{fontSize:12}}>
          <thead>
            <tr>
              <th rowSpan={2}>#</th><th rowSpan={2}>รหัส</th><th rowSpan={2}>ชื่อ-สกุล</th>
              {items.map((_,i)=><th key={i}>{i+1}</th>)}
              <th rowSpan={2}>รวม<br/>({maxTotal})</th><th rowSpan={2}>ร้อยละ</th><th rowSpan={2}>ระดับ</th>
            </tr>
            <tr>{items.map((n,i)=><th key={i} style={{fontSize:9,writingMode:'vertical-rl',transform:'rotate(180deg)',padding:4,minWidth:22}}>{n}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r,i)=>{
              const tot=fields.reduce((a,f)=>a+(r[f]||0),0);
              const pct=maxTotal>0?Math.round(tot/maxTotal*100):0;
              const q=qualityLevel(pct);
              return (<tr key={r.student_id}>
                <td>{i+1}</td><td><b>{r.student_id}</b></td>
                <td style={{textAlign:'left'}}>{r.prefix}{r.first_name} {r.last_name}</td>
                {fields.map(f=>(
                  <td key={f} style={{padding:2}}>
                    <input type="number" min={0} max={maxEach} value={r[f]||0}
                      onChange={e=>setScore(r.student_id,f,e.target.value)}
                      style={{width:36,textAlign:'center',padding:'2px 3px',border:'1px solid #e2e8f0',borderRadius:4}} />
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
