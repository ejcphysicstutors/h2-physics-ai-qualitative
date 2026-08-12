import { adminClient, json, questionMap } from './_helpers.js';

function dateCutoff(range) {
  if (range === 'all') return null;
  const days = Number(range) || 30;
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days + 1);
  d.setUTCHours(0,0,0,0);
  return d.toISOString();
}

function emptyQ(questionId) {
  const q = questionMap.get(questionId) || {};
  return {
    question_id: questionId,
    topic_code: q.topicCode || '',
    topic: q.topic || '',
    question: q.question || questionId,
    attempts: 0, correct: 0, partial: 0, incorrect: 0, reveals: 0, ai_turns: 0
  };
}

function pct(n,d){ return d ? Math.round(100*n/d) : 0; }

export default async function handler(req,res){
  if(req.method!=='POST') return json(res,405,{error:'Method not allowed'});
  if(!process.env.TEACHER_DASHBOARD_PASSWORD || req.body?.password!==process.env.TEACHER_DASHBOARD_PASSWORD) return json(res,401,{error:'Incorrect dashboard password'});

  const range = ['7','30','all'].includes(req.body?.range) ? req.body.range : '30';
  const cutoff = dateCutoff(range);
  const supabase=adminClient();
  let progressQuery = supabase.from('progress').select('user_id,question_id,status,mark_scheme_revealed,updated_at');
  let eventsQuery = supabase.from('events').select('user_id,question_id,event_type,status,input_tokens,output_tokens,estimated_cost_usd,metadata,created_at');
  if (cutoff) {
    progressQuery = progressQuery.gte('updated_at', cutoff);
    eventsQuery = eventsQuery.gte('created_at', cutoff);
  }
  const [{data:progress,error:pe},{data:events,error:ee}] = await Promise.all([progressQuery, eventsQuery]);
  if(pe||ee) return json(res,500,{error:(pe||ee).message});

  const users=new Set();
  (progress||[]).forEach(x=>users.add(x.user_id));
  (events||[]).forEach(x=>users.add(x.user_id));

  const byQ={};
  for(const p of progress||[]){
    const x=byQ[p.question_id] ||= emptyQ(p.question_id);
    x.attempts++;
    if(p.status && x[p.status] !== undefined) x[p.status]++;
    if(p.mark_scheme_revealed)x.reveals++;
  }

  let aiTurns=0, reveals=0, cost=0, input=0, output=0;
  const missed = new Map();
  const daily = new Map();
  for(const e of events||[]){
    const date = String(e.created_at || '').slice(0,10);
    if (date) {
      const day = daily.get(date) || { date, ai_turns:0, reveals:0, users:new Set() };
      day.users.add(e.user_id);
      if(e.event_type==='ai_feedback') day.ai_turns++;
      if(e.event_type==='mark_scheme_revealed') day.reveals++;
      daily.set(date,day);
    }
    if(e.event_type==='mark_scheme_revealed') reveals++;
    if(e.event_type==='ai_feedback'){
      aiTurns++;
      input+=e.input_tokens||0;
      output+=e.output_tokens||0;
      cost+=Number(e.estimated_cost_usd||0);
      const x=byQ[e.question_id] ||= emptyQ(e.question_id);
      x.ai_turns++;
      const points = Array.isArray(e.metadata?.missed_points) ? e.metadata.missed_points : [];
      for (const point of points) {
        const key = String(point || '').trim();
        if (key) missed.set(key, (missed.get(key)||0)+1);
      }
    }
  }

  const rows=Object.values(byQ).map(x=>{
    const revealRate=pct(x.reveals,x.attempts);
    const avgAi=x.attempts ? x.ai_turns/x.attempts : 0;
    const outcomeDifficulty=x.attempts ? (x.incorrect + 0.55*x.partial)/x.attempts*100 : 0;
    const difficulty=Math.round(Math.min(100, outcomeDifficulty*0.6 + revealRate*0.25 + Math.min(avgAi,5)*3));
    return {...x,reveal_rate:revealRate,correct_pct:pct(x.correct,x.attempts),partial_pct:pct(x.partial,x.attempts),incorrect_pct:pct(x.incorrect,x.attempts),avg_ai_turns:Number(avgAi.toFixed(1)),difficulty_score:difficulty};
  }).sort((a,b)=>b.difficulty_score-a.difficulty_score||b.attempts-a.attempts);

  const topicMap={};
  for(const x of rows){
    const key=x.topic_code||'Other';
    const t=topicMap[key] ||= {topic_code:key,topic:x.topic||'',attempts:0,correct:0,partial:0,incorrect:0,reveals:0,ai_turns:0};
    t.attempts+=x.attempts; t.correct+=x.correct; t.partial+=x.partial; t.incorrect+=x.incorrect; t.reveals+=x.reveals; t.ai_turns+=x.ai_turns;
  }
  const topics=Object.values(topicMap).map(t=>({...t,correct_pct:pct(t.correct,t.attempts),partial_pct:pct(t.partial,t.attempts),incorrect_pct:pct(t.incorrect,t.attempts),reveal_rate:pct(t.reveals,t.attempts),avg_ai_turns:t.attempts?Number((t.ai_turns/t.attempts).toFixed(1)):0})).sort((a,b)=>a.topic_code.localeCompare(b.topic_code));

  const usageByDay=[...daily.values()].sort((a,b)=>a.date.localeCompare(b.date)).slice(-30).map(d=>({date:d.date,label:new Date(`${d.date}T00:00:00Z`).toLocaleDateString('en-SG',{day:'numeric',month:'short',timeZone:'UTC'}),ai_turns:d.ai_turns,reveals:d.reveals,active_students:d.users.size}));
  const missedConcepts=[...missed.entries()].map(([concept,count])=>({concept,count})).sort((a,b)=>b.count-a.count||a.concept.localeCompare(b.concept)).slice(0,15);
  const costDisplay = cost < 0.01 ? `$${cost.toFixed(4)}` : `$${cost.toFixed(2)}`;

  return json(res,200,{
    range,
    kpis:{students:users.size,questions_with_progress:(progress||[]).length,ai_tutor_turns:aiTurns,mark_scheme_reveals:reveals,input_tokens:input,output_tokens:output,estimated_ai_cost_usd:costDisplay},
    questions:rows.slice(0,50),
    topics,
    usage_by_day:usageByDay,
    missed_concepts:missedConcepts
  });
}
