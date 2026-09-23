import React, { useEffect, useMemo, useState } from 'react';
import questions from './data/questions.public.json';
import { supabase, supabaseConfigured, getAccessToken } from './lib/supabase';
import TeacherDashboard from './components/TeacherDashboard.jsx';

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
            <span>Checking sign-in…</span>
          ) : user ? (
            <>
              <span className="student-id">{shortId(user)}</span>
              <button className="link-btn" onClick={logout}>
                Sign out
              </button>
            </>
          ) : null}

          <a className="link-btn teacher-link" href="#teacher">
            Teacher dashboard
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
            <label>Topic</label>

            <select
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

            <button
              className="btn shuffle-btn"
              aria-label="Shuffle questions"
              onClick={() =>
                goToQuestion(Math.floor(Math.random() * filtered.length))
              }
            >
              <span>↕</span>
              <span className="shuffle-text"> Shuffle</span>
            </button>

            <span className="progress-label">
              {index + 1} / {filtered.length}
            </span>
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

                    <span className="q-num">
                      Question {index + 1} of {filtered.length}
                    </span>

                    <span className="mark-allocation" title="Writing-length guide">
                      {q.marks} {q.marks === 1 ? 'mark' : 'marks'}
                    </span>

                    <span className={`status ${current.status}`}>
                      {current.status ? (current.status === 'partial' ? 'Developing' : current.status === 'correct' ? 'Secure' : 'Needs work') : 'Not attempted'}
                    </span>
                  </div>

                  <div className="q-body">

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
                      className="btn"
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

                  <span className="nav-progress">{index + 1} of {filtered.length}</span>

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

    </div>
  );
}

