import React, { Fragment, useEffect, useMemo, useState } from 'react';

const liveRangeOptions = [
  { value: '20m', label: 'Last 20 min' },
  { value: '30m', label: 'Last 30 min' },
  { value: '60m', label: 'Last 1 hour' }
];

const reviewRangeOptions = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: 'all', label: 'All time' }
];

export default function TeacherDashboard({ onBack }) {
  const [password, setPassword] = useState(sessionStorage.getItem('teacherPassword') || '');
  const [range, setRange] = useState('30');
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [topicSort, setTopicSort] = useState('attention');
  const [expandedTopic, setExpandedTopic] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  async function load(nextRange = range) {
    setBusy(true);
    setErr('');
    try {
      const r = await fetch('/api/teacher-data', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, range: nextRange })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Unable to load');
      sessionStorage.setItem('teacherPassword', password);
      setData(d);
      setLastUpdated(new Date());
      setExpandedTopic('');
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (data) load(range);
  }, [range]); // eslint-disable-line react-hooks/exhaustive-deps

  const sortedTopics = useMemo(() => {
    if (!data?.topics) return [];
    const rows = [...data.topics];
    if (topicSort === 'attention') {
      return rows.sort((a, b) => {
        if (!!a.assessed !== !!b.assessed) return a.assessed ? -1 : 1;
        return (a.correct_pct - b.correct_pct) ||
          (b.incorrect_pct - a.incorrect_pct) ||
          (b.assessed - a.assessed) ||
          (b.attempts - a.attempts);
      });
    }
    if (topicSort === 'attempts') return rows.sort((a, b) => b.attempts - a.attempts);
    return rows.sort((a, b) => a.topic_code.localeCompare(b.topic_code));
  }, [data, topicSort]);

  const isLiveRange = ['20m', '30m', '60m'].includes(range);

  return <div className="dashboard">
    <header className="site-header dashboard-header">
      <div>
        <h1>Teacher analytics</h1>
        <div className="subtitle">H2 Physics AI Tutor</div>
      </div>
      <button className="btn" onClick={onBack}>Student view</button>
    </header>

    <main className="dashboard-main">
      {!data && <div className="login-card">
        <h2>Physics department access</h2>
        <input
          className="password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && load()}
          placeholder="Dashboard password"
        />
        <button className="btn primary" onClick={() => load()} disabled={busy}>
          {busy ? 'Loading…' : 'Open dashboard'}
        </button>
        {err && <p className="error">{err}</p>}
      </div>}

      {data && <>
        <div className="dashboard-toolbar">
          <div>
            <div className="dashboard-kicker">Cohort activity</div>
            <h2>{isLiveRange ? 'Live lesson view' : 'Usage overview'}</h2>
            <p className="muted">
              Pseudonymous usage data only. Singapore time · {data.window_label}.
            </p>
          </div>
          <div className="dashboard-filter-actions">
            <label className="range-control">
              <span>Time range</span>
              <select aria-label="Analytics time range" value={range} onChange={e => setRange(e.target.value)}>
                <optgroup label="Live lesson">
                  {liveRangeOptions.map(x => <option value={x.value} key={x.value}>{x.label}</option>)}
                </optgroup>
                <optgroup label="Review">
                  {reviewRangeOptions.map(x => <option value={x.value} key={x.value}>{x.label}</option>)}
                </optgroup>
              </select>
            </label>
            <button className="analytics-refresh-btn" onClick={() => load()} disabled={busy}>
              {busy ? 'Refreshing…' : 'Refresh'}
            </button>
            {lastUpdated && <span className="last-updated">Updated {lastUpdated.toLocaleTimeString('en-SG', { hour: 'numeric', minute: '2-digit' })}</span>}
          </div>
        </div>

        {err && <p className="error">{err}</p>}

        <div className="kpi-grid teacher-kpis">
          <Kpi value={data.kpis.students} label="Active students" detail="pseudonymous users" />
          <Kpi value={Number(data.kpis.questions_with_progress).toLocaleString()} label="Questions attempted" detail={`${data.kpis.avg_questions_per_student} per student`} />
          <Kpi value={Number(data.kpis.assessed_count).toLocaleString()} label="Questions assessed" detail={`${data.kpis.assessed_rate}% of attempts · ${Number(data.kpis.unassessed_count).toLocaleString()} not assessed`} />
          <Kpi value={`${data.kpis.correct_rate}%`} label="Correct of assessed" detail={`${Number(data.kpis.correct_count).toLocaleString()} correct · ${Number(data.kpis.assessed_count).toLocaleString()} assessed`} />
          <Kpi value={Number(data.kpis.mark_scheme_reveals).toLocaleString()} label="Questions with answer revealed" detail="unique student-question reveals" />
        </div>

        <div className="system-usage-strip" aria-label="Interaction and system usage">
          <span className="system-usage-label">Interaction usage</span>
          <span>Tutor feedback <strong>{Number(data.kpis.ai_tutor_turns).toLocaleString()}</strong></span>
          <span>Reveal events <strong>{Number(data.kpis.mark_scheme_reveal_events).toLocaleString()}</strong></span>
          <span className="system-usage-divider" aria-hidden="true"></span>
          <span>Input tokens <strong>{Number(data.kpis.input_tokens).toLocaleString()}</strong></span>
          <span>Output tokens <strong>{Number(data.kpis.output_tokens).toLocaleString()}</strong></span>
          <span>Estimated AI cost <strong>{data.kpis.estimated_ai_cost_usd}</strong></span>
        </div>

        <section className="analytics-section analytics-section-first">
          <div className="section-heading">
            <div>
              <h2>{isLiveRange ? 'Activity during this lesson window' : 'Usage over time'}</h2>
              <p className="muted">When students are asking for tutor feedback and revealing answers.</p>
            </div>
            <div className="chart-legend" aria-label="Chart legend">
              <span><i className="legend-swatch ai"></i> Tutor feedback</span>
              <span><i className="legend-swatch reveals"></i> Answer reveals</span>
            </div>
          </div>
          <UsageBars rows={data.usage_by_day || []} range={range} />
        </section>

        <section className="analytics-section">
          <div className="section-heading section-heading-with-control">
            <div>
              <h2>Performance by topic</h2>
              <p className="muted">Performance percentages use assessed responses only. Grey represents attempts without a tutor assessment.</p>
              <div className="outcome-legend" aria-label="Outcome legend">
                <span><i className="outcome-dot correct"></i> You’ve got it!</span>
                <span><i className="outcome-dot partial"></i> Almost there!</span>
                <span><i className="outcome-dot incorrect"></i> Keep going!</span>
                <span><i className="outcome-dot unassessed"></i> Not assessed</span>
              </div>
            </div>
            <label className="mini-select-control">
              <span>Sort</span>
              <select value={topicSort} onChange={e => setTopicSort(e.target.value)}>
                <option value="attention">Needs attention</option>
                <option value="attempts">Most attempted</option>
                <option value="topic">Topic order</option>
              </select>
            </label>
          </div>

          <div className="table-wrap">
            <table className="analytics-table topic-table">
              <thead>
                <tr>
                  <th>Topic</th>
                  <th>Students</th>
                  <th>Attempts</th>
                  <th>Assessment</th>
                  <th>Outcome</th>
                  <th>Answer reveal</th>
                  <th>Tutor help</th>
                </tr>
              </thead>
              <tbody>
                {sortedTopics.map(x => <Fragment key={x.topic_code}>
                  <tr className={expandedTopic === x.topic_code ? 'topic-row expanded' : 'topic-row'}>
                    <td>
                      <button className="topic-expand-btn" onClick={() => setExpandedTopic(expandedTopic === x.topic_code ? '' : x.topic_code)} aria-expanded={expandedTopic === x.topic_code}>
                        <span className="topic-chevron">{expandedTopic === x.topic_code ? '▾' : '▸'}</span>
                        <span>
                          <strong>{x.topic_code}</strong>
                          <span className="cell-subtitle">{x.topic}</span>
                        </span>
                      </button>
                    </td>
                    <td>{x.students}</td>
                    <td>{x.attempts}</td>
                    <td>
                      <strong className="assessment-count">{x.assessed} assessed</strong>
                      <span className="cell-subtitle">{x.unassessed} not assessed</span>
                    </td>
                    <td>
                      <OutcomeBar
                        attempts={x.attempts}
                        correctCount={x.correct}
                        partialCount={x.partial}
                        incorrectCount={x.incorrect}
                        unassessedCount={x.unassessed}
                        correct={x.correct_pct}
                        partial={x.partial_pct}
                        incorrect={x.incorrect_pct}
                      />
                    </td>
                    <td>{x.reveal_rate}%</td>
                    <td>{x.avg_ai_turns} turns / attempt</td>
                  </tr>
                  {expandedTopic === x.topic_code && <TopicDetailRow topic={x} />}
                </Fragment>)}
              </tbody>
            </table>
          </div>
          <p className="analytics-footnote">Each assessed percentage uses the latest recorded tutor status for student-question attempts in the selected time range. Unassessed attempts are shown separately rather than treated as wrong.</p>
        </section>

        <section className="analytics-section">
          <div className="section-heading">
            <div>
              <h2>Questions needing attention</h2>
              <p className="muted">Questions rise here when assessed responses are weak, students reveal the answer, or they need more tutor help.</p>
            </div>
          </div>
          <div className="question-grid">
            {data.questions.slice(0, 12).map((x, i) => <article className="difficulty-card" key={x.question_id}>
              <div className="difficulty-card-top">
                <div>
                  <span className="question-rank">#{i + 1}</span>
                  <strong>{x.question_id}</strong>
                  <span>{x.topic_code} {x.topic}</span>
                </div>
                {x.assessed < 3 && <span className="sample-warning">Early signal</span>}
              </div>
              <p className="question-preview">{x.question}</p>
              <div className="mini-metrics">
                <span><b>{x.attempts}</b> attempts</span>
                <span><b>{x.assessed}</b> assessed</span>
                <span><b>{x.assessed ? `${x.correct_pct}%` : '—'}</b> correct of assessed</span>
                <span><b>{x.reveal_rate}%</b> revealed</span>
                <span><b>{x.avg_ai_turns}</b> tutor turns / attempt</span>
              </div>
              <a className="question-open-link" href={`/question/${encodeURIComponent(x.question_id)}`} target="_blank" rel="noreferrer">Open question ↗</a>
            </article>)}
          </div>
        </section>

        <section className="analytics-section">
          <div className="section-heading">
            <div>
              <h2>Frequently missed concepts</h2>
              <p className="muted">Signals extracted from tutor assessments. Use these for lesson review, not formal grading.</p>
            </div>
          </div>
          <div className="concept-list">
            {data.missed_concepts.length
              ? data.missed_concepts.map((x, i) => <div className="concept-row" key={x.concept}>
                  <span className="concept-rank">{i + 1}</span>
                  <span>{x.concept}</span>
                  <strong>{x.count}</strong>
                </div>)
              : <p className="muted concept-empty">No missed-concept data in this time range yet.</p>}
          </div>
        </section>
      </>}
    </main>
  </div>;
}

