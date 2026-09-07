import { createClient } from 'npm:@supabase/supabase-js@2.112.4';

const MAX_FILE_SIZE_BYTES = 500 * 1024;
const PLAYER_IMAGE_LIMIT = 20;
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

function requireEnvironmentVariable(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing Edge Function secret: ${name}`);
  return value;
}

function createSafePublicId(fileName: string, userId: string, timestamp: number): string {
  const dotIndex = fileName.lastIndexOf('.');
  const baseName = dotIndex >= 0 ? fileName.slice(0, dotIndex) : fileName;
  const safeBaseName = baseName.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24) || 'player';
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

async function destroyCloudinaryImage(
  cloudName: string,
  apiKey: string,
  apiSecret: string,
  publicId: string,
): Promise<void> {
  const timestamp = Math.floor(Date.now() / 1000);
  const parameters = {
    invalidate: 'true',
    public_id: publicId,
    timestamp: String(timestamp),
    type: 'upload',
  };
  const signature = await createSha1Signature(parameters, apiSecret);
  const body = new URLSearchParams({ ...parameters, api_key: apiKey, signature });
  await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/destroy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
}

interface CloudinaryUploadResponse {
  secure_url?: unknown;
  public_id?: unknown;
}

function isSuccessfulCloudinaryUpload(value: unknown): value is CloudinaryUploadResponse {
  if (typeof value !== 'object' || value === null) return false;
  const payload = value as CloudinaryUploadResponse;
  return typeof payload.secure_url === 'string'
    && payload.secure_url.startsWith('https://')
    && typeof payload.public_id === 'string';
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  let uploadedPublicId: string | null = null;
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

    const { data: canUpload, error: accessError } = await supabase.rpc('can_upload_player_image');
    if (accessError) {
      console.error('[cloudinary-player-upload] Access check failed:', accessError.message);
      return jsonResponse({ error: 'Unable to verify player image quota' }, 503);
    }
    if (canUpload !== true) return jsonResponse({ error: 'Player image quota exceeded or access denied' }, 403);

    const formData = await request.formData();
    const fileValue = formData.get('file');
    if (!(fileValue instanceof File)) return jsonResponse({ error: 'Player image file is required' }, 400);
    if (fileValue.size <= 0 || fileValue.size > MAX_FILE_SIZE_BYTES) {
      return jsonResponse({ error: 'Player image must be between 1 byte and 500KB' }, 413);
    }
    if (!ALLOWED_MIME_TYPES.has(fileValue.type)) return jsonResponse({ error: 'Unsupported player image type' }, 415);

    const cloudName = requireEnvironmentVariable('CLOUDINARY_CLOUD_NAME');
    const apiKey = requireEnvironmentVariable('CLOUDINARY_API_KEY');
    const apiSecret = requireEnvironmentVariable('CLOUDINARY_API_SECRET');
    const uploadPreset = Deno.env.get('CLOUDINARY_PLAYER_UPLOAD_PRESET')?.trim()
      || Deno.env.get('CLOUDINARY_UPLOAD_PRESET')?.trim()
      || 'logo_upload';
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = `players/${userData.user.id}`;
    const publicIdLeaf = createSafePublicId(fileValue.name, userData.user.id, timestamp);
    const signedParameters = {
      folder,
      overwrite: 'false',
      public_id: publicIdLeaf,
      timestamp: String(timestamp),
      upload_preset: uploadPreset,
    };
    const signature = await createSha1Signature(signedParameters, apiSecret);

    const cloudinaryForm = new FormData();
    cloudinaryForm.append('file', fileValue, fileValue.name);
    cloudinaryForm.append('api_key', apiKey);
    cloudinaryForm.append('folder', folder);
    cloudinaryForm.append('overwrite', 'false');
    cloudinaryForm.append('public_id', publicIdLeaf);
    cloudinaryForm.append('timestamp', String(timestamp));
    cloudinaryForm.append('upload_preset', uploadPreset);
    cloudinaryForm.append('signature', signature);

    const uploadResponse = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`, {
      method: 'POST',
      body: cloudinaryForm,
    });
    const uploadPayload: unknown = await uploadResponse.json().catch(() => null);
    if (!uploadResponse.ok || !isSuccessfulCloudinaryUpload(uploadPayload)) {
      return jsonResponse({ error: 'Cloudinary player image upload failed' }, 502);
    }
    uploadedPublicId = uploadPayload.public_id as string;

    const { data: nextCount, error: incrementError } = await supabase.rpc('increment_uploaded_player_image_count');
    if (incrementError || typeof nextCount !== 'number') {
      await destroyCloudinaryImage(cloudName, apiKey, apiSecret, uploadedPublicId);
      uploadedPublicId = null;
      if (incrementError?.message.includes('quota exceeded')) return jsonResponse({ error: 'Player image quota exceeded' }, 403);
      return jsonResponse({ error: 'Unable to record player image quota' }, 503);
    }

    uploadedPublicId = null;
    const isUnlimited = nextCount < 0;
    return jsonResponse({
      secureUrl: uploadPayload.secure_url,
      publicId: uploadPayload.public_id,
      isUnlimited,
      remainingQuota: isUnlimited ? null : Math.max(0, PLAYER_IMAGE_LIMIT - nextCount),
    }, 200);
  } catch (error: unknown) {
    console.error('[cloudinary-player-upload] Unexpected error:', error instanceof Error ? error.message : error);
    return jsonResponse({ error: 'Unable to upload player image' }, 500);
  } finally {
    // A failed request after Cloudinary accepted the file must not leave an
    // untracked asset. The normal quota-rejection path already deletes it.
    if (uploadedPublicId) {
      try {
        const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME')?.trim();
        const apiKey = Deno.env.get('CLOUDINARY_API_KEY')?.trim();
        const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET')?.trim();
        if (cloudName && apiKey && apiSecret) await destroyCloudinaryImage(cloudName, apiKey, apiSecret, uploadedPublicId);
      } catch (cleanupError: unknown) {
        console.error('[cloudinary-player-upload] Cleanup failed:', cleanupError instanceof Error ? cleanupError.message : cleanupError);
      }
    }
  }
});
