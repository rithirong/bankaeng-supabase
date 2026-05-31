'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { getSession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

const LEAVE_TYPES = ['ลาป่วย','ลากิจ','ลาพักร้อน','ลาคลอด','ลาอุปสมบท','อื่นๆ'];

export default function PersonnelPage() {
  const router = useRouter();
  const [s, setS] = useState(null);
  useEffect(() => {
    const sess = getSession();
    if (!sess || sess.role === 'parent') { router.replace('/'); return; }
    setS(sess);
  }, [router]);
  if (!s) return null;
  return (<><TopBar /><div className="wrap"><div className="card">
    <h2 style={{margin:'0 0 14px'}}>⏱️ ลงเวลาปฏิบัติราชการ / การลา</h2>
    <PersonnelMain session={s} />
  </div></div></>);
}

function PersonnelMain({ session }) {
  const [tab, setTab] = useState('clock');
  const [clocks, setClocks] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [leaveForm, setLeaveForm] = useState({ leave_type:'ลาป่วย', start_date:'', end_date:'', reason:'' });
  const [toast, setToast] = useState('');
  const isAdmin = session.role === 'admin';
  const today = new Date().toISOString().slice(0,10);
  const nowTime = new Date().toTimeString().slice(0,5);

  useEffect(() => { loadClocks(); loadLeaves(); if(isAdmin) loadPendingLeaves(); }, []);

  async function loadClocks() {
    const { data } = await supabase.from('personnel_clock').select('*')
      .eq('school_id',session.schoolId).eq('teacher_id',session.teacherId)
      .order('clock_date',{ascending:false}).limit(30);
    setClocks(data||[]);
  }
  async function loadLeaves() {
    const { data } = await supabase.from('leave_requests').select('*')
      .eq('school_id',session.schoolId).eq('teacher_id',session.teacherId)
      .order('created_at',{ascending:false}).limit(20);
    setLeaves(data||[]);
  }
  async function loadPendingLeaves() {
    const { data } = await supabase.from('leave_requests').select('*')
      .eq('school_id',session.schoolId).eq('status','รออนุมัติ')
      .order('created_at',{ascending:false});
    setPendingLeaves(data||[]);
  }

  async function clockAction(type) {
    const field = type==='in'?'clock_in':'clock_out';
    const status = type==='od'?'ไปราชการ':'ปกติ';
    const { data:existing } = await supabase.from('personnel_clock').select('id')
      .eq('school_id',session.schoolId).eq('teacher_id',session.teacherId).eq('clock_date',today).maybeSingle();
    const payload = { school_id:session.schoolId, teacher_id:session.teacherId, teacher_name:session.name,
      clock_date:today, status, [field]:nowTime };
    if (existing) {
      await supabase.from('personnel_clock').update(payload).eq('id',existing.id);
    } else {
      await supabase.from('personnel_clock').insert({ ...payload, clock_in: type==='in'?nowTime:null });
    }
    setToast(`✅ บันทึก${type==='in'?'เข้างาน':type==='out'?'เลิกงาน':'ไปราชการ'} ${nowTime} แล้ว`);
    setTimeout(()=>setToast(''),2000);
    loadClocks();
  }

  async function submitLeave() {
    if (!leaveForm.start_date||!leaveForm.end_date) return alert('⚠️ กรอกวันที่ลา');
    const days = Math.max(1, Math.ceil((new Date(leaveForm.end_date)-new Date(leaveForm.start_date))/(1000*60*60*24))+1);
    const { error } = await supabase.from('leave_requests').insert({
      school_id:session.schoolId, teacher_id:session.teacherId, teacher_name:session.name,
      ...leaveForm, days, status:'รออนุมัติ'
    });
    if (error) return alert('❌ '+error.message);
    setLeaveForm({ leave_type:'ลาป่วย', start_date:'', end_date:'', reason:'' });
    setToast('✅ ยื่นใบลาแล้ว รอผู้บริหารอนุมัติ'); setTimeout(()=>setToast(''),2500);
    loadLeaves();
  }

  async function approveLeave(id, status) {
    await supabase.from('leave_requests').update({ status, approved_by:session.name }).eq('id',id);
    loadPendingLeaves(); loadLeaves();
    setToast(status==='อนุมัติ'?'✅ อนุมัติแล้ว':'❌ ไม่อนุมัติ'); setTimeout(()=>setToast(''),1500);
  }

  const statusColor = { 'รออนุมัติ':'#fef3c7', 'อนุมัติ':'#dcfce7', 'ไม่อนุมัติ':'#fee2e2' };
  const statusText  = { 'รออนุมัติ':'#92400e', 'อนุมัติ':'#166534', 'ไม่อนุมัติ':'#991b1b' };
  const tabStyle = (t) => ({
    padding:'10px 16px',border:'none',cursor:'pointer',fontWeight:700,fontSize:13,borderRadius:8,
    background:tab===t?'#1e40af':'transparent',color:tab===t?'#fff':'#475569',
  });

  return (<>
    <div style={{display:'flex',gap:4,background:'#f1f5f9',padding:4,borderRadius:10,marginBottom:14}}>
      <button style={tabStyle('clock')} onClick={()=>setTab('clock')}>⏱️ ลงเวลา</button>
      <button style={tabStyle('leave')} onClick={()=>setTab('leave')}>📝 การลา</button>
      {isAdmin&&<button style={tabStyle('admin')} onClick={()=>setTab('admin')}>
        ⚙️ รออนุมัติ {pendingLeaves.length>0&&<span style={{background:'#dc2626',color:'#fff',borderRadius:'50%',padding:'0 6px',fontSize:11,marginLeft:4}}>{pendingLeaves.length}</span>}
      </button>}
    </div>

    {/* Tab ลงเวลา */}
    {tab==='clock'&&(<>
      <div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:10,padding:14,marginBottom:14}}>
        <h4 style={{margin:'0 0 10px',color:'#166534'}}>⏱️ ลงเวลาปฏิบัติราชการ วันนี้ {today}</h4>
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
          <button style={{flex:1,padding:14,background:'#10b981',color:'#fff',border:'none',borderRadius:10,fontSize:14,fontWeight:700,cursor:'pointer'}} onClick={()=>clockAction('in')}>🟢 เข้างาน</button>
          <button style={{flex:1,padding:14,background:'#ef4444',color:'#fff',border:'none',borderRadius:10,fontSize:14,fontWeight:700,cursor:'pointer'}} onClick={()=>clockAction('out')}>🔴 เลิกงาน</button>
          <button style={{flex:1,padding:14,background:'#0ea5e9',color:'#fff',border:'none',borderRadius:10,fontSize:14,fontWeight:700,cursor:'pointer'}} onClick={()=>clockAction('od')}>🔵 ไปราชการ</button>
        </div>
        <div style={{marginTop:8,fontSize:12,color:'#475569',textAlign:'center'}}>เวลาปัจจุบัน: {nowTime} น. (บันทึกอัตโนมัติ)</div>
      </div>
      <h4 style={{margin:'0 0 8px',color:'#334155'}}>🕒 ประวัติลงเวลา (30 วันล่าสุด)</h4>
      <div style={{overflowX:'auto',maxHeight:300}}>
        <table style={{fontSize:13}}>
          <thead><tr><th>วันที่</th><th>เข้างาน</th><th>เลิกงาน</th><th>สถานะ</th></tr></thead>
          <tbody>
            {clocks.length===0?<tr><td colSpan={4} style={{textAlign:'center',color:'#94a3b8'}}>ยังไม่มีประวัติ</td></tr>:
            clocks.map(r=>(
              <tr key={r.id}>
                <td>{r.clock_date}</td>
                <td style={{color:'#16a34a',fontWeight:700}}>{r.clock_in||'—'}</td>
                <td style={{color:'#dc2626',fontWeight:700}}>{r.clock_out||'—'}</td>
                <td><span style={{fontSize:11,padding:'2px 8px',borderRadius:6,fontWeight:700,
                  background:r.status==='ปกติ'?'#dcfce7':r.status==='ไปราชการ'?'#dbeafe':'#fef3c7',
                  color:r.status==='ปกติ'?'#166534':r.status==='ไปราชการ'?'#1e40af':'#92400e'}}>{r.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>)}

    {/* Tab การลา */}
    {tab==='leave'&&(<>
      <div style={{background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:10,padding:14,marginBottom:14}}>
        <h4 style={{margin:'0 0 10px',color:'#1e40af'}}>📝 ยื่นใบลาใหม่</h4>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:8}}>
          <div><label style={{fontSize:11,fontWeight:600}}>ประเภทการลา</label>
            <select value={leaveForm.leave_type} onChange={e=>setLeaveForm(p=>({...p,leave_type:e.target.value}))}>
              {LEAVE_TYPES.map(t=><option key={t}>{t}</option>)}
            </select></div>
          <div><label style={{fontSize:11,fontWeight:600}}>วันที่เริ่มลา</label>
            <input type="date" value={leaveForm.start_date} onChange={e=>setLeaveForm(p=>({...p,start_date:e.target.value}))} /></div>
          <div><label style={{fontSize:11,fontWeight:600}}>วันที่กลับมา</label>
            <input type="date" value={leaveForm.end_date} onChange={e=>setLeaveForm(p=>({...p,end_date:e.target.value}))} /></div>
          <div style={{gridColumn:'span 2'}}><label style={{fontSize:11,fontWeight:600}}>เหตุผล</label>
            <input value={leaveForm.reason} onChange={e=>setLeaveForm(p=>({...p,reason:e.target.value}))} /></div>
        </div>
        <button className="success" style={{marginTop:10}} onClick={submitLeave}>📤 ยื่นใบลา</button>
      </div>
      <h4 style={{margin:'0 0 8px'}}>📋 ประวัติการลา</h4>
      <div style={{overflowX:'auto',maxHeight:300}}>
        <table style={{fontSize:13}}>
          <thead><tr><th>ประเภท</th><th>วันที่เริ่ม</th><th>วันที่สิ้นสุด</th><th style={{textAlign:'center'}}>จำนวน</th><th>สถานะ</th></tr></thead>
          <tbody>
            {leaves.length===0?<tr><td colSpan={5} style={{textAlign:'center',color:'#94a3b8'}}>ไม่มีประวัติการลา</td></tr>:
            leaves.map(r=>(
              <tr key={r.id}>
                <td>{r.leave_type}</td><td>{r.start_date}</td><td>{r.end_date}</td>
                <td style={{textAlign:'center'}}>{r.days} วัน</td>
                <td><span style={{fontSize:11,padding:'2px 8px',borderRadius:6,fontWeight:700,
                  background:statusColor[r.status],color:statusText[r.status]}}>{r.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>)}

    {/* Tab Admin */}
    {tab==='admin'&&isAdmin&&(<>
      <h4 style={{margin:'0 0 10px',color:'#dc2626'}}>⚠️ รายการรออนุมัติ ({pendingLeaves.length})</h4>
      {pendingLeaves.length===0?<div style={{textAlign:'center',padding:20,color:'#94a3b8'}}>ไม่มีรายการรออนุมัติ</div>:
      <div style={{overflowX:'auto'}}>
        <table style={{fontSize:13}}>
          <thead><tr><th>ครู</th><th>ประเภท</th><th>วันที่</th><th>จำนวน</th><th>เหตุผล</th><th>จัดการ</th></tr></thead>
          <tbody>
            {pendingLeaves.map(r=>(
              <tr key={r.id}>
                <td><b>{r.teacher_name}</b></td><td>{r.leave_type}</td>
                <td>{r.start_date} – {r.end_date}</td>
                <td style={{textAlign:'center'}}>{r.days} วัน</td>
                <td style={{fontSize:12,color:'#64748b'}}>{r.reason||'—'}</td>
                <td><div style={{display:'flex',gap:4}}>
                  <button style={{padding:'4px 10px',background:'#dcfce7',color:'#166534',border:'none',borderRadius:6,cursor:'pointer',fontWeight:700,fontSize:12}}
                    onClick={()=>approveLeave(r.id,'อนุมัติ')}>✅ อนุมัติ</button>
                  <button style={{padding:'4px 10px',background:'#fee2e2',color:'#dc2626',border:'none',borderRadius:6,cursor:'pointer',fontWeight:700,fontSize:12}}
                    onClick={()=>approveLeave(r.id,'ไม่อนุมัติ')}>❌ ไม่อนุมัติ</button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>}
    </>)}

    {toast&&<div className="toast show">{toast}</div>}
  </>);
}
