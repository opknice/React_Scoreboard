/**
 * Centralized Configuration for File Upload Limits and Trial Quotas.
 */

/** Maximum allowed image upload size in Megabytes */
export const MAX_FILE_SIZE_MB = 2;

/** Maximum allowed image upload size in Bytes (2MB) */
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024; // 2,097,152 bytes

/** Maximum image uploads allowed for Free Trial users */
export const FREE_TRIAL_IMAGE_LIMIT = 10;
