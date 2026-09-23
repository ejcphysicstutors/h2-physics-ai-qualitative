import React, { useEffect, useMemo, useState } from 'react';
import questions from './data/questions.public.json';
import { supabase, supabaseConfigured, getAccessToken } from './lib/supabase';
import TeacherDashboard from './components/TeacherDashboard.jsx';
import badge50 from './assets/badges/ej-physics-50.png';
import badge75 from './assets/badges/ej-physics-75.png';
import badge100 from './assets/badges/ej-physics-100.png';

const topicList = [...new Map(
  questions.map(q => [q.topicCode, `${q.topicCode} ${q.topic}`])
).entries()];

const questionPath = id => `/question/${encodeURIComponent(id)}`;

function questionFromPath() {
  const match = location.pathname.match(/^\/question\/([^/]+)\/?$/);
  if (!match) return null;
  const id = decodeURIComponent(match[1]);
  return questions.find(q => q.id === id) || null;
}

function lastQuestionId() {
  try {
    return localStorage.getItem('h2-physics-last-question');
  } catch {
    return null;
  }
}

const MILESTONES = [
  { percent: 50, image: badge50, label: '50% Complete' },
  { percent: 75, image: badge75, label: '75% Complete' },
  { percent: 100, image: badge100, label: '100% Complete' }
];

const blank = () => ({
  answer: '',
  status: '',
  feedback: [],
  revealed: false,
  busy: false
});

function shortId(user) {
  return user?.id ? `Student ${user.id.slice(0, 8)}` : 'Guest preview';
}


