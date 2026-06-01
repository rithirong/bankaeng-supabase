'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { getSession } from '@/lib/auth';
import { useYear } from '@/lib/year';
import { supabase } from '@/lib/supabase';
import { getPrintCSS, makeSignature3 } from '@/lib/printTemplate';

const CLASSES = ['อ.2','อ.3','ป.1','ป.2','ป.3','ป.4','ป.5','ป.6'];
function gradeFromScore(s, max) {
  if (!s && s !== 0) return { g: '—', gpa: null };
  const pct = max > 0 ? (s / max) * 100 : 0;
  if (pct >= 80) return { g: '4', gpa: 4 };
  if (pct >= 75) return { g: '3.5', gpa: 3.5 };
  if (pct >= 70) return { g: '3', gpa: 3 };
  if (pct >= 65) return { g: '2.5', gpa: 2.5 };
  if (pct >= 60) return { g: '2', gpa: 2 };
  if (pct >= 55) return { g: '1.5', gpa: 1.5 };
  if (pct >= 50) return { g: '1', gpa: 1 };
  return { g: '0', gpa: 0 };
}
function qualityLabel(pct) {
  if (pct >= 80) return 'ดีเยี่ยม';
  if (pct >= 60) return 'ดี';
  if (pct >= 50) return 'ผ่าน';
  return 'ไม่ผ่าน';
}

export default function Papol6Page() {
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
    <h2 style={{margin:'0 0 14px'}}>📗 แบบรายงานผลการพัฒนาคุณภาพผู้เรียน (ปพ.6)</h2>
    <Papol6Main session={s} year={year} />
  </div></div></>);
}

