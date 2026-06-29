import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Deletes the authenticated user's account and ALL their data (required by
// Google Play / App Store for apps with sign-in). Self-contained.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

// Verify the caller's JWT and return their user id.
async function requireUser(req: Request): Promise<string> {
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw json({ error: 'Unauthorized' }, 401);
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !anon) throw json({ error: 'Server misconfigured' }, 500);
  const sb = createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) throw json({ error: 'Unauthorized' }, 401);
  return data.user.id;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const userId = await requireUser(req);

    const url = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !serviceKey) return json({ error: 'Server misconfigured' }, 500);

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Deleting the public.users row cascades to categories / transactions /
    // learning_rules (ON DELETE CASCADE). Then remove the auth user itself.
    const { error: dataErr } = await admin.from('users').delete().eq('id', userId);
    if (dataErr) return json({ error: `Failed to delete data: ${dataErr.message}` }, 500);

    const { error: authErr } = await admin.auth.admin.deleteUser(userId);
    if (authErr) return json({ error: `Failed to delete account: ${authErr.message}` }, 500);

    return json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error('delete-account error:', e);
    return json({ error: (e as Error).message }, 500);
  }
});
