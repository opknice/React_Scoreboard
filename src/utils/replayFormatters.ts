/**
 * Utility functions for the Instant Replay system
 * Provides formatting and validation for video files, time display, and file size
 */

/**
 * Format seconds into MM:SS time format
 * 
 * @param seconds - Number of seconds to format
 * @returns Formatted time string in MM:SS format
 * 
 * @example
 * formatTime(0) // "0:00"
 * formatTime(65) // "1:05"
 * formatTime(3661) // "61:01"
 */
export function formatTime(seconds: number): string {
  // Handle edge cases
  if (!isFinite(seconds) || seconds < 0) {
    return "0:00";
  }
  
  const totalSeconds = Math.floor(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  
  // Zero-pad seconds to 2 digits
  const paddedSeconds = remainingSeconds.toString().padStart(2, '0');
  
  return `${minutes}:${paddedSeconds}`;
}

/**
 * Format bytes into human-readable file size (KB or MB)
 * 
 * @param bytes - Number of bytes to format
 * @returns Formatted size string with KB or MB unit
 * 
 * @example
 * formatSize(500) // "1 KB"
 * formatSize(1500) // "1 KB"
 * formatSize(1048576) // "1.0 MB"
 * formatSize(52428800) // "50.0 MB"
 */
export function formatSize(bytes: number): string {
  // Handle edge cases
  if (!isFinite(bytes) || bytes < 0) {
    return "0 KB";
  }
  
  const MB_THRESHOLD = 1048576; // 1024 * 1024
  
  if (bytes >= MB_THRESHOLD) {
    // Display as MB with 1 decimal place
    const mb = bytes / MB_THRESHOLD;
    return `${mb.toFixed(1)} MB`;
  } else {
    // Display as KB, rounded up to nearest KB
    const kb = Math.ceil(bytes / 1024);
    return `${kb} KB`;
  }
}

/**
 * Validate if a file is a video file based on MIME type or file extension
 * 
 * @param file - File object to validate
 * @returns true if the file is a video file, false otherwise
 * 
 * @example
 * isVideoFile(new File([], "video.mp4", { type: "video/mp4" })) // true
 * isVideoFile(new File([], "video.MP4", { type: "" })) // true
 * isVideoFile(new File([], "document.pdf", { type: "application/pdf" })) // false
 */
export function isVideoFile(file: File): boolean {
  // Check MIME type first (most reliable)
  if (file.type && file.type.startsWith('video/')) {
    return true;
  }
  
  // Fall back to extension check (case-insensitive)
  const videoExtensions = /\.(mp4|webm|mov|m4v|avi|mkv)$/i;
  return videoExtensions.test(file.name);
}

/**
 * Find the most recently modified file from an array of files
 * 
 * @param files - Array of File objects to search
 * @returns The file with the latest lastModified timestamp, or null if array is empty
 * 
 * @example
 * const files = [file1, file2, file3];
 * const latest = findLatestFile(files);
 */
export function findLatestFile(files: File[]): File | null {
  if (!files || files.length === 0) {
    return null;
  }
  
  // Find file with maximum lastModified timestamp
  return files.reduce((latest, current) => {
    return current.lastModified > latest.lastModified ? current : latest;
  });
}
