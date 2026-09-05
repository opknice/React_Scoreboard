import { getSupabaseClient } from '../config/supabaseClient';
import { MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB } from '../constants/uploadConfig';
import type { LogoStorageProvider } from '../types/logoStorage';

const TEAM_LOGO_BUCKET = 'team-logos';
const TEAM_LOGO_FOLDER = 'logos';

export const ALLOWED_LOGO_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
] as const;

interface CloudinarySignatureResponse {
  apiKey: string;
  cloudName: string;
  folder: string;
  overwrite: false;
  publicId: string;
  signature: string;
  timestamp: number;
  uploadPreset: string;
}

interface CloudinaryUploadResponse {
  secure_url: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCloudinarySignatureResponse(value: unknown): value is CloudinarySignatureResponse {
  if (!isRecord(value)) return false;
  return typeof value.apiKey === 'string'
    && typeof value.cloudName === 'string'
    && typeof value.folder === 'string'
    && value.overwrite === false
    && typeof value.publicId === 'string'
    && typeof value.signature === 'string'
    && typeof value.timestamp === 'number'
    && typeof value.uploadPreset === 'string';
}

function isCloudinaryUploadResponse(value: unknown): value is CloudinaryUploadResponse {
  return isRecord(value)
    && typeof value.secure_url === 'string'
    && value.secure_url.startsWith('https://');
}

function readCloudinaryError(value: unknown): string | null {
  if (!isRecord(value) || !isRecord(value.error)) return null;
  return typeof value.error.message === 'string' ? value.error.message : null;
}

export function validateLogoFile(file: File | Blob): void {
  if (!ALLOWED_LOGO_MIME_TYPES.some((mimeType) => mimeType === file.type)) {
    throw new Error('รองรับเฉพาะไฟล์ PNG, JPG, WebP และ GIF เท่านั้น');
  }
  if (file.size <= 0) {
    throw new Error('ไฟล์รูปภาพว่างเปล่า');
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeInMb = (file.size / (1024 * 1024)).toFixed(2);
    throw new Error(`ไฟล์ใหญ่เกิน ${MAX_FILE_SIZE_MB}MB (ขนาดปัจจุบัน ${sizeInMb}MB)`);
  }
}

function createSupabaseObjectName(fileName: string, mimeType: string): string {
  const dotIndex = fileName.lastIndexOf('.');
  const baseName = dotIndex >= 0 ? fileName.slice(0, dotIndex) : fileName;
  const cleanBaseName = baseName.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24) || 'logo';
  const extensionByMimeType: Record<string, string> = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/webp': '.webp',
    'image/gif': '.gif',
  };
  const uniqueSuffix = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `${cleanBaseName}-${uniqueSuffix}${extensionByMimeType[mimeType]}`;
}

async function uploadToSupabase(file: File | Blob, fileName: string): Promise<string> {
  const client = getSupabaseClient();
  const objectName = createSupabaseObjectName(fileName, file.type);
  const filePath = `${TEAM_LOGO_FOLDER}/${objectName}`;
  const { error } = await client.storage.from(TEAM_LOGO_BUCKET).upload(filePath, file, {
    cacheControl: '31536000',
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;

  const { data } = client.storage.from(TEAM_LOGO_BUCKET).getPublicUrl(filePath);
  if (!data.publicUrl) throw new Error('Supabase ไม่ได้ส่ง URL ของโลโก้กลับมา');
  return data.publicUrl;
}

async function uploadToCloudinary(file: File | Blob, fileName: string): Promise<string> {
  const client = getSupabaseClient();
  const { data, error } = await client.functions.invoke<unknown>('cloudinary-sign-upload', {
    body: {
      fileName,
      fileSize: file.size,
      mimeType: file.type,
    },
  });
  if (error) throw new Error(`ไม่สามารถขอลายเซ็น Cloudinary ได้: ${error.message}`);
  if (!isCloudinarySignatureResponse(data)) {
    throw new Error('ข้อมูลลายเซ็นจาก Cloudinary Edge Function ไม่ถูกต้อง');
  }

  const formData = new FormData();
  formData.append('file', file, fileName);
  formData.append('api_key', data.apiKey);
  formData.append('timestamp', String(data.timestamp));
  formData.append('signature', data.signature);
  formData.append('folder', data.folder);
  formData.append('overwrite', String(data.overwrite));
  formData.append('public_id', data.publicId);
  formData.append('upload_preset', data.uploadPreset);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(data.cloudName)}/image/upload`,
    { method: 'POST', body: formData },
  );
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(readCloudinaryError(payload) || `Cloudinary upload failed (${response.status})`);
  }
  if (!isCloudinaryUploadResponse(payload)) {
    throw new Error('Cloudinary ไม่ได้ส่ง secure URL ของโลโก้กลับมา');
  }
  return payload.secure_url;
}

export class LogoStorageService {
  static async upload(
    file: File | Blob,
    fileName: string,
    provider: LogoStorageProvider,
  ): Promise<string> {
    validateLogoFile(file);
    if (provider === 'cloudinary') {
      return uploadToCloudinary(file, fileName);
    }
    return uploadToSupabase(file, fileName);
  }
}
