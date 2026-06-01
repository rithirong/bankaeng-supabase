'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { getSession } from '@/lib/auth';
import { useYear } from '@/lib/year';
import { supabase } from '@/lib/supabase';
import { makePrintWindow, getPrintCSS } from '@/lib/printTemplate';

const CLASSES = ['อ.2','อ.3','ป.1','ป.2','ป.3','ป.4','ป.5','ป.6'];
const CERT_TYPES = ['ใบรับรองการเป็นนักเรียน','ใบรับรองความประพฤติ','หนังสือรับรองทั่วไป'];

export default function Papol7Page() {
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
    <h2 style={{margin:'0 0 14px'}}>📋 ปพ.7 ใบรับรอง</h2>
    <Papol7Main session={s} year={year} />
  </div></div></>);
}

function Papol7Main({ session, year }) {
  const [cls, setCls] = useState(session.role === 'teacher' && session.class ? session.class : '');
  const [certType, setCertType] = useState(CERT_TYPES[0]);
  const [students, setStudents] = useState([]);
  const [selected, setSelected] = useState([]);
  const [purpose, setPurpose] = useState('เพื่อใช้แสดงต่อหน่วยงานราชการ');
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!cls) return alert('⚠️ เลือกชั้น');
    setLoading(true);
    const { data } = await supabase.from('enrollments')
      .select('no_in_class, students!inner(id,student_id,prefix,first_name,last_name,dob,nationality,religion,father_name,mother_name,guardian_name,address)')
      .eq('school_id',session.schoolId).eq('academic_year',year).eq('class',cls)
      .in('status',['ปกติ','ย้ายเข้า']).order('no_in_class');
    setLoading(false);
    setStudents((data||[]).map(e=>({...e.students, no:e.no_in_class})));
    setSelected([]);
  }

  function toggleSelect(sid) {
    setSelected(p => p.includes(sid) ? p.filter(x=>x!==sid) : [...p,sid]);
  }
  function selectAll() { setSelected(students.map(s=>s.student_id)); }
  function clearAll() { setSelected([]); }

  function doPrint() {
    const targets = selected.length > 0 ? students.filter(s=>selected.includes(s.student_id)) : students;
    if (!targets.length) return alert('⚠️ เลือกนักเรียนก่อน');
    const schoolName = session.school?.name || 'โรงเรียนบ้านแก่ง';
    const schoolArea = session.school?.area || '';
    const director = session.school?.director || '...........................';
    const today = new Date().toLocaleDateString('th-TH',{day:'numeric',month:'long',year:'numeric'});

    const pages = targets.map(stu => `
      <div style="page-break-after:always;padding:10mm;">
        <div class="print-header" style="margin-bottom:15px;">
          <h2>หนังสือรับรอง</h2>
          <h3>โรงเรียน${schoolName}</h3>
          <h4 style="font-weight:normal;">${schoolArea}</h4>
        </div>

        <div style="text-align:right;margin-bottom:15px;font-size:12px;">
          วันที่ ${today}
        </div>

        <div style="font-size:12px;line-height:2;margin-bottom:15px;">
          <p style="text-indent:40px;margin:0;">
            หนังสือรับรองฉบับนี้ให้ไว้เพื่อรับรองว่า
            <b>${stu.prefix||''}${stu.first_name} ${stu.last_name}</b>
            เลขประจำตัวนักเรียน ${stu.student_id}
            กำลังศึกษาอยู่ในระดับชั้น<b>${cls}</b>
            ปีการศึกษา <b>${year}</b>
            ของโรงเรียน${schoolName} ${schoolArea}
          </p>
          ${stu.dob ? `<p style="text-indent:40px;margin:0;">เกิดวันที่ ${new Date(stu.dob).toLocaleDateString('th-TH',{day:'numeric',month:'long',year:'numeric'})}</p>` : ''}
          <p style="text-indent:40px;margin:0;">
            ออกหนังสือรับรองฉบับนี้ให้เพื่อ <b>${purpose}</b>
          </p>
        </div>

        <div style="text-align:center;margin-top:40px;font-size:12px;page-break-inside:avoid;">
          <div style="display:inline-block;text-align:center;">
            <div style="border-bottom:1px dotted #000;width:220px;height:20px;margin:0 auto;"></div>
            <div style="margin-top:4px;">(${director})</div>
            <div>ผู้อำนวยการโรงเรียน${schoolName}</div>
          </div>
        </div>
      </div>
    `).join('');

    const html = `<!DOCTYPE html><html><head>
      <meta charset="utf-8"><title>ปพ.7 ใบรับรอง</title>
      <style>${getPrintCSS('portrait')}</style>
    </head><body>${pages}</body></html>`;
    const w = window.open('','_blank','width=800,height=900');
    w.document.write(html); w.document.close(); setTimeout(()=>w.print(),800);
  }

  return (<>
    <div className="row">
      <div>
        <label style={{fontSize:12,fontWeight:600}}>ชั้นเรียน</label>
        <select value={cls} onChange={e=>setCls(e.target.value)}>
          <option value="">-- เลือก --</option>{CLASSES.map(c=><option key={c}>{c}</option>)}
        </select>
      </div>
      <div>
        <label style={{fontSize:12,fontWeight:600}}>ประเภทใบรับรอง</label>
        <select value={certType} onChange={e=>setCertType(e.target.value)}>
          {CERT_TYPES.map(t=><option key={t}>{t}</option>)}
        </select>
      </div>
      <div style={{display:'flex',gap:8,alignItems:'end'}}>
        <button onClick={load} disabled={loading}>{loading?'⏳...':'📋 โหลด'}</button>
      </div>
    </div>

    {students.length > 0 && (
      <>
        <div style={{marginTop:12}}>
          <label style={{fontSize:12,fontWeight:600}}>วัตถุประสงค์</label>
          <input value={purpose} onChange={e=>setPurpose(e.target.value)}
            style={{width:'100%',marginTop:4}} placeholder="เพื่อใช้แสดงต่อหน่วยงานราชการ" />
        </div>

        <div style={{marginTop:14,display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          <button className="secondary" onClick={selectAll}>เลือกทั้งหมด</button>
          <button className="secondary" onClick={clearAll}>ล้าง</button>
          <span style={{fontSize:13,color:'#64748b'}}>เลือก {selected.length}/{students.length} คน</span>
          <button className="success" onClick={doPrint}>🖨️ พิมพ์ใบรับรอง</button>
        </div>

        <div style={{overflowX:'auto',marginTop:12}}>
          <table style={{fontSize:13}}>
            <thead>
              <tr>
                <th style={{width:40}}>✓</th>
                <th>#</th><th>เลขประจำตัว</th><th>ชื่อ-สกุล</th><th>วันเกิด</th>
              </tr>
            </thead>
            <tbody>
              {students.map(stu=>(
                <tr key={stu.student_id} style={{cursor:'pointer',background:selected.includes(stu.student_id)?'#eff6ff':'transparent'}}
                  onClick={()=>toggleSelect(stu.student_id)}>
                  <td style={{textAlign:'center'}}>
                    <input type="checkbox" checked={selected.includes(stu.student_id)} onChange={()=>toggleSelect(stu.student_id)} />
                  </td>
                  <td>{stu.no}</td>
                  <td><b>{stu.student_id}</b></td>
                  <td>{stu.prefix}{stu.first_name} {stu.last_name}</td>
                  <td>{stu.dob ? new Date(stu.dob).toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'}) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    )}
  </>);
}