function Kpi({ value, label, detail }) {
  return <div className="kpi">
    <strong>{value}</strong>
    <span>{label}</span>
    {detail && <small>{detail}</small>}
  </div>;
}

function OutcomeBar({ attempts, correctCount, partialCount, incorrectCount, unassessedCount, correct, partial, incorrect }) {
  const width = count => attempts ? `${count / attempts * 100}%` : '0%';
  const assessed = correctCount + partialCount + incorrectCount;
  const title = assessed
    ? `${correct}% You’ve got it!, ${partial}% Almost there!, ${incorrect}% Keep going! among ${assessed} assessed; ${unassessedCount} not assessed`
    : `${unassessedCount} attempts not assessed`;

  return <div className="outcome-cell" title={title}>
    <div className="outcome-bar" aria-hidden="true">
      <span className="outcome-correct" style={{ width: width(correctCount) }}></span>
      <span className="outcome-partial" style={{ width: width(partialCount) }}></span>
      <span className="outcome-incorrect" style={{ width: width(incorrectCount) }}></span>
      <span className="outcome-unassessed" style={{ width: width(unassessedCount) }}></span>
    </div>
    <div className="outcome-labels">
      {assessed
        ? <><span>{correct}% got it</span><span>{partial}% almost</span><span>{incorrect}% keep going</span></>
        : <span>No assessed responses yet</span>}
    </div>
  </div>;
}