function Papol6Main({ session, year }) {
  const [cls, setCls] = useState('');
  const [sem, setSem] = useState(1);
  const [students, setStudents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  async function loadStudents() {
    if (!cls) return;
    const { data } = await supabase.from('enrollments')
      .select('no_in_class, students!inner(id,student_id,prefix,first_name,last_name,dob)')
      .eq('school_id',session.schoolId).eq('academic_year',year).eq('class',cls)
      .in('status',['ปกติ','ย้ายเข้า']).order('no_in_class');
    setStudents((data||[]).map(e=>({...e.students,no:e.no_in_class})));
    setSelected(null); setReport(null);
  }
  useEffect(() => { loadStudents(); }, [cls, year]);

  async function loadReport(stu) {
    setSelected(stu); setLoading(true);
    const sid = stu.student_id;
    const [gradesRes, attrRes, readRes, compRes, attRes] = await Promise.all([
      supabase.from('grades').select('*').eq('school_id',session.schoolId).eq('academic_year',year).eq('student_id',sid),
      supabase.from('eval_attr').select('*').eq('school_id',session.schoolId).eq('academic_year',year).eq('student_id',sid),
      supabase.from('eval_reading').select('*').eq('school_id',session.schoolId).eq('academic_year',year).eq('student_id',sid),
      supabase.from('eval_competency').select('*').eq('school_id',session.schoolId).eq('academic_year',year).eq('student_id',sid),
      supabase.from('attendance').select('status').eq('school_id',session.schoolId).eq('student_id',sid),
    ]);
    setLoading(false);
    setReport({ grades:gradesRes.data||[], attr:attrRes.data||[], reading:readRes.data||[], comp:compRes.data||[], att:attRes.data||[] });
  }

  function doPrint() {
    if (!report||!selected) return;
    const stu = selected;
    const grades = report.grades.filter(g=>g.semester===sem);
    const attr = report.attr.find(a=>a.semester===sem)||{};
    const reading = report.reading.find(a=>a.semester===sem)||{};
    const comp = report.comp.find(a=>a.semester===sem)||{};
    const attTotal = report.att.length;
    const attPresent = report.att.filter(a=>a.status==='มา').length;
    const attrTotal = ['s1','s2','s3','s4','s5','s6','s7','s8'].reduce((a,k)=>a+(attr[k]||0),0);
    const readTotal = ['r1','r2','r3','r4','r5'].reduce((a,k)=>a+(reading[k]||0),0);
    const compTotal = ['c1','c2','c3','c4','c5'].reduce((a,k)=>a+(comp[k]||0),0);

    const schoolName = session.school?.name || 'โรงเรียนบ้านแก่ง';
    const html = `
    <div class="print-header">
      <h2>แบบรายงานผลการพัฒนาคุณภาพผู้เรียน (ปพ.6)</h2>
      <h3>${schoolName}</h3>
      <h4>ภาคเรียนที่ ${sem} ปีการศึกษา ${year}</h4>
    </div>
    <table style="width:100%;margin-bottom:8px;border-collapse:collapse;">
      <tr>
        <td style="border:1px solid #000;padding:4px 8px;width:50%;"><b>ชื่อ-สกุล:</b> ${stu.prefix||''}${stu.first_name} ${stu.last_name}</td>
        <td style="border:1px solid #000;padding:4px 8px;"><b>เลขประจำตัว:</b> ${stu.student_id}</td>
      </tr>
      <tr>
        <td style="border:1px solid #000;padding:4px 8px;"><b>ชั้น:</b> ${cls} &nbsp; <b>เลขที่:</b> ${stu.no||'—'}</td>
        <td style="border:1px solid #000;padding:4px 8px;"><b>ปีการศึกษา:</b> ${year}</td>
      </tr>
    </table>

    <div style="background:#1e3a8a;color:#fff;padding:3px 8px;font-weight:700;margin:6px 0 3px;font-size:12px;">1. ผลการเรียน</div>
    <table><thead><tr><th class="text-left">รายวิชา</th><th>คะแนนเต็ม</th><th>คะแนนที่ได้</th><th>ระดับผล</th></tr></thead>
    <tbody>${grades.length===0?'<tr><td colspan="4">ไม่มีข้อมูลผลการเรียน</td></tr>':
      grades.map(g=>{const{g:gl}=gradeFromScore(g.score,g.max_score);
        return`<tr><td class="text-left">${g.subject}</td><td>${g.max_score}</td><td>${g.score??'—'}</td><td><b>${gl}</b></td></tr>`;
      }).join('')}
    </tbody></table>

    <div style="background:#1e3a8a;color:#fff;padding:3px 8px;font-weight:700;margin:6px 0 3px;font-size:12px;">2. การเข้าเรียน</div>
    <table><thead><tr><th>มาเรียน</th><th>ขาด</th><th>ลา</th><th>ป่วย</th><th>รวมวันเรียน</th></tr></thead>
    <tbody><tr>
      <td>${report.att.filter(a=>a.status==='มา').length}</td>
      <td>${report.att.filter(a=>a.status==='ขาด').length}</td>
      <td>${report.att.filter(a=>a.status==='ลา').length}</td>
      <td>${report.att.filter(a=>a.status==='ป่วย').length}</td>
      <td><b>${report.att.length}</b></td>
    </tr></tbody></table>

    <div style="background:#1e3a8a;color:#fff;padding:3px 8px;font-weight:700;margin:6px 0 3px;font-size:12px;">3. คุณลักษณะอันพึงประสงค์ (เต็ม 24)</div>
    <table><thead><tr>
      ${['รักชาติ ศาสน์ กษัตริย์','ซื่อสัตย์สุจริต','มีวินัย','ใฝ่เรียนรู้','อยู่อย่างพอเพียง','มุ่งมั่นในการทำงาน','รักความเป็นไทย','มีจิตสาธารณะ'].map(n=>`<th><div class="vertical-text" style="font-size:9px;">${n}</div></th>`).join('')}
      <th>รวม</th><th>ร้อยละ</th><th>ระดับ</th></tr></thead>
    <tbody><tr>${['s1','s2','s3','s4','s5','s6','s7','s8'].map(k=>`<td>${attr[k]||0}</td>`).join('')}
    <td class="col-total">${attrTotal}</td>
    <td>${Math.round(attrTotal/24*100)}%</td>
    <td>${qualityLabel(attrTotal/24*100)}</td></tr></tbody></table>

    <div style="background:#1e3a8a;color:#fff;padding:3px 8px;font-weight:700;margin:6px 0 3px;font-size:12px;">4. อ่าน คิดวิเคราะห์ และเขียน (เต็ม 25)</div>
    <table><thead><tr>
      <th>การอ่าน ข้อ1<br/>(5)</th><th>การอ่าน ข้อ2<br/>(5)</th><th>การคิด ข้อ3<br/>(5)</th><th>การคิด ข้อ4<br/>(5)</th><th>เขียน ข้อ5<br/>(5)</th>
      <th>รวม</th><th>ระดับ</th></tr></thead>
    <tbody><tr>${['r1','r2','r3','r4','r5'].map(k=>`<td>${reading[k]||0}</td>`).join('')}
    <td class="col-total">${readTotal}</td>
    <td>${qualityLabel(readTotal/25*100)}</td></tr></tbody></table>

    <div style="background:#1e3a8a;color:#fff;padding:3px 8px;font-weight:700;margin:6px 0 3px;font-size:12px;">5. สมรรถนะสำคัญของผู้เรียน ๕ ประการ (เต็ม 15)</div>
    <table><thead><tr>
      <th>สื่อสาร<br/>(3)</th><th>การคิด<br/>(3)</th><th>แก้ปัญหา<br/>(3)</th><th>ทักษะชีวิต<br/>(3)</th><th>เทคโนโลยี<br/>(3)</th>
      <th>รวม</th><th>ระดับ</th></tr></thead>
    <tbody><tr>${['c1','c2','c3','c4','c5'].map(k=>`<td>${comp[k]||0}</td>`).join('')}
    <td class="col-total">${compTotal}</td>
    <td>${qualityLabel(compTotal/15*100)}</td></tr></tbody></table>

    ${makeSignature3(session.name, session.school?.academic_head, session.school?.director, schoolName)}
    `;
    const w=window.open('','_blank','width=800,height=900');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>ปพ.6</title><style>${getPrintCSS('portrait')}</style></head><body>${html}</body></html>`);
    w.document.close(); setTimeout(()=>w.print(),800);
  }

  return (<>
    <div className="row">
      <div><label style={{fontSize:12,fontWeight:600}}>ชั้นเรียน</label>
        <select value={cls} onChange={e=>{setCls(e.target.value);setStudents([]);setReport(null);}}>
          <option value="">-- เลือก --</option>{CLASSES.map(c=><option key={c}>{c}</option>)}
        </select></div>
      <div><label style={{fontSize:12,fontWeight:600}}>ภาคเรียน</label>
        <select value={sem} onChange={e=>setSem(Number(e.target.value))}>
          <option value={1}>ภาคเรียนที่ 1</option><option value={2}>ภาคเรียนที่ 2</option>
        </select></div>
    </div>

    {students.length>0&&(
      <div style={{marginTop:14}}>
        <label style={{fontSize:12,fontWeight:600}}>เลือกนักเรียน</label>
        <select onChange={e=>{const stu=students.find(s=>s.student_id===e.target.value);if(stu)loadReport(stu);}} defaultValue="">
          <option value="">-- เลือกนักเรียน --</option>
          {students.map(s=><option key={s.student_id} value={s.student_id}>{s.no}. {s.prefix}{s.first_name} {s.last_name}</option>)}
        </select>
      </div>
    )}

    {loading&&<div style={{textAlign:'center',padding:30,color:'#64748b'}}>⏳ กำลังโหลดข้อมูล...</div>}

    {report&&selected&&!loading&&(
      <div style={{marginTop:14,background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:10,padding:14}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
          <h4 style={{margin:0,color:'#15803d'}}>📗 ปพ.6 ของ {selected.prefix}{selected.first_name} {selected.last_name}</h4>
          <button className="success" onClick={doPrint}>🖨️ พิมพ์ ปพ.6</button>
        </div>
        <div style={{fontSize:13,display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:8}}>
          <div style={{background:'#fff',padding:10,borderRadius:8,textAlign:'center'}}>
            <div style={{fontSize:12,color:'#64748b'}}>วิชาที่มีผล</div>
            <div style={{fontSize:24,fontWeight:800,color:'#15803d'}}>{report.grades.filter(g=>g.semester===sem).length}</div>
          </div>
          <div style={{background:'#fff',padding:10,borderRadius:8,textAlign:'center'}}>
            <div style={{fontSize:12,color:'#64748b'}}>มาเรียน</div>
            <div style={{fontSize:24,fontWeight:800,color:'#2563eb'}}>{report.att.filter(a=>a.status==='มา').length}</div>
          </div>
          <div style={{background:'#fff',padding:10,borderRadius:8,textAlign:'center'}}>
            <div style={{fontSize:12,color:'#64748b'}}>คุณลักษณะ</div>
            <div style={{fontSize:24,fontWeight:800,color:'#d97706'}}>{['s1','s2','s3','s4','s5','s6','s7','s8'].reduce((a,k)=>a+((report.attr.find(x=>x.semester===sem)||{})[k]||0),0)}/24</div>
          </div>
        </div>
      </div>
    )}
  </>);
}
