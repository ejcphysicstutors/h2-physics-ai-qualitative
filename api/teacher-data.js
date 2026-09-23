import { adminClient, json, questionMap } from './_helpers.js';

const SG_TIME_ZONE = 'Asia/Singapore';
const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const PAGE_SIZE = 1000;

function singaporeDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: SG_TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const get = type => parts.find(p => p.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function sgMidnightUtc(dateKey) {
  return new Date(`${dateKey}T00:00:00+08:00`);
}

function addDaysToKey(dateKey, days) {
  const d = sgMidnightUtc(dateKey);
  return singaporeDateKey(new Date(d.getTime() + days * DAY_MS));
}

function formatSgTime(value) {
  return new Intl.DateTimeFormat('en-SG', {
    timeZone: SG_TIME_ZONE,
    hour: 'numeric', minute: '2-digit'
  }).format(value instanceof Date ? value : new Date(value));
}

function formatSgDay(dateKey) {
  return new Intl.DateTimeFormat('en-SG', {
    day: 'numeric', month: 'short', timeZone: SG_TIME_ZONE
  }).format(sgMidnightUtc(dateKey));
}

function rangeWindow(range) {
  if (range === 'all') return null;

  const minuteRanges = { '20m': 20, '30m': 30, '60m': 60 };
  if (minuteRanges[range]) {
    const minutes = minuteRanges[range];
    const now = new Date();
    const startDate = new Date(now.getTime() - minutes * MINUTE_MS);
    return {
      kind: 'minutes',
      minutes,
      bucketMinutes: minutes <= 30 ? 5 : 10,
      start: startDate.toISOString(),
      endExclusive: new Date(now.getTime() + 1000).toISOString(),
      label: `Last ${minutes === 60 ? '1 hour' : `${minutes} minutes`} · ${formatSgTime(startDate)}–${formatSgTime(now)} SGT`
    };
  }

  const days = Number(range) || 30;
  const endKey = singaporeDateKey();
  const startKey = addDaysToKey(endKey, -(days - 1));
  const start = sgMidnightUtc(startKey).toISOString();
  const endExclusive = new Date(sgMidnightUtc(endKey).getTime() + DAY_MS).toISOString();
  const keys = Array.from({ length: days }, (_, i) => addDaysToKey(startKey, i));
  return {
    kind: 'days',
    days,
    startKey,
    endKey,
    start,
    endExclusive,
    keys,
    label: `${startKey} to ${endKey}`
  };
}

function emptyQ(questionId) {
  const q = questionMap.get(questionId) || {};
  return {
    question_id: questionId,
    topic_code: q.topicCode || '',
    topic: q.topic || '',
    question: q.question || questionId,
    attempts: 0,
    correct: 0,
    partial: 0,
    incorrect: 0,
    reveals: 0,
    ai_turns: 0
  };
}

function pct(n, d) { return d ? Math.round(100 * n / d) : 0; }

async function fetchAllProgress(supabase, window) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase
      .from('progress')
      .select('user_id,question_id,status,mark_scheme_revealed,updated_at')
      .order('user_id', { ascending: true })
      .order('question_id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (window) query = query.gte('updated_at', window.start).lt('updated_at', window.endExclusive);
    const { data, error } = await query;
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

async function fetchAllEvents(supabase, window) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase
      .from('events')
      .select('id,user_id,question_id,event_type,status,input_tokens,output_tokens,estimated_cost_usd,metadata,created_at')
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (window) query = query.gte('created_at', window.start).lt('created_at', window.endExclusive);
    const { data, error } = await query;
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

function buildUsageSeries(events, window) {
  if (window?.kind === 'minutes') {
    const bucketMs = window.bucketMinutes * MINUTE_MS;
    const startMs = new Date(window.start).getTime();
    const bucketCount = Math.ceil(window.minutes / window.bucketMinutes);
    const buckets = Array.from({ length: bucketCount }, (_, i) => {
      const start = new Date(startMs + i * bucketMs);
      return {
        date: start.toISOString(),
        label: formatSgTime(start),
        ai_turns: 0,
        reveals: 0,
        users: new Set()
      };
    });

    for (const e of events) {
      if (!e.created_at) continue;
      const index = Math.floor((new Date(e.created_at).getTime() - startMs) / bucketMs);
      if (index < 0 || index >= buckets.length) continue;
      const bucket = buckets[index];
      if (e.user_id) bucket.users.add(e.user_id);
      if (e.event_type === 'ai_feedback') bucket.ai_turns++;
      if (e.event_type === 'mark_scheme_revealed') bucket.reveals++;
    }

    return buckets.map(x => ({
      date: x.date,
      label: x.label,
      ai_turns: x.ai_turns,
      reveals: x.reveals,
      active_students: x.users.size
    }));
  }

  const daily = new Map();
  for (const e of events) {
    if (!e.created_at) continue;
    const date = singaporeDateKey(e.created_at);
    const day = daily.get(date) || { date, ai_turns: 0, reveals: 0, users: new Set() };
    if (e.user_id) day.users.add(e.user_id);
    if (e.event_type === 'ai_feedback') day.ai_turns++;
    if (e.event_type === 'mark_scheme_revealed') day.reveals++;
    daily.set(date, day);
  }

  const usageKeys = window?.kind === 'days' ? window.keys : [...daily.keys()].sort();
  return usageKeys.map(date => {
    const d = daily.get(date) || { date, ai_turns: 0, reveals: 0, users: new Set() };
    return {
      date,
      label: formatSgDay(date),
      ai_turns: d.ai_turns,
      reveals: d.reveals,
      active_students: d.users.size
    };
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  if (!process.env.TEACHER_DASHBOARD_PASSWORD || req.body?.password !== process.env.TEACHER_DASHBOARD_PASSWORD) {
    return json(res, 401, { error: 'Incorrect dashboard password' });
  }

  const allowedRanges = ['20m', '30m', '60m', '7', '30', 'all'];
  const range = allowedRanges.includes(req.body?.range) ? req.body.range : '30';
  const window = rangeWindow(range);
  const supabase = adminClient();

  let progress;
  let events;
  try {
    [progress, events] = await Promise.all([
      fetchAllProgress(supabase, window),
      fetchAllEvents(supabase, window)
    ]);
  } catch (error) {
    return json(res, 500, { error: error.message || 'Unable to load analytics' });
  }

  const users = new Set();
  progress.forEach(x => x.user_id && users.add(x.user_id));
  events.forEach(x => x.user_id && users.add(x.user_id));

  const byQ = {};
  const topicUsers = new Map();
  let correctCount = 0;
  let partialCount = 0;
  let incorrectCount = 0;

  for (const p of progress) {
    const x = byQ[p.question_id] ||= emptyQ(p.question_id);
    x.attempts++;
    if (p.status && x[p.status] !== undefined) x[p.status]++;
    if (p.status === 'correct') correctCount++;
    if (p.status === 'partial') partialCount++;
    if (p.status === 'incorrect') incorrectCount++;

    const q = questionMap.get(p.question_id) || {};
    const topicCode = q.topicCode || 'Other';
    const set = topicUsers.get(topicCode) || new Set();
    if (p.user_id) set.add(p.user_id);
    topicUsers.set(topicCode, set);
  }

  let aiTurns = 0;
  let revealEvents = 0;
  let cost = 0;
  let input = 0;
  let output = 0;
  const missed = new Map();
  const revealPairs = new Set();

  for (const e of events) {
    if (e.event_type === 'mark_scheme_revealed') {
      revealEvents++;
      if (e.user_id && e.question_id) revealPairs.add(`${e.user_id}::${e.question_id}`);
    }

    if (e.event_type === 'ai_feedback') {
      aiTurns++;
      input += e.input_tokens || 0;
      output += e.output_tokens || 0;
      cost += Number(e.estimated_cost_usd || 0);
      const x = byQ[e.question_id] ||= emptyQ(e.question_id);
      x.ai_turns++;
      const points = Array.isArray(e.metadata?.missed_points) ? e.metadata.missed_points : [];
      for (const point of points) {
        const key = String(point || '').trim();
        if (key) missed.set(key, (missed.get(key) || 0) + 1);
      }
    }
  }

  for (const pair of revealPairs) {
    const splitAt = pair.indexOf('::');
    const questionId = pair.slice(splitAt + 2);
    const x = byQ[questionId] ||= emptyQ(questionId);
    x.reveals++;
  }

  const rows = Object.values(byQ).map(x => {
    const assessed = x.correct + x.partial + x.incorrect;
    const unassessed = Math.max(0, x.attempts - assessed);
    const revealRate = pct(x.reveals, x.attempts);
    const avgAi = x.attempts ? x.ai_turns / x.attempts : 0;
    const outcomeDifficulty = assessed ? (x.incorrect + 0.55 * x.partial) / assessed * 100 : 0;
    const assessmentConfidence = Math.min(1, assessed / 5);
    const difficulty = Math.round(Math.min(
      100,
      outcomeDifficulty * 0.58 * assessmentConfidence + revealRate * 0.24 + Math.min(avgAi, 5) * 3.6
    ));
    return {
      ...x,
      assessed,
      unassessed,
      reveal_rate: revealRate,
      correct_pct: pct(x.correct, assessed),
      partial_pct: pct(x.partial, assessed),
      incorrect_pct: pct(x.incorrect, assessed),
      not_assessed_pct: pct(unassessed, x.attempts),
      avg_ai_turns: Number(avgAi.toFixed(1)),
      difficulty_score: difficulty
    };
  }).sort((a, b) => b.difficulty_score - a.difficulty_score || b.assessed - a.assessed || b.attempts - a.attempts);

  const topicMap = {};
  for (const x of rows) {
    const key = x.topic_code || 'Other';
    const t = topicMap[key] ||= {
      topic_code: key,
      topic: x.topic || '',
      attempts: 0,
      correct: 0,
      partial: 0,
      incorrect: 0,
      reveals: 0,
      ai_turns: 0
    };
    t.attempts += x.attempts;
    t.correct += x.correct;
    t.partial += x.partial;
    t.incorrect += x.incorrect;
    t.reveals += x.reveals;
    t.ai_turns += x.ai_turns;
  }

  const topics = Object.values(topicMap).map(t => {
    const assessed = t.correct + t.partial + t.incorrect;
    const unassessed = Math.max(0, t.attempts - assessed);
    const topQuestions = rows.filter(q => (q.topic_code || 'Other') === t.topic_code).slice(0, 3);
    return {
      ...t,
      assessed,
      unassessed,
      students: (topicUsers.get(t.topic_code) || new Set()).size,
      correct_pct: pct(t.correct, assessed),
      partial_pct: pct(t.partial, assessed),
      incorrect_pct: pct(t.incorrect, assessed),
      not_assessed_pct: pct(unassessed, t.attempts),
      reveal_rate: pct(t.reveals, t.attempts),
      avg_ai_turns: t.attempts ? Number((t.ai_turns / t.attempts).toFixed(1)) : 0,
      top_questions: topQuestions
    };
  }).sort((a, b) => a.topic_code.localeCompare(b.topic_code));

  const usageSeries = buildUsageSeries(events, window);
  const missedConcepts = [...missed.entries()]
    .map(([concept, count]) => ({ concept, count }))
    .sort((a, b) => b.count - a.count || a.concept.localeCompare(b.concept))
    .slice(0, 15);

  const costDisplay = cost < 0.01 ? `$${cost.toFixed(4)}` : `$${cost.toFixed(2)}`;
  const attempts = progress.length;
  const assessedCount = correctCount + partialCount + incorrectCount;
  const unassessedCount = Math.max(0, attempts - assessedCount);

  res.setHeader('Cache-Control', 'no-store');
  return json(res, 200, {
    range,
    time_zone: SG_TIME_ZONE,
    window_kind: window?.kind || 'all',
    window_label: window?.label || 'All time',
    date_window: window?.kind === 'days' ? { start: window.startKey, end: window.endKey } : null,
    kpis: {
      students: users.size,
      questions_with_progress: attempts,
      assessed_count: assessedCount,
      unassessed_count: unassessedCount,
      correct_count: correctCount,
      partial_count: partialCount,
      incorrect_count: incorrectCount,
      correct_rate: pct(correctCount, assessedCount),
      assessed_rate: pct(assessedCount, attempts),
      ai_tutor_turns: aiTurns,
      mark_scheme_reveals: revealPairs.size,
      mark_scheme_reveal_events: revealEvents,
      input_tokens: input,
      output_tokens: output,
      estimated_ai_cost_usd: costDisplay,
      avg_questions_per_student: users.size ? Number((attempts / users.size).toFixed(1)) : 0,
      avg_ai_turns_per_attempt: attempts ? Number((aiTurns / attempts).toFixed(1)) : 0
    },
    questions: rows.slice(0, 50),
    topics,
    usage_by_day: usageSeries,
    missed_concepts: missedConcepts
  });
}
