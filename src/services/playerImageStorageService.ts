import { getSupabaseClient } from '../config/supabaseClient';

export const PLAYER_IMAGE_MAX_FILE_SIZE_BYTES = 500 * 1024;
export const PLAYER_IMAGE_MAX_FILE_SIZE_KB = 500;
const PLAYER_IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

export interface PlayerImageUploadResult {
  secureUrl: string;
  publicId: string;
  isUnlimited: boolean;
  remainingQuota: number | null;
}

interface PlayerImageUploadResponse {
  secureUrl?: unknown;
  publicId?: unknown;
  isUnlimited?: unknown;
  remainingQuota?: unknown;
}

function isPlayerImageUploadResponse(value: unknown): value is PlayerImageUploadResponse {
  if (typeof value !== 'object' || value === null) return false;
  const response = value as PlayerImageUploadResponse;
  return typeof response.secureUrl === 'string'
    && response.secureUrl.startsWith('https://')
    && typeof response.publicId === 'string'
    && typeof response.isUnlimited === 'boolean'
    && (response.remainingQuota === null || typeof response.remainingQuota === 'number');
}

export function validatePlayerImageFile(file: File | Blob): void {
  if (!PLAYER_IMAGE_MIME_TYPES.has(file.type)) {
    throw new Error('รองรับเฉพาะไฟล์ PNG, JPG, WebP และ GIF เท่านั้น');
  }
  if (file.size <= 0) throw new Error('ไฟล์รูปนักเตะว่างเปล่า');
  if (file.size > PLAYER_IMAGE_MAX_FILE_SIZE_BYTES) {
    throw new Error(`ไฟล์รูปนักเตะต้องมีขนาดไม่เกิน ${PLAYER_IMAGE_MAX_FILE_SIZE_KB}KB`);
  }
}

export async function uploadPlayerImage(file: File): Promise<PlayerImageUploadResult> {
  validatePlayerImageFile(file);
  const formData = new FormData();
  formData.append('file', file, file.name);
  const { data, error } = await getSupabaseClient().functions.invoke<unknown>('cloudinary-player-upload', {
    body: formData,
  });
  if (error) throw new Error(`อัปโหลดรูปนักเตะไม่สำเร็จ: ${error.message}`);
  if (!isPlayerImageUploadResponse(data)) throw new Error('ข้อมูลตอบกลับจาก Cloudinary ไม่ถูกต้อง');
  return {
    secureUrl: data.secureUrl as string,
    publicId: data.publicId as string,
    isUnlimited: data.isUnlimited as boolean,
    remainingQuota: data.remainingQuota as number | null,
  };
}

export async function deletePlayerImage(publicId: string | null | undefined): Promise<void> {
  if (!publicId) return;
  const { error } = await getSupabaseClient().functions.invoke('cloudinary-player-delete', {
    body: { publicId },
  });
  if (error) throw new Error(`ลบรูปนักเตะจาก Cloudinary ไม่สำเร็จ: ${error.message}`);
}
