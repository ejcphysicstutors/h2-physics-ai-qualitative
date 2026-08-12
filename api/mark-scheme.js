import { authenticatedUser, json, questionMap } from './_helpers.js';
export default async function handler(req,res){
  if(req.method!=='GET') return json(res,405,{error:'Method not allowed'});
  try{ await authenticatedUser(req); const q=questionMap.get(req.query.questionId); if(!q) return json(res,404,{error:'Question not found'}); return json(res,200,{markScheme:q.markScheme}); }
  catch(e){ return json(res,401,{error:e.message}); }
}
