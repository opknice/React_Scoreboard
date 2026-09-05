import { createClient } from 'npm:@supabase/supabase-js@2.112.4';

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface SignatureRequest {
  fileName: string;
  fileSize: number;
  mimeType: string;
}

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}

function readSignatureRequest(value: unknown): SignatureRequest | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const candidate = value as Partial<SignatureRequest>;
  if (typeof candidate.fileName !== 'string' || !candidate.fileName.trim()) return null;
  if (typeof candidate.fileSize !== 'number' || !Number.isSafeInteger(candidate.fileSize)) return null;
  if (typeof candidate.mimeType !== 'string') return null;
  return {
    fileName: candidate.fileName.trim(),
    fileSize: candidate.fileSize,
    mimeType: candidate.mimeType,
  };
}

function requireEnvironmentVariable(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing Edge Function secret: ${name}`);
  return value;
}

function createPublicId(fileName: string, userId: string, timestamp: number): string {
  const dotIndex = fileName.lastIndexOf('.');
  const baseName = dotIndex >= 0 ? fileName.slice(0, dotIndex) : fileName;
  const safeBaseName = baseName.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24) || 'logo';
  const randomSuffix = crypto.randomUUID().replaceAll('-', '').slice(0, 12);
  return `${safeBaseName}-${userId.slice(0, 8)}-${timestamp}-${randomSuffix}`;
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
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Authentication required' }, 401);
    }

    const supabaseUrl = requireEnvironmentVariable('SUPABASE_URL');
    const supabaseAnonKey = requireEnvironmentVariable('SUPABASE_ANON_KEY');
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return jsonResponse({ error: 'Invalid or expired session' }, 401);
    }

    // The database is the source of truth for trial expiry and the 10-image quota.
    const { data: canUpload, error: accessError } = await supabase.rpc('can_upload_image');
    if (accessError) {
      console.error('[cloudinary-sign-upload] Access check failed:', accessError.message);
      return jsonResponse({ error: 'Unable to verify upload quota' }, 503);
    }
    if (canUpload !== true) {
      return jsonResponse({ error: 'Upload quota exceeded or access denied' }, 403);
    }

    const payload = readSignatureRequest(await request.json().catch(() => null));
    if (!payload) {
      return jsonResponse({ error: 'Invalid upload metadata' }, 400);
    }
    if (payload.fileSize <= 0 || payload.fileSize > MAX_FILE_SIZE_BYTES) {
      return jsonResponse({ error: 'Logo file must be between 1 byte and 2MB' }, 413);
    }
    if (!ALLOWED_MIME_TYPES.has(payload.mimeType)) {
      return jsonResponse({ error: 'Unsupported logo file type' }, 415);
    }

    const cloudName = requireEnvironmentVariable('CLOUDINARY_CLOUD_NAME');
    const apiKey = requireEnvironmentVariable('CLOUDINARY_API_KEY');
    const apiSecret = requireEnvironmentVariable('CLOUDINARY_API_SECRET');
    const uploadPreset = Deno.env.get('CLOUDINARY_UPLOAD_PRESET')?.trim() || 'logo_upload';
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = 'logos';
    const publicId = createPublicId(payload.fileName, userData.user.id, timestamp);
    const signedParameters = {
      folder,
      overwrite: 'false',
      public_id: publicId,
      timestamp: String(timestamp),
      upload_preset: uploadPreset,
    };
    const signature = await createSha1Signature(signedParameters, apiSecret);

    return jsonResponse({
      apiKey,
      cloudName,
      folder,
      overwrite: false,
      publicId,
      signature,
      timestamp,
      uploadPreset,
    }, 200);
  } catch (error: unknown) {
    console.error(
      '[cloudinary-sign-upload] Unexpected error:',
      error instanceof Error ? error.message : error,
    );
    return jsonResponse({ error: 'Unable to create Cloudinary upload signature' }, 500);
  }
});
