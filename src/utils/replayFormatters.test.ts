import { describe, it, expect } from 'vitest';
import { formatTime, formatSize, getBrowserVideoMimeType, isVideoFile, isBrowserPlayableVideoFile, findLatestFile } from './replayFormatters';

describe('formatTime', () => {
  it('should format zero seconds as "0:00"', () => {
    expect(formatTime(0)).toBe('0:00');
  });

  it('should format seconds less than a minute with zero-padded seconds', () => {
    expect(formatTime(5)).toBe('0:05');
    expect(formatTime(30)).toBe('0:30');
    expect(formatTime(59)).toBe('0:59');
  });

  it('should format seconds equal to or greater than a minute', () => {
    expect(formatTime(60)).toBe('1:00');
    expect(formatTime(65)).toBe('1:05');
    expect(formatTime(125)).toBe('2:05');
    expect(formatTime(3661)).toBe('61:01');
  });

  it('should handle large time values', () => {
    expect(formatTime(7200)).toBe('120:00');
    expect(formatTime(86400)).toBe('1440:00'); // 24 hours
  });

  it('should handle fractional seconds by flooring', () => {
    expect(formatTime(65.7)).toBe('1:05');
    expect(formatTime(59.999)).toBe('0:59');
  });

  it('should handle edge case: negative numbers', () => {
    expect(formatTime(-1)).toBe('0:00');
    expect(formatTime(-65)).toBe('0:00');
  });

  it('should handle edge case: NaN', () => {
    expect(formatTime(NaN)).toBe('0:00');
  });

  it('should handle edge case: Infinity', () => {
    expect(formatTime(Infinity)).toBe('0:00');
    expect(formatTime(-Infinity)).toBe('0:00');
  });
});

describe('formatSize', () => {
  it('should format 0 bytes as "0 KB"', () => {
    expect(formatSize(0)).toBe('0 KB');
  });

  it('should format bytes less than 1KB as "1 KB" (ceiling)', () => {
    expect(formatSize(1)).toBe('1 KB');
    expect(formatSize(500)).toBe('1 KB');
    expect(formatSize(1023)).toBe('1 KB');
  });

  it('should format bytes in KB range (1024 to 1MB-1)', () => {
    expect(formatSize(1024)).toBe('1 KB');
    expect(formatSize(1536)).toBe('2 KB'); // 1.5 KB rounds up to 2 KB
    expect(formatSize(2048)).toBe('2 KB');
    expect(formatSize(10240)).toBe('10 KB'); // 10 KB exactly
    expect(formatSize(1048575)).toBe('1024 KB'); // Just under 1MB
  });

  it('should format bytes at 1MB boundary and above', () => {
    expect(formatSize(1048576)).toBe('1.0 MB'); // Exactly 1 MB
    expect(formatSize(2097152)).toBe('2.0 MB'); // Exactly 2 MB
    expect(formatSize(52428800)).toBe('50.0 MB'); // 50 MB
  });

  it('should format MB with one decimal place', () => {
    expect(formatSize(1572864)).toBe('1.5 MB'); // 1.5 MB
    expect(formatSize(5242880)).toBe('5.0 MB'); // 5 MB
    expect(formatSize(157286400)).toBe('150.0 MB'); // 150 MB
  });

  it('should handle edge case: negative numbers', () => {
    expect(formatSize(-1)).toBe('0 KB');
    expect(formatSize(-1048576)).toBe('0 KB');
  });

  it('should handle edge case: NaN', () => {
    expect(formatSize(NaN)).toBe('0 KB');
  });

  it('should handle edge case: Infinity', () => {
    expect(formatSize(Infinity)).toBe('0 KB');
    expect(formatSize(-Infinity)).toBe('0 KB');
  });
});

describe('isVideoFile', () => {
  it('should return true for files with video MIME types', () => {
    expect(isVideoFile(new File([], 'test.mp4', { type: 'video/mp4' }))).toBe(true);
    expect(isVideoFile(new File([], 'test.webm', { type: 'video/webm' }))).toBe(true);
    expect(isVideoFile(new File([], 'test.mov', { type: 'video/quicktime' }))).toBe(true);
    expect(isVideoFile(new File([], 'test.avi', { type: 'video/x-msvideo' }))).toBe(true);
  });

  it('should return true for files with valid video extensions (case-insensitive)', () => {
    expect(isVideoFile(new File([], 'test.mp4', { type: '' }))).toBe(true);
    expect(isVideoFile(new File([], 'test.MP4', { type: '' }))).toBe(true);
    expect(isVideoFile(new File([], 'test.webm', { type: '' }))).toBe(true);
    expect(isVideoFile(new File([], 'test.WEBM', { type: '' }))).toBe(true);
    expect(isVideoFile(new File([], 'test.mov', { type: '' }))).toBe(true);
    expect(isVideoFile(new File([], 'test.MOV', { type: '' }))).toBe(true);
    expect(isVideoFile(new File([], 'test.m4v', { type: '' }))).toBe(true);
    expect(isVideoFile(new File([], 'test.M4V', { type: '' }))).toBe(true);
    expect(isVideoFile(new File([], 'test.avi', { type: '' }))).toBe(true);
    expect(isVideoFile(new File([], 'test.AVI', { type: '' }))).toBe(true);
    expect(isVideoFile(new File([], 'test.mkv', { type: '' }))).toBe(true);
    expect(isVideoFile(new File([], 'test.MKV', { type: '' }))).toBe(true);
  });

  it('should return true when both MIME type and extension indicate video', () => {
    expect(isVideoFile(new File([], 'replay.mp4', { type: 'video/mp4' }))).toBe(true);
  });

  it('should return false for non-video files', () => {
    expect(isVideoFile(new File([], 'document.pdf', { type: 'application/pdf' }))).toBe(false);
    expect(isVideoFile(new File([], 'image.jpg', { type: 'image/jpeg' }))).toBe(false);
    expect(isVideoFile(new File([], 'audio.mp3', { type: 'audio/mpeg' }))).toBe(false);
    expect(isVideoFile(new File([], 'text.txt', { type: 'text/plain' }))).toBe(false);
  });

  it('should return false for files without video extension or MIME type', () => {
    expect(isVideoFile(new File([], 'unknown.xyz', { type: '' }))).toBe(false);
    expect(isVideoFile(new File([], 'noextension', { type: '' }))).toBe(false);
  });

  it('should handle files with misleading names', () => {
    // Has video extension but wrong MIME type - should still return true (extension check)
    expect(isVideoFile(new File([], 'fakevideo.mp4', { type: 'text/plain' }))).toBe(true);
    
    // Has non-video extension but video MIME type - should return true (MIME type check)
    expect(isVideoFile(new File([], 'video.xyz', { type: 'video/mp4' }))).toBe(true);
  });

  it('should handle mixed case extensions correctly', () => {
    expect(isVideoFile(new File([], 'Test.Mp4', { type: '' }))).toBe(true);
    expect(isVideoFile(new File([], 'VIDEO.wEbM', { type: '' }))).toBe(true);
  });
});