function TopicDetailRow({ topic }) {
  return <tr className="topic-detail-row">
    <td colSpan="7">
      <div className="topic-detail-panel">
        <div className="topic-detail-heading">
          <strong>Questions to review in {topic.topic_code}</strong>
          <span>Top signals within the selected time range</span>
        </div>
        <div className="topic-question-list">
          {(topic.top_questions || []).length ? topic.top_questions.map(q => <div className="topic-question-item" key={q.question_id}>
            <div>
              <strong>{q.question_id}</strong>
              <span>{q.question}</span>
            </div>
            <div className="topic-question-metrics">
              <span>{q.assessed}/{q.attempts} assessed</span>
              <span>{q.assessed ? `${q.correct_pct}% correct` : 'not assessed yet'}</span>
              <span>{q.reveal_rate}% revealed</span>
            </div>
            <a href={`/question/${encodeURIComponent(q.question_id)}`} target="_blank" rel="noreferrer">Open ↗</a>
          </div>) : <p className="muted">No question-level signals in this time range yet.</p>}
        </div>
      </div>
    </td>
  </tr>;
}

function UsageBars({ rows, range }) {
  const series = useMemo(() => prepareUsageSeries(rows, range), [rows, range]);
  if (!series.length || !series.some(x => x.ai_turns || x.reveals)) {
    return <div className="empty-panel">No usage events in this time range yet.</div>;
  }

  const max = Math.max(...series.flatMap(x => [x.ai_turns, x.reveals]), 1);
  const totalAi = series.reduce((sum, x) => sum + x.ai_turns, 0);
  const totalReveals = series.reduce((sum, x) => sum + x.reveals, 0);
  const labelEvery = series.length <= 8 ? 1 : series.length <= 16 ? 2 : Math.ceil(series.length / 7);

  return <div className="usage-chart-card">
    <div className="usage-chart-summary">
      <span><strong>{totalAi.toLocaleString()}</strong> tutor feedback turns</span>
      <span><strong>{totalReveals.toLocaleString()}</strong> answer reveal events</span>
    </div>
    <div className="usage-chart" style={{ '--usage-columns': series.length }}>
      {series.map((x, i) => <div className="usage-day" key={x.key || x.date} title={`${x.label}: ${x.ai_turns} tutor turns, ${x.reveals} answer reveals`}>
        <div className="bar-stack">
          <div className="bar ai" style={{ height: `${x.ai_turns ? Math.max(4, x.ai_turns / max * 100) : 0}%` }}></div>
          <div className="bar reveals" style={{ height: `${x.reveals ? Math.max(4, x.reveals / max * 100) : 0}%` }}></div>
        </div>
        <span className={`usage-label ${(i % labelEvery === 0 || i === series.length - 1) ? '' : 'hidden-label'}`}>{x.label}</span>
      </div>)}
    </div>
  </div>;
}

