import { adminClient, authenticatedUser, json, questionMap } from './_helpers.js';

export default async function handler(req,res){
  if(req.method!=='GET') return json(res,405,{error:'Method not allowed'});
  try{
    const user = await authenticatedUser(req);
    const q=questionMap.get(req.query.questionId);
    if(!q) return json(res,404,{error:'Question not found'});

    const supabase = adminClient();
    const now = new Date().toISOString();
    const [{ error: progressError }, { error: eventError }] = await Promise.all([
      supabase.from('progress').upsert({
        user_id: user.id,
        question_id: q.id,
        mark_scheme_revealed: true,
        updated_at: now
      }, { onConflict: 'user_id,question_id' }),
      supabase.from('events').insert({
        user_id: user.id,
        question_id: q.id,
        event_type: 'mark_scheme_revealed',
        metadata: {}
      })
    ]);

    if (progressError) console.error('[analytics] mark-scheme progress upsert failed', progressError);
    if (eventError) console.error('[analytics] mark_scheme_revealed insert failed', eventError);

    res.setHeader('Cache-Control', 'no-store');
    return json(res,200,{
      markScheme:q.markScheme,
      analyticsRecorded: !progressError && !eventError
    });
  }
  catch(e){ return json(res,401,{error:e.message}); }
}