function cleanMarkText(text) {
  return text
    .replace(/(\d)o\b/g, '$1°')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatMarkScheme(markScheme, questionId) {
  if (!markScheme) return [];

  const blocks = markScheme
    .split(/\n\s*\n/)
    .map(block => cleanMarkText(block.replace(/\s*\n\s*/g, ' ')))
    .filter(Boolean);

  // This question has several equivalent/related conditions. Group them by idea
  // so the display does not imply that every printed line is a separate mark.
  if (questionId === 'H212-002') {
    const note = blocks.find(text => /^note:/i.test(text));
    const points = blocks.filter(text => !/^note:/i.test(text));

    const groups = [
      {
        id: 'formation',
        label: 'Formation',
        lines: points.slice(0, 2)
      },
      {
        id: 'bright',
        label: 'Bright / maximum fringes',
        lines: points.slice(2, 4)
      },
      {
        id: 'dark',
        label: 'Dark / minimum fringes',
        lines: points.slice(4, 6)
      }
    ].filter(group => group.lines.length);

    if (note) {
      groups.push({ id: 'note', text: note, note: true });
    }

    return groups;
  }

  return blocks.map((text, index) => ({
    id: `${index}-${text.slice(0, 24)}`,
    text,
    note: /^note:/i.test(text)
  }));
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(supabaseConfigured);
  const initialQuestion = useMemo(() => questionFromPath(), []);
  const [topic, setTopic] = useState(initialQuestion?.topicCode || 'all');
  const [index, setIndex] = useState(() => {
    if (!initialQuestion) return 0;
    return questions.filter(q => q.topicCode === initialQuestion.topicCode)
      .findIndex(q => q.id === initialQuestion.id);
  });
  const [state, setState] = useState({});
  const [route, setRoute] = useState(
    location.hash === '#teacher' ? 'teacher' : 'student'
  );
  const [showMilestones, setShowMilestones] = useState(false);
  const [activeBadge, setActiveBadge] = useState(null);

  const filtered = useMemo(
    () => topic === 'all'
      ? questions
      : questions.filter(q => q.topicCode === topic),
    [topic]
  );

  const q = filtered[index] || filtered[0];
  const current = q ? (state[q.id] || blank()) : blank();
  const [resumeId] = useState(() => lastQuestionId());
  const [showResume, setShowResume] = useState(() => !initialQuestion && !!lastQuestionId());
  const resumeQuestion = questions.find(item => item.id === resumeId) || null;

  const progressStats = useMemo(() => {
    const attempted = questions.filter(item => state[item.id]?.status);
    const correct = attempted.filter(item => state[item.id]?.status === 'correct');
    const scopeAttempted = filtered.filter(item => state[item.id]?.status);
    const scopeCorrect = scopeAttempted.filter(item => state[item.id]?.status === 'correct');
    const scopePercentCorrect = scopeAttempted.length
      ? Math.round((scopeCorrect.length / scopeAttempted.length) * 100)
      : null;

    const milestones = MILESTONES.map(milestone => ({
      ...milestone,
      threshold: Math.ceil((questions.length * milestone.percent) / 100),
      unlocked: attempted.length >= Math.ceil((questions.length * milestone.percent) / 100)
    }));

    return {
      attempted: attempted.length,
      correct: correct.length,
      scopeAttempted: scopeAttempted.length,
      scopeCorrect: scopeCorrect.length,
      scopePercentCorrect,
      milestones,
      unlockedMilestones: milestones.filter(item => item.unlocked).length
    };
  }, [state, filtered]);

  useEffect(() => {
    const onHash = () =>
      setRoute(location.hash === '#teacher' ? 'teacher' : 'student');

    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    const onPopState = () => {
      const linked = questionFromPath();
      if (!linked) return;
      const nextTopic = linked.topicCode;
      const topicQuestions = questions.filter(item => item.topicCode === nextTopic);
      setTopic(nextTopic);
      setIndex(Math.max(0, topicQuestions.findIndex(item => item.id === linked.id)));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    addEventListener('popstate', onPopState);
    return () => removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (!q || route !== 'student') return;

    try {
      localStorage.setItem('h2-physics-last-question', q.id);
    } catch {}

    const target = questionPath(q.id);
    if (location.pathname !== target) {
      history.replaceState({ questionId: q.id }, '', `${target}${location.search}${location.hash}`);
    }
  }, [q?.id, route]);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user || null);
      setLoadingAuth(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user || null);
      setLoadingAuth(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) loadProgress();
  }, [user]);

  async function loadProgress() {
    const { data } = await supabase
      .from('progress')
      .select('question_id,status,mark_scheme_revealed')
      .eq('user_id', user.id);

    if (!data) return;

    setState(prev => {
      const next = { ...prev };

      data.forEach(r => {
        next[r.question_id] = {
          ...(next[r.question_id] || blank()),
          status: r.status || '',
          revealed: !!r.mark_scheme_revealed
        };
      });

      return next;
    });
  }

  function patch(p) {
    setState(s => ({
      ...s,
      [q.id]: {
        ...(s[q.id] || blank()),
        ...p
      }
    }));
  }

  function goToQuestion(nextIndex, { replace = false } = {}) {
    const safeIndex = Math.max(0, Math.min(filtered.length - 1, nextIndex));
    const nextQuestion = filtered[safeIndex];
    if (!nextQuestion) return;

    setIndex(safeIndex);
    setShowResume(false);
    const method = replace ? 'replaceState' : 'pushState';
    history[method]({ questionId: nextQuestion.id }, '', questionPath(nextQuestion.id));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function chooseTopic(nextTopic) {
    setTopic(nextTopic);
    setShowResume(false);
    const nextQuestions = nextTopic === 'all'
      ? questions
      : questions.filter(item => item.topicCode === nextTopic);
    const nextQuestion = nextQuestions[0];
    setIndex(0);
    if (nextQuestion) {
      history.pushState({ questionId: nextQuestion.id }, '', questionPath(nextQuestion.id));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function resumePractice() {
    if (!resumeQuestion) return;
    const nextTopic = resumeQuestion.topicCode;
    const topicQuestions = questions.filter(item => item.topicCode === nextTopic);
    setTopic(nextTopic);
    setShowResume(false);
    setIndex(Math.max(0, topicQuestions.findIndex(item => item.id === resumeQuestion.id)));
    history.pushState({ questionId: resumeQuestion.id }, '', questionPath(resumeQuestion.id));
  }

  async function login() {
    const redirectTo = `${location.origin}${location.pathname}`;

    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo }
    });
  }

  async function logout() {
    await supabase.auth.signOut();
  }


  async function submitAnswer() {
    const answer = current.answer.trim();

    if (!answer || !user) return;

    patch({ busy: true });

    try {
      const token = await getAccessToken();

      const res = await fetch('/api/tutor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          questionId: q.id,
          studentAnswer: answer,
          history: current.feedback
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Tutor request failed');
      }

      patch({
        busy: false,
        status: data.assessment,
        feedback: [
          ...current.feedback,
          { role: 'student', content: answer },
          { role: 'tutor', content: data.feedback }
        ],
        answer: ''
      });


    } catch (e) {
      patch({ busy: false });
      alert(e.message);
    }
  }

  async function revealMarkScheme() {
    if (!user) return;

    if (
      !current.feedback.length &&
      !confirm(
        'Try the question or get AI feedback first? You can still reveal the checkpoint now.'
      )
    ) return;

    const token = await getAccessToken();

    const res = await fetch(
      `/api/mark-scheme?questionId=${encodeURIComponent(q.id)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    const data = await res.json();

    if (!res.ok) {
      return alert(data.error || 'Could not load mark scheme');
    }

    patch({
      revealed: true,
      markScheme: data.markScheme
    });

  }

  if (route === 'teacher') {
    return (
      <TeacherDashboard
        onBack={() => {
          location.hash = '';
        }}
      />
    );
  }

  const tutorTurns = current.feedback.filter(m => m.role === 'tutor').length;

  return (
    <div className="app-shell">

      <header className="site-header">
        <div className="brand">
          <h1>H2 Physics</h1>
          <div className="subtitle">
            Practice · Think · Improve
          </div>
        </div>

        <div className="account-area">
          {loadingAuth ? (
            <span className="account-status">Checking sign-in…</span>
          ) : user ? (
            <>
              <span className="student-id">{shortId(user)}</span>
              <button className="link-btn" onClick={logout}>
                Sign out
              </button>
            </>
          ) : null}

          <a className="link-btn teacher-link" href="#teacher" aria-label="Open teacher dashboard">
            Teacher
          </a>
        </div>
      </header>

      {!supabaseConfigured && (
        <div className="notice">
          Preview mode: Supabase environment variables are not configured yet.
        </div>
      )}

      {!loadingAuth && !user && supabaseConfigured && (
        <main className="login-card">
          <h2>School sign-in</h2>
          <p>
            Sign in with your school Google account so your progress follows
            you across devices.
          </p>

          <div className="privacy-note">
            <strong>Privacy:</strong> Your answer is sent to an AI service to
            generate feedback. Your written answers and AI conversations are
            not stored in the tutor&apos;s analytics. We retain your progress,
            question outcomes and anonymised learning indicators to support
            your learning and improve the resource.
          </div>

          <div className="login-actions">
            <button className="btn primary" onClick={login}>
              Continue with Google
            </button>
          </div>
        </main>
      )}

      {(!supabaseConfigured || user) && (
        <>
          <div className="controls-bar">
            <div className="controls-inner">
              <div className="topic-control">
                <label htmlFor="topic-select">Practice topic</label>

                <select
                  id="topic-select"
                  value={topic}
                  onChange={e => chooseTopic(e.target.value)}
                >
                  <option value="all">All topics</option>

                  {topicList.map(([code, label]) => (
                    <option key={code} value={code}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="practice-tools">
                <button
                  className="btn shuffle-btn"
                  aria-label="Shuffle questions"
                  onClick={() =>
                    goToQuestion(Math.floor(Math.random() * filtered.length))
                  }
                >
                  <span aria-hidden="true">↕</span>
                  <span className="shuffle-text"> Shuffle</span>
                </button>

                <span className="progress-label" aria-label={`Question ${index + 1} of ${filtered.length}`}>
                  <span className="progress-current">{index + 1}</span>
                  <span className="progress-separator"> of </span>
                  <span>{filtered.length}</span>
                </span>
              </div>

              <div className="progress-summary" aria-label="Practice progress">
              <div className="progress-summary-item">
                <span className="progress-summary-label">{topic === 'all' ? 'All topics' : 'This topic'}</span>
                <strong>{progressStats.scopeAttempted} of {filtered.length} attempted</strong>
                <span className="progress-dot" aria-hidden="true">·</span>
                <span>{progressStats.scopePercentCorrect === null ? '—' : `${progressStats.scopePercentCorrect}%`} correct</span>
              </div>

              <div className="progress-summary-item overall">
                <span className="progress-summary-label">Overall</span>
                <strong>{progressStats.correct} of {questions.length} correct</strong>
                <span className="progress-dot" aria-hidden="true">·</span>
                <span>{progressStats.attempted} attempted</span>
              </div>

              <button
                className="milestone-button"
                onClick={() => setShowMilestones(true)}
                aria-label={`Open milestones. ${progressStats.unlockedMilestones} of ${progressStats.milestones.length} badges unlocked.`}
              >
                <span className="milestone-icon" aria-hidden="true">★</span>
                <span>Milestones</span>
                <strong>{progressStats.unlockedMilestones}/{progressStats.milestones.length}</strong>
              </button>
              </div>
            </div>
          </div>

          <main className="main">
            {showResume && resumeQuestion && resumeQuestion.id !== q?.id && (
              <button className="resume-card" onClick={resumePractice}>
                <span className="resume-kicker">Continue where you left off</span>
                <span className="resume-title">{resumeQuestion.topicCode} {resumeQuestion.topic}</span>
                <span className="resume-question">{resumeQuestion.question}</span>
                <span className="resume-action">Continue →</span>
              </button>
            )}
            {q && (
              <>
                <section className="q-card">

                  <div className="q-card-header">
                    <span className="topic-badge">
                      {q.topicCode} {q.topic}
                    </span>

                    <div className="question-meta">
                    <span className="mark-allocation" title="Writing-length guide">
                      {q.marks} {q.marks === 1 ? 'mark' : 'marks'}
                    </span>

                    <span className={`status ${current.status}`}>
                      {current.status ? (current.status === 'partial' ? 'Partially correct' : current.status === 'correct' ? 'Correct' : 'Incorrect') : 'Not attempted'}
                    </span>
                    </div>
                  </div>

                  <div className="q-body">

                    <div className="question-kicker">Question</div>
                    <div className="q-text">
                      {q.question}
                    </div>

                    {q.images?.length > 0 && (
                      <div className="question-images">
                        {q.images.map((src, i) => (
                          <img
                            className="question-image"
                            src={src}
                            key={i}
                            alt={`Question diagram ${i + 1}`}
                          />
                        ))}
                      </div>
                    )}

                    {current.feedback.length > 0 && (
                      <section
                        className="conversation-panel"
                        aria-label="AI tutor conversation"
                      >
                        <div className="conversation-header">
                          <div>
                            <strong>Tutor feedback</strong>
                            <span className="turn-badge">
                              {tutorTurns}{' '}
                              {tutorTurns === 1 ? 'turn' : 'turns'}
                            </span>
                          </div>
                        </div>

                        <div className="chat-section">
                          {current.feedback.map((m, i) => (
                            <div className={`msg ${m.role}`} key={i}>
                              <div className="msg-label">
                                {m.role === 'tutor' ? 'Tutor feedback' : 'Your answer'}
                              </div>

                              <div className="msg-bubble">
                                {m.content}
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}

                    <div className="answer-composer">
                      <label className="answer-label">
                        {current.feedback.length
                          ? 'Improve your answer'
                          : 'Your answer'}
                      </label>

                      <textarea
                        rows={Math.min(7, Math.max(4, q.marks + 2))}
                        value={current.answer}
                        onChange={e => patch({ answer: e.target.value })}
                        placeholder={
                          current.feedback.length
                            ? 'Revise or extend your answer using the feedback…'
                            : 'Explain your physics reasoning here…'
                        }
                        disabled={current.busy}
                      />
                    </div>

                  </div>

                  <div className="action-row">
                    <button
                      className="btn primary"
                      onClick={submitAnswer}
                      disabled={
                        !current.answer.trim() ||
                        current.busy ||
                        (!user && supabaseConfigured)
                      }
                    >
                      {current.busy
                        ? 'Thinking…'
                        : current.feedback.length
                          ? 'Check revised answer'
                          : 'Get tutor feedback'}
                    </button>

                    <button
                      className="btn mark-scheme-btn"
                      onClick={revealMarkScheme}
                      disabled={!user && supabaseConfigured}
                    >
                      Check answer / mark scheme
                    </button>
                  </div>

                  {current.revealed && current.markScheme && (
                    <div className="mark-scheme">
                      <h3>Checkpoint answer</h3>
                      <div className="mark-points">
                        {formatMarkScheme(current.markScheme, q.id).map(point =>
                          point.note ? (
                            <div key={point.id} className="mark-note">
                              {point.text}
                            </div>
                          ) : point.lines ? (
                            <div key={point.id} className="mark-group">
                              <div className="mark-group-label">{point.label}</div>
                              {point.lines.map((line, lineIndex) => (
                                <div key={`${point.id}-${lineIndex}`} className="mark-group-line">
                                  {line}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div key={point.id} className="mark-point">
                              <span className="mark-bullet" aria-hidden="true">•</span>
                              <span>{point.text}</span>
                            </div>
                          )
                        )}
                      </div>
                      <div className="mark-scheme-hint">
                        Lines are grouped by idea for readability; they do not represent one mark each.
                      </div>
                    </div>
                  )}

                </section>

                <div className="nav-row">
                  <button
                    className="btn"
                    onClick={() => goToQuestion(index - 1)}
                    disabled={index === 0}
                  >
                    ← Previous question
                  </button>

                  <button
                    className="btn primary"
                    onClick={() => goToQuestion(index + 1)}
                    disabled={index === filtered.length - 1}
                  >
                    Next question →
                  </button>
                </div>
              </>
            )}
          </main>
        </>
      )}

      {showMilestones && (
        <div className="milestone-overlay" role="presentation" onMouseDown={() => setShowMilestones(false)}>
          <section className="milestone-panel" role="dialog" aria-modal="true" aria-labelledby="milestone-title" onMouseDown={e => e.stopPropagation()}>
            <div className="milestone-panel-header">
              <div>
                <div className="milestone-kicker">Your achievements</div>
                <h2 id="milestone-title">Physics practice milestones</h2>
                <p>Badges unlock as you attempt more of the {questions.length}-question practice bank.</p>
              </div>
              <button className="milestone-close" onClick={() => setShowMilestones(false)} aria-label="Close milestones">×</button>
            </div>

            <div className="milestone-grid">
              {progressStats.milestones.map(milestone => (
                <button
                  key={milestone.percent}
                  className={`milestone-card ${milestone.unlocked ? 'unlocked' : 'locked'}`}
                  disabled={!milestone.unlocked}
                  onClick={() => milestone.unlocked && setActiveBadge(milestone)}
                >
                  <div className="milestone-art-wrap">
                    <img src={milestone.image} alt={`${milestone.label} EJ Physics Practice badge`} />
                  </div>
                  <strong>{milestone.label}</strong>
                  <span>{milestone.unlocked ? 'Unlocked · tap to enlarge' : `Unlock at ${milestone.threshold} attempted`}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      {activeBadge && (
        <div className="badge-overlay" role="presentation" onMouseDown={() => setActiveBadge(null)}>
          <section className="badge-showcase" role="dialog" aria-modal="true" aria-label={`${activeBadge.label} achievement badge`} onMouseDown={e => e.stopPropagation()}>
            <button className="milestone-close badge-close" onClick={() => setActiveBadge(null)} aria-label="Close badge">×</button>
            <img src={activeBadge.image} alt={`${activeBadge.label} EJ Physics Practice badge`} />
            <div className="badge-showcase-note">Achievement unlocked — perfect for a screenshot.</div>
          </section>
        </div>
      )}

    </div>
  );
}

