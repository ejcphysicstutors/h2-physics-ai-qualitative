import React, { useEffect, useState } from 'react';

const rangeOptions = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: 'all', label: 'All time' }
];

export default function TeacherDashboard({ onBack }) {
  const [password,setPassword]=useState(sessionStorage.getItem('teacherPassword')||'');
  const [range,setRange]=useState('30');
  const [data,setData]=useState(null);
  const [err,setErr]=useState('');
  const [busy,setBusy]=useState(false);

  async function load(nextRange = range){
    setBusy(true); setErr('');
    try{
      const r=await fetch('/api/teacher-data',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password,range:nextRange})});
      const d=await r.json();
      if(!r.ok) throw new Error(d.error||'Unable to load');
      sessionStorage.setItem('teacherPassword',password);
      setData(d);
    }catch(e){setErr(e.message)}finally{setBusy(false)}
  }

  useEffect(() => { if (data) load(range); }, [range]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div className="dashboard">
    <header className="site-header dashboard-header"><div><h1>Teacher analytics</h1><div className="subtitle">H2 Physics AI Tutor</div></div><button className="btn" onClick={onBack}>Student view</button></header>
    <main className="dashboard-main">
      {!data && <div className="login-card"><h2>Physics department access</h2><input className="password" type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&load()} placeholder="Dashboard password"/><button className="btn primary" onClick={()=>load()} disabled={busy}>{busy?'Loading…':'Open dashboard'}</button>{err&&<p className="error">{err}</p>}</div>}

      {data && <>
        <div className="dashboard-toolbar"><div><h2>Usage overview</h2><p className="muted">Pseudonymous usage data only; student names and email addresses are not displayed.</p></div><select aria-label="Analytics time range" value={range} onChange={e=>setRange(e.target.value)}>{rangeOptions.map(x=><option value={x.value} key={x.value}>{x.label}</option>)}</select></div>
        {err&&<p className="error">{err}</p>}
        <div className="kpi-grid">
          <Kpi value={data.kpis.students} label="Students" />
          <Kpi value={data.kpis.questions_with_progress} label="Question progress records" />
          <Kpi value={data.kpis.ai_tutor_turns} label="AI tutor turns" />
          <Kpi value={data.kpis.mark_scheme_reveals} label="Answer reveals" />
          <Kpi value={Number(data.kpis.input_tokens).toLocaleString()} label="Input tokens" />
          <Kpi value={Number(data.kpis.output_tokens).toLocaleString()} label="Output tokens" />
          <Kpi value={data.kpis.estimated_ai_cost_usd} label="Estimated AI cost (USD)" />
        </div>

        <section className="analytics-section">
          <div className="section-heading"><div><h2>Usage over time</h2><p className="muted">AI tutor interactions and answer reveals by day.</p></div></div>
          <UsageBars rows={data.usage_by_day || []}/>
        </section>

        <section className="analytics-section">
          <div className="section-heading"><div><h2>Performance by topic</h2><p className="muted">A quick view of where students are seeking the most help.</p></div></div>
          <div className="table-wrap"><table className="analytics-table"><thead><tr><th>Topic</th><th>Students attempted</th><th>Correct</th><th>Partial</th><th>Incorrect</th><th>Reveal rate</th><th>AI turns / student</th></tr></thead><tbody>{data.topics.map(x=><tr key={x.topic_code}><td><strong>{x.topic_code}</strong><span className="cell-subtitle">{x.topic}</span></td><td>{x.attempts}</td><td>{x.correct_pct}%</td><td>{x.partial_pct}%</td><td>{x.incorrect_pct}%</td><td>{x.reveal_rate}%</td><td>{x.avg_ai_turns}</td></tr>)}</tbody></table></div>
        </section>

        <section className="analytics-section">
          <div className="section-heading"><div><h2>Most difficult questions</h2><p className="muted">Difficulty combines incomplete/incorrect outcomes, answer reveals and the amount of AI help required.</p></div></div>
          <div className="question-grid">{data.questions.slice(0,20).map(x=><article className="difficulty-card" key={x.question_id}>
            <div className="difficulty-card-top"><div><strong>{x.question_id}</strong><span>{x.topic_code} {x.topic}</span></div><span className="difficulty-score">{x.difficulty_score}</span></div>
            <p className="question-preview">{x.question}</p>
            <div className="mini-metrics"><span><b>{x.attempts}</b> attempted</span><span><b>{x.correct_pct}%</b> correct</span><span><b>{x.reveal_rate}%</b> revealed</span><span><b>{x.avg_ai_turns}</b> AI turns/student</span></div>
          </article>)}</div>
        </section>

        <section className="analytics-section">
          <div className="section-heading"><div><h2>Frequently missed concepts</h2><p className="muted">Concept labels come from Claude's structured assessment; use these as signals for lesson review rather than formal grading.</p></div></div>
          <div className="concept-list">{data.missed_concepts.length ? data.missed_concepts.map((x,i)=><div className="concept-row" key={x.concept}><span className="concept-rank">{i+1}</span><span>{x.concept}</span><strong>{x.count}</strong></div>) : <p className="muted">No missed-concept data in this time range yet.</p>}</div>
        </section>
      </>}
    </main>
  </div>;
}

function Kpi({ value, label }) { return <div className="kpi"><strong>{value}</strong><span>{label}</span></div>; }

function UsageBars({ rows }) {
  if (!rows.length) return <div className="empty-panel">No usage events in this time range yet.</div>;
  const max = Math.max(...rows.map(x => x.ai_turns + x.reveals), 1);
  return <div className="usage-chart">{rows.map(x => <div className="usage-day" key={x.date} title={`${x.date}: ${x.ai_turns} AI turns, ${x.reveals} reveals`}><div className="bar-stack"><div className="bar ai" style={{height:`${Math.max(3, x.ai_turns/max*100)}%`}}></div><div className="bar reveals" style={{height:`${x.reveals ? Math.max(3, x.reveals/max*100) : 0}%`}}></div></div><span>{x.label}</span></div>)}</div>;
}