function prepareUsageSeries(rows, range) {
  if (['20m', '30m', '60m'].includes(range)) {
    return rows.map(x => ({ ...x, key: x.date }));
  }

  if (range !== 'all' || rows.length <= 14) {
    return rows.map(x => ({ ...x, key: x.date }));
  }

  if (rows.length <= 90) {
    const groups = [];
    for (let i = 0; i < rows.length; i += 7) {
      const chunk = rows.slice(i, i + 7);
      if (!chunk.length) continue;
      groups.push({
        key: `${chunk[0].date}-${chunk[chunk.length - 1].date}`,
        label: chunk.length === 1 ? chunk[0].label : `${chunk[0].label}–${chunk[chunk.length - 1].label}`,
        ai_turns: chunk.reduce((sum, x) => sum + x.ai_turns, 0),
        reveals: chunk.reduce((sum, x) => sum + x.reveals, 0)
      });
    }
    return groups;
  }

  const months = new Map();
  for (const row of rows) {
    const monthKey = row.date.slice(0, 7);
    const current = months.get(monthKey) || { key: monthKey, label: monthLabel(row.date), ai_turns: 0, reveals: 0 };
    current.ai_turns += row.ai_turns;
    current.reveals += row.reveals;
    months.set(monthKey, current);
  }
  return [...months.values()];
}

function monthLabel(dateKey) {
  const d = new Date(`${dateKey}T00:00:00+08:00`);
  return new Intl.DateTimeFormat('en-SG', { month: 'short', year: '2-digit', timeZone: 'Asia/Singapore' }).format(d);
}
