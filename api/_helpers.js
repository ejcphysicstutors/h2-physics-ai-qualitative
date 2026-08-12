import { createClient } from '@supabase/supabase-js';
import questions from '../data/questions.json' with { type: 'json' };

export const questionMap = new Map(questions.map(q => [q.id, q]));
export function adminClient() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}
export async function authenticatedUser(req) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) throw new Error('Sign in required');
  const supabase = adminClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new Error('Invalid session');
  const domain = (process.env.SCHOOL_GOOGLE_DOMAIN || '').trim().toLowerCase();
  if (domain && !(data.user.email || '').toLowerCase().endsWith(`@${domain}`)) throw new Error('Please use your school Google account');
  return data.user;
}
export function json(res, status, body) { res.status(status).json(body); }