describe('isBrowserPlayableVideoFile', () => {
  it('should allow formats supported by OBS Chromium playback', () => {
    expect(isBrowserPlayableVideoFile(new File([], 'replay.mp4', { type: '' }))).toBe(true);
    expect(isBrowserPlayableVideoFile(new File([], 'replay.webm', { type: '' }))).toBe(true);
    expect(isBrowserPlayableVideoFile(new File([], 'replay.m4v', { type: '' }))).toBe(true);
    expect(isBrowserPlayableVideoFile(new File([], 'replay.mkv', { type: '' }))).toBe(true);
  });

  it('should reject container formats outside the direct Browser Source path', () => {
    expect(isBrowserPlayableVideoFile(new File([], 'replay.avi', { type: 'video/x-msvideo' }))).toBe(false);
    expect(isBrowserPlayableVideoFile(new File([], 'replay.mov', { type: 'video/quicktime' }))).toBe(false);
  });

  it('should use the container MIME inferred from the extension', () => {
    expect(getBrowserVideoMimeType(new File([], 'replay.mkv', { type: 'video/mp4' }))).toBe('video/x-matroska');
    expect(getBrowserVideoMimeType(new File([], 'replay.webm', { type: '' }))).toBe('video/webm');
  });
});

describe('findLatestFile', () => {
  it('should return null for empty array', () => {
    expect(findLatestFile([])).toBe(null);
  });

  it('should return the only file in a single-file array', () => {
    const file = new File([], 'video1.mp4', { lastModified: 1000 });
    expect(findLatestFile([file])).toBe(file);
  });

  it('should return the file with the latest lastModified timestamp', () => {
    const file1 = new File([], 'video1.mp4', { lastModified: 1000 });
    const file2 = new File([], 'video2.mp4', { lastModified: 3000 });
    const file3 = new File([], 'video3.mp4', { lastModified: 2000 });
    
    expect(findLatestFile([file1, file2, file3])).toBe(file2);
  });

  it('should handle files in any order', () => {
    const oldest = new File([], 'oldest.mp4', { lastModified: 1000 });
    const middle = new File([], 'middle.mp4', { lastModified: 2000 });
    const newest = new File([], 'newest.mp4', { lastModified: 3000 });
    
    // Different orderings should all return newest
    expect(findLatestFile([oldest, middle, newest])).toBe(newest);
    expect(findLatestFile([newest, middle, oldest])).toBe(newest);
    expect(findLatestFile([middle, oldest, newest])).toBe(newest);
  });

  it('should return the first file when all have identical timestamps', () => {
    const file1 = new File([], 'video1.mp4', { lastModified: 1000 });
    const file2 = new File([], 'video2.mp4', { lastModified: 1000 });
    const file3 = new File([], 'video3.mp4', { lastModified: 1000 });
    
    const result = findLatestFile([file1, file2, file3]);
    // Should return one of them (implementation returns first encountered with max timestamp)
    expect([file1, file2, file3]).toContain(result);
    expect(result?.lastModified).toBe(1000);
  });

  it('should handle realistic OBS replay buffer timestamps', () => {
    // Simulating real OBS replay files with millisecond precision
    const replay1 = new File([], 'Replay 2025-01-15 12-30-45.mp4', { lastModified: 1736942445000 });
    const replay2 = new File([], 'Replay 2025-01-15 12-31-20.mp4', { lastModified: 1736942480000 });
    const replay3 = new File([], 'Replay 2025-01-15 12-30-50.mp4', { lastModified: 1736942450000 });
    
    expect(findLatestFile([replay1, replay2, replay3])).toBe(replay2);
  });

  it('should handle large timestamp values', () => {
    const file1 = new File([], 'video1.mp4', { lastModified: Date.now() });
    const file2 = new File([], 'video2.mp4', { lastModified: Date.now() + 10000 });
    
    expect(findLatestFile([file1, file2])).toBe(file2);
  });
});
