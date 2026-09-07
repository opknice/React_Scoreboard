import { createClient } from 'npm:@supabase/supabase-js@2.112.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function requireEnvironmentVariable(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing Edge Function secret: ${name}`);
  return value;
}

async function createSha1Signature(parameters: Record<string, string>, apiSecret: string): Promise<string> {
  const serializedParameters = Object.entries(parameters)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
  const bytes = new TextEncoder().encode(`${serializedParameters}${apiSecret}`);
  const digest = await crypto.subtle.digest('SHA-1', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) return jsonResponse({ error: 'Authentication required' }, 401);

    const supabaseUrl = requireEnvironmentVariable('SUPABASE_URL');
    const supabaseAnonKey = requireEnvironmentVariable('SUPABASE_ANON_KEY');
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return jsonResponse({ error: 'Invalid or expired session' }, 401);

    const body: unknown = await request.json().catch(() => null);
    if (typeof body !== 'object' || body === null || typeof (body as { publicId?: unknown }).publicId !== 'string') {
      return jsonResponse({ error: 'publicId is required' }, 400);
    }
    const publicId = (body as { publicId: string }).publicId.trim();
    if (!publicId.startsWith(`players/${userData.user.id}/`)) return jsonResponse({ error: 'Not allowed to delete this image' }, 403);

    const cloudName = requireEnvironmentVariable('CLOUDINARY_CLOUD_NAME');
    const apiKey = requireEnvironmentVariable('CLOUDINARY_API_KEY');
    const apiSecret = requireEnvironmentVariable('CLOUDINARY_API_SECRET');
    const timestamp = Math.floor(Date.now() / 1000);
    const parameters = { invalidate: 'true', public_id: publicId, timestamp: String(timestamp), type: 'upload' };
    const signature = await createSha1Signature(parameters, apiSecret);
    const deleteResponse = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/destroy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ ...parameters, api_key: apiKey, signature }),
    });
    const result: unknown = await deleteResponse.json().catch(() => null);
    if (!deleteResponse.ok) return jsonResponse({ error: 'Cloudinary image deletion failed' }, 502);

    return jsonResponse({ deleted: true, result }, 200);
  } catch (error: unknown) {
    console.error('[cloudinary-player-delete] Unexpected error:', error instanceof Error ? error.message : error);
    return jsonResponse({ error: 'Unable to delete player image' }, 500);
  }
});
