import React, { useState } from 'react';

export default function TeacherDashboard({ onBack }) {
  const [password,setPassword]=useState(sessionStorage.getItem('teacherPassword')||'');
  const [data,setData]=useState(null); const [err,setErr]=useState(''); const [busy,setBusy]=useState(false);
  async function load(){ setBusy(true); setErr(''); try{ const r=await fetch('/api/teacher-data',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})}); const d=await r.json(); if(!r.ok) throw new Error(d.error||'Unable to load'); sessionStorage.setItem('teacherPassword',password); setData(d);}catch(e){setErr(e.message)}finally{setBusy(false)} }
  return <div className="dashboard"><header className="site-header"><h1>Teacher analytics</h1><button className="btn" onClick={onBack}>Student view</button></header><main className="dashboard-main">
    {!data && <div className="login-card"><h2>Physics department access</h2><input className="password" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Dashboard password"/><button className="btn primary" onClick={load} disabled={busy}>{busy?'Loading…':'Open dashboard'}</button>{err&&<p className="error">{err}</p>}</div>}
    {data && <><div className="kpi-grid">{Object.entries(data.kpis).map(([k,v])=><div className="kpi" key={k}><strong>{v}</strong><span>{k.replaceAll('_',' ')}</span></div>)}</div>
      <h2>Most difficult questions</h2><div className="table-wrap"><table><thead><tr><th>Question</th><th>Attempts</th><th>Correct</th><th>Partial</th><th>Incorrect</th><th>Reveal rate</th><th>AI turns</th></tr></thead><tbody>{data.questions.map(x=><tr key={x.question_id}><td>{x.question_id}</td><td>{x.attempts}</td><td>{x.correct}</td><td>{x.partial}</td><td>{x.incorrect}</td><td>{x.reveal_rate}%</td><td>{x.ai_turns}</td></tr>)}</tbody></table></div>
      <p className="muted">Students are represented only by pseudonymous Supabase user IDs; names and email addresses are not shown in this dashboard.</p></>}
  </main></div>;
}
