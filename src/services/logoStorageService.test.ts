import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LogoStorageService, validateLogoFile } from './logoStorageService';

const supabaseMocks = vi.hoisted(() => {
  const upload = vi.fn();
  const getPublicUrl = vi.fn();
  const from = vi.fn(() => ({ upload, getPublicUrl }));
  const invoke = vi.fn();
  return { from, getPublicUrl, invoke, upload };
});

vi.mock('../config/supabaseClient', () => ({
  getSupabaseClient: () => ({
    functions: { invoke: supabaseMocks.invoke },
    storage: { from: supabaseMocks.from },
  }),
}));

function createLogoFile(
  name = 'สโมสร ทดสอบ.png',
  type = 'image/png',
  contents = 'logo',
): File {
  return new File([contents], name, { type });
}

describe('LogoStorageService', () => {
  beforeEach(() => {
    supabaseMocks.from.mockClear();
    supabaseMocks.upload.mockReset().mockResolvedValue({ error: null });
    supabaseMocks.getPublicUrl.mockReset().mockReturnValue({
      data: { publicUrl: 'https://supabase.example/team-logos/logos/logo.png' },
    });
    supabaseMocks.invoke.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects unsupported and oversized files before contacting a provider', async () => {
    const svg = createLogoFile('logo.svg', 'image/svg+xml');
    const oversized = new File([new Uint8Array((2 * 1024 * 1024) + 1)], 'logo.png', {
      type: 'image/png',
    });

    expect(() => validateLogoFile(svg)).toThrow(/PNG, JPG, WebP และ GIF/);
    expect(() => validateLogoFile(oversized)).toThrow(/2MB/);
    await expect(LogoStorageService.upload(svg, svg.name, 'supabase')).rejects.toThrow();
    expect(supabaseMocks.from).not.toHaveBeenCalled();
  });

  it('uploads a validated logo to the Supabase bucket', async () => {
    const file = createLogoFile();

    await expect(LogoStorageService.upload(file, file.name, 'supabase')).resolves.toBe(
      'https://supabase.example/team-logos/logos/logo.png',
    );
    expect(supabaseMocks.from).toHaveBeenCalledWith('team-logos');
    expect(supabaseMocks.upload).toHaveBeenCalledWith(
      expect.stringMatching(/^logos\/logo-/),
      file,
      expect.objectContaining({
        cacheControl: '31536000',
        contentType: 'image/png',
        upsert: false,
      }),
    );
  });

  it('uses the Edge Function signature for a direct Cloudinary upload', async () => {
    const file = createLogoFile('alpha.png');
    supabaseMocks.invoke.mockResolvedValue({
      data: {
        apiKey: 'public-api-key',
        cloudName: 'vayh51zb',
        folder: 'logos',
        overwrite: false,
        publicId: 'alpha-unique',
        signature: 'signed-value',
        timestamp: 1788590000,
        uploadPreset: 'logo_upload',
      },
      error: null,
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      secure_url: 'https://res.cloudinary.com/vayh51zb/image/upload/alpha.png',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(LogoStorageService.upload(file, file.name, 'cloudinary')).resolves.toBe(
      'https://res.cloudinary.com/vayh51zb/image/upload/alpha.png',
    );
    expect(supabaseMocks.invoke).toHaveBeenCalledWith('cloudinary-sign-upload', {
      body: {
        fileName: 'alpha.png',
        fileSize: file.size,
        mimeType: 'image/png',
      },
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const formData = requestInit.body as FormData;
    expect(formData.get('api_key')).toBe('public-api-key');
    expect(formData.get('signature')).toBe('signed-value');
    expect(formData.get('overwrite')).toBe('false');
    expect(formData.get('upload_preset')).toBe('logo_upload');
  });
});
