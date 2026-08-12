import React, { useEffect, useMemo, useState } from 'react';
import questions from './data/questions.public.json';
import { supabase, supabaseConfigured, getAccessToken } from './lib/supabase';
import TeacherDashboard from './components/TeacherDashboard.jsx';

const topicList = [...new Map(questions.map(q => [q.topicCode, `${q.topicCode} ${q.topic}`])).entries()];
const blank = () => ({ answer: '', status: '', feedback: [], revealed: false, busy: false });

function shortId(user) { return user?.id ? `Student ${user.id.slice(0, 8)}` : 'Guest preview'; }

export default function App() {
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(supabaseConfigured);
  const [topic, setTopic] = useState('all');
  const [index, setIndex] = useState(0);
  const [state, setState] = useState({});
  const [route, setRoute] = useState(location.hash === '#teacher' ? 'teacher' : 'student');

  const filtered = useMemo(() => topic === 'all' ? questions : questions.filter(q => q.topicCode === topic), [topic]);
  const q = filtered[index] || filtered[0];
  const current = q ? (state[q.id] || blank()) : blank();

  useEffect(() => {
    const onHash = () => setRoute(location.hash === '#teacher' ? 'teacher' : 'student');
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => { setUser(data.user || null); setLoadingAuth(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => { setUser(session?.user || null); setLoadingAuth(false); });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => { if (user) loadProgress(); }, [user]);

  async function loadProgress() {
    const { data } = await supabase.from('progress').select('question_id,status,mark_scheme_revealed').eq('user_id', user.id);
    if (!data) return;
    setState(prev => {
      const next = { ...prev };
      data.forEach(r => next[r.question_id] = { ...(next[r.question_id] || blank()), status: r.status || '', revealed: !!r.mark_scheme_revealed });
      return next;
    });
  }

  function patch(p) { setState(s => ({ ...s, [q.id]: { ...(s[q.id] || blank()), ...p } })); }

  async function login() {
    const redirectTo = `${location.origin}${location.pathname}`;
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
  }

  async function pilotLogin() {
    const { error } = await supabase.auth.signInAnonymously();
    if (error) {
      alert(error.message || 'Pilot sign-in failed');
    }
  }

  async function logout() { await supabase.auth.signOut(); }

  async function logEvent(eventType, extra = {}) {
    if (!supabase || !user) return;
    await supabase.from('events').insert({ user_id: user.id, question_id: q.id, event_type: eventType, metadata: extra });
  }

  async function submitAnswer() {
    const answer = current.answer.trim();
    if (!answer || !user) return;
    patch({ busy: true });
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/tutor', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ questionId: q.id, studentAnswer: answer, history: current.feedback })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Tutor request failed');
      patch({ busy: false, status: data.assessment, feedback: [...current.feedback, { role: 'student', content: answer }, { role: 'tutor', content: data.feedback }], answer: '' });
      await supabase.from('progress').upsert({ user_id: user.id, question_id: q.id, status: data.assessment, updated_at: new Date().toISOString() }, { onConflict: 'user_id,question_id' });
    } catch (e) { patch({ busy: false }); alert(e.message); }
  }

  async function revealMarkScheme() {
    if (!user) return;
    if (!current.feedback.length && !confirm('Try the question or get AI feedback first? You can still reveal the checkpoint now.')) return;
    const token = await getAccessToken();
    const res = await fetch(`/api/mark-scheme?questionId=${encodeURIComponent(q.id)}`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (!res.ok) return alert(data.error || 'Could not load mark scheme');
    patch({ revealed: true, markScheme: data.markScheme });
    await supabase.from('progress').upsert({ user_id: user.id, question_id: q.id, mark_scheme_revealed: true, updated_at: new Date().toISOString() }, { onConflict: 'user_id,question_id' });
    await logEvent('mark_scheme_revealed');
  }

  if (route === 'teacher') return <TeacherDashboard onBack={() => { location.hash=''; }} />;

  const completed = Object.values(state).filter(x => x.status).length;
  const correct = Object.values(state).filter(x => x.status === 'correct').length;
  const partial = Object.values(state).filter(x => x.status === 'partial').length;
  const incorrect = Object.values(state).filter(x => x.status === 'incorrect').length;

  return <div className="app-shell">
    <header className="site-header"><div><h1>H2 Physics</h1><div className="subtitle">AI Tutor Practice — 2026 Syllabus</div></div><div className="account-area">
      {loadingAuth ? 'Checking sign-in…' : user ? <><span>{shortId(user)}</span><button className="link-btn" onClick={logout}>Sign out</button></> : null}
      <a className="link-btn" href="#teacher">Teacher dashboard</a>
    </div></header>

    {!supabaseConfigured && <div className="notice">Preview mode: Supabase environment variables are not configured yet.</div>}
    {!loadingAuth && !user && supabaseConfigured && <main className="login-card"><h2>School sign-in</h2><p>Sign in with your school Google account so your progress follows you across devices.</p><button className="btn primary" onClick={login}>Continue with Google</button><button className="btn" onClick={pilotLogin} style={{marginLeft:'0.6rem'}}>Continue in pilot mode</button><p style={{marginTop:'0.8rem',fontSize:'0.82rem',opacity:0.7}}>Pilot mode is for testing on this browser. Google sign-in will be enabled later for cross-device progress.</p></main>}

    {(!supabaseConfigured || user) && <>
      <div className="controls-bar"><label>Topic</label><select value={topic} onChange={e => { setTopic(e.target.value); setIndex(0); }}><option value="all">All topics</option>{topicList.map(([code,label]) => <option key={code} value={code}>{label}</option>)}</select><button className="btn" onClick={() => setIndex(Math.floor(Math.random()*filtered.length))}>↕ Shuffle</button><span className="progress-label">{index+1} / {filtered.length}</span></div>
      <div className="stats-row"><Stat v={questions.length} l="Questions"/><Stat v={completed} l="Assessed"/><Stat v={correct} l="Correct"/><Stat v={partial} l="Partial"/><Stat v={incorrect} l="Incorrect"/></div>
      <main className="main">{q && <section className="q-card">
        <div className="q-card-header"><span className="topic-badge">{q.topicCode} {q.topic}</span><span className="q-num">Source Q{q.sourceNumber}</span><span className={`status ${current.status}`}>{current.status || 'Not assessed'}</span></div>
        <div className="q-body"><div className="q-text">{q.question}</div>{q.images?.map((src,i) => <img className="question-image" src={src} key={i} alt={`Question diagram ${i+1}`} />)}
          <label className="answer-label">Your answer</label><textarea value={current.answer} onChange={e=>patch({answer:e.target.value})} placeholder="Write your answer here…" disabled={current.busy}/>
        </div>
        <div className="action-row"><button className="btn primary" onClick={submitAnswer} disabled={!current.answer.trim() || current.busy || (!user && supabaseConfigured)}>{current.busy?'Thinking…':'Get AI feedback & assess'}</button><button className="btn" onClick={revealMarkScheme} disabled={!user && supabaseConfigured}>Show answer / mark scheme</button></div>
        {current.feedback.length>0 && <div className="chat-section">{current.feedback.map((m,i)=><div className={`msg ${m.role}`} key={i}><div className="msg-label">{m.role==='tutor'?'AI tutor':'You'}</div><div className="msg-bubble">{m.content}</div></div>)}</div>}
        {current.revealed && current.markScheme && <div className="mark-scheme"><h3>Checkpoint answer</h3><div>{current.markScheme}</div></div>}
      </section>}
      <div className="nav-row"><button className="btn" onClick={()=>setIndex(Math.max(0,index-1))}>← Previous</button><button className="btn primary" onClick={()=>setIndex(Math.min(filtered.length-1,index+1))}>Next question →</button></div></main>
    </>}
  </div>;
}

function Stat({v,l}) { return <div className="stat"><div className="stat-val">{v}</div><div className="stat-lbl">{l}</div></div>; }
