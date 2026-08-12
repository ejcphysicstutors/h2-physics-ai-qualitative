import { adminClient, json } from './_helpers.js';
export default async function handler(req,res){
  if(req.method!=='POST') return json(res,405,{error:'Method not allowed'});
  if(!process.env.TEACHER_DASHBOARD_PASSWORD || req.body?.password!==process.env.TEACHER_DASHBOARD_PASSWORD) return json(res,401,{error:'Incorrect dashboard password'});
  const supabase=adminClient();
  const [{data:progress,error:pe},{data:events,error:ee}] = await Promise.all([
    supabase.from('progress').select('user_id,question_id,status,mark_scheme_revealed,updated_at'),
    supabase.from('events').select('user_id,question_id,event_type,status,input_tokens,output_tokens,estimated_cost_usd,metadata,created_at')
  ]);
  if(pe||ee) return json(res,500,{error:(pe||ee).message});
  const users=new Set(); (progress||[]).forEach(x=>users.add(x.user_id)); (events||[]).forEach(x=>users.add(x.user_id));
  const byQ={};
  for(const p of progress||[]){ const x=byQ[p.question_id] ||= {question_id:p.question_id,attempts:0,correct:0,partial:0,incorrect:0,reveals:0,ai_turns:0}; x.attempts++; if(p.status)x[p.status]++; if(p.mark_scheme_revealed)x.reveals++; }
  let aiTurns=0, cost=0, input=0, output=0;
  for(const e of events||[]){ if(e.event_type==='ai_feedback'){aiTurns++; input+=e.input_tokens||0; output+=e.output_tokens||0; cost+=Number(e.estimated_cost_usd||0); const x=byQ[e.question_id] ||= {question_id:e.question_id,attempts:0,correct:0,partial:0,incorrect:0,reveals:0,ai_turns:0}; x.ai_turns++;} }
  const rows=Object.values(byQ).map(x=>({...x,reveal_rate:x.attempts?Math.round(100*x.reveals/x.attempts):0,difficulty:(x.incorrect*2+x.partial+x.reveals)/(x.attempts||1)})).sort((a,b)=>b.difficulty-a.difficulty||b.attempts-a.attempts).slice(0,50);
  return json(res,200,{kpis:{anonymous_students:users.size,questions_with_progress:(progress||[]).length,ai_tutor_turns:aiTurns,input_tokens:input,output_tokens:output,estimated_ai_cost_usd:`$${cost.toFixed(2)}`},questions:rows});
}
