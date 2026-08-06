import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'serve-logos',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          // Handle React.json download with Content-Disposition header
          if (req.url === '/React.json') {
            const filePath = path.join(__dirname, 'public', 'React.json');
            if (fs.existsSync(filePath)) {
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Content-Disposition', 'attachment; filename="React.json"');
              res.setHeader('Cache-Control', 'no-cache');
              fs.createReadStream(filePath).pipe(res);
              return;
            }
          }

          // Handle /api/logo endpoint for custom logo paths
          if (req.url && req.url.startsWith('/api/logo')) {
            try {
              const url = new URL(req.url, 'http://localhost');
              const customPath = url.searchParams.get('path');
              const fileName = url.searchParams.get('file');

              if (!fileName) {
                res.statusCode = 400;
                res.end('Missing file parameter');
                return;
              }

              // Decode filename
              const decodedFileName = decodeURIComponent(fileName);
              
              // Auto-append .png if no extension
              let finalFileName = decodedFileName;
              const hasExtension = /\.(png|jpe?g|gif|webp|svg)$/i.test(decodedFileName);
              if (!hasExtension) {
                finalFileName = decodedFileName + '.png';
              }
              
              // Security: Validate filename (no path traversal, no absolute paths in filename)
              if (finalFileName.includes('..') || 
                  finalFileName.includes('/') || 
                  finalFileName.includes('\\') ||
                  path.isAbsolute(finalFileName)) {
                res.statusCode = 403;
                res.end('Invalid filename - path traversal or absolute path detected');
                return;
              }

              // Security: Validate file extension
              const ext = path.extname(finalFileName).toLowerCase();
              const allowedExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
              if (!allowedExts.includes(ext)) {
                res.statusCode = 403;
                res.end('Invalid file type');
                return;
              }

              let filePath: string;
              
              if (customPath) {
                // Decode and normalize the custom path
                const decodedPath = decodeURIComponent(customPath);
                // Use custom absolute path
                filePath = path.join(decodedPath, finalFileName);
              } else {
                // Fallback to default logos folder
                filePath = path.join(__dirname, 'logos', finalFileName);
              }

              // Check if file exists
              if (fs.existsSync(filePath)) {
                // Security: Check file size (max 10MB)
                const stats = fs.statSync(filePath);
                if (stats.size > 10 * 1024 * 1024) {
                  res.statusCode = 413;
                  res.end('File too large');
                  return;
                }

                // Set appropriate MIME type
                let mimeType = 'image/png';
                if (ext === '.jpg' || ext === '.jpeg') {
                  mimeType = 'image/jpeg';
                } else if (ext === '.gif') {
                  mimeType = 'image/gif';
                } else if (ext === '.webp') {
                  mimeType = 'image/webp';
                } else if (ext === '.svg') {
                  mimeType = 'image/svg+xml';
                }

                res.setHeader('Content-Type', mimeType);
                res.setHeader('Cache-Control', 'public, max-age=3600');
                fs.createReadStream(filePath).pipe(res);
                return;
              } else {
                res.statusCode = 404;
                res.end('File not found');
                return;
              }
            } catch (error: any) {
              console.error('Error serving logo:', error);
              res.statusCode = 500;
              res.end('Internal server error');
              return;
            }
          }

          // Handle legacy /logos/ endpoint
          if (req.url && req.url.startsWith('/logos/')) {
            const urlPath = req.url.split('?')[0].split('#')[0];
            const fileName = decodeURIComponent(urlPath.substring(7));
            const filePath = path.join(__dirname, 'logos', fileName);
            if (fs.existsSync(filePath)) {
              const ext = path.extname(filePath).toLowerCase();
              let mimeType = 'image/png';
              if (ext === '.jpg' || ext === '.jpeg') {
                mimeType = 'image/jpeg';
              } else if (ext === '.gif') {
                mimeType = 'image/gif';
              } else if (ext === '.webp') {
                mimeType = 'image/webp';
              } else if (ext === '.svg') {
                mimeType = 'image/svg+xml';
              }
              res.setHeader('Content-Type', mimeType);
              fs.createReadStream(filePath).pipe(res);
              return;
            }
          }

          // Handle /api/clips/scan endpoint
          if (req.url && req.url.startsWith('/api/clips/scan')) {
            (async () => {
              try {
                const url = new URL(req.url!, 'http://localhost');
                const dirParam = url.searchParams.get('dir') || path.join(__dirname, 'replays');
                const decodedDir = decodeURIComponent(dirParam);

                if (!fs.existsSync(decodedDir)) {
                  try {
                    await fs.promises.mkdir(decodedDir, { recursive: true });
                  } catch {
                    // Ignore
                  }
                }

                if (fs.existsSync(decodedDir)) {
                  const files = await fs.promises.readdir(decodedDir);
                  const clipFilePromises = files
                    .filter((f) => /\.(mkv|mp4|mov|avi|webm)$/i.test(f))
                    .map(async (f) => {
                      const fullPath = path.join(decodedDir, f);
                      try {
                        const stats = await fs.promises.stat(fullPath);
                        return {
                          id: f,
                          name: f,
                          path: fullPath,
                          size: stats.size,
                          mtime: stats.mtimeMs,
                          formattedDate: new Date(stats.mtimeMs).toLocaleTimeString('th-TH')
                        };
                      } catch {
                        return null;
                      }
                    });

                  const resolvedClips = await Promise.all(clipFilePromises);
                  const clipFiles = resolvedClips
                    .filter((c): c is NonNullable<typeof c> => c !== null)
                    .sort((a, b) => b.mtime - a.mtime);

                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ clips: clipFiles }));
                  return;
                } else {
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ clips: [] }));
                  return;
                }
              } catch (err: any) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: err.message }));
                return;
              }
            })();
            return;
          }

          // Handle /api/video endpoint (Video streaming with HTTP Range headers for seek support)
          if (req.url && req.url.startsWith('/api/video')) {
            (async () => {
              try {
                const url = new URL(req.url!, 'http://localhost');
                const videoPath = url.searchParams.get('path');
                if (!videoPath) {
                  res.statusCode = 400;
                  res.end('Missing path parameter');
                  return;
                }

                let decodedPath = decodeURIComponent(videoPath);
                if (!fs.existsSync(decodedPath)) {
                  res.statusCode = 404;
                  res.end('Video file not found');
                  return;
                }

                // Safely attempt preview cache to avoid Windows File Lock contention with OBS
                const cacheFolder = path.join(__dirname, 'replays', '_preview_cache');
                if (!fs.existsSync(cacheFolder)) {
                  try { fs.mkdirSync(cacheFolder, { recursive: true }); } catch {}
                }

                const originalFileName = path.basename(decodedPath);
                const cachedPath = path.join(cacheFolder, originalFileName);

                let targetPath = decodedPath;

                // Try copying to cache if source modified or cached missing
                let needsCopy = !fs.existsSync(cachedPath);
                if (!needsCopy) {
                  try {
                    const sourceStats = fs.statSync(decodedPath);
                    const cachedStats = fs.statSync(cachedPath);
                    needsCopy = sourceStats.mtimeMs > cachedStats.mtimeMs;
                  } catch {
                    needsCopy = true;
                  }
                }

                if (needsCopy) {
                  // Attempt retry loop for EBUSY
                  let copied = false;
                  for (let attempt = 0; attempt < 3; attempt++) {
                    try {
                      fs.copyFileSync(decodedPath, cachedPath);
                      copied = true;
                      break;
                    } catch {
                      await new Promise((r) => setTimeout(r, 150));
                    }
                  }
                  if (copied) {
                    targetPath = cachedPath;
                  } else if (fs.existsSync(cachedPath)) {
                    targetPath = cachedPath;
                  }
                } else {
                  targetPath = cachedPath;
                }

                if (!fs.existsSync(targetPath)) {
                  targetPath = decodedPath;
                }

                const stat = fs.statSync(targetPath);
                const fileSize = stat.size;
                const range = req.headers.range;

                const ext = path.extname(targetPath).toLowerCase();
                let mimeType = 'video/mp4';
                if (ext === '.mkv') mimeType = 'video/x-matroska';
                else if (ext === '.webm') mimeType = 'video/webm';
                else if (ext === '.mov') mimeType = 'video/quicktime';

                if (range) {
                  const parts = range.replace(/bytes=/, '').split('-');
                  const start = parseInt(parts[0], 10);
                  const end = parts[1] ? Math.min(parseInt(parts[1], 10), fileSize - 1) : fileSize - 1;
                  const chunksize = end - start + 1;
                  const file = fs.createReadStream(targetPath, { start, end });

                  req.on('close', () => { try { file.destroy(); } catch {} });
                  req.on('error', () => { try { file.destroy(); } catch {} });

                  res.writeHead(206, {
                    'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                    'Accept-Ranges': 'bytes',
                    'Content-Length': chunksize,
                    'Content-Type': mimeType,
                    'Cache-Control': 'no-cache',
                  });
                  file.pipe(res);
                  return;
                } else {
                  const file = fs.createReadStream(targetPath);
                  req.on('close', () => { try { file.destroy(); } catch {} });
                  req.on('error', () => { try { file.destroy(); } catch {} });

                  res.writeHead(200, {
                    'Content-Length': fileSize,
                    'Content-Type': mimeType,
                    'Cache-Control': 'no-cache',
                  });
                  file.pipe(res);
                  return;
                }
              } catch (err: any) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: err.message }));
                return;
              }
            })();
            return;
          }

          // Handle FFmpeg endpoints (trim, speed, reverse, thumbnail, standby)
          if (req.method === 'POST' && req.url && req.url.startsWith('/api/ffmpeg/')) {
            let body = '';
            req.on('data', (chunk) => { body += chunk; });
            req.on('end', () => {
              try {
                const data = JSON.parse(body || '{}');
                const ffmpegPath = require('ffmpeg-static');
                const { execFile } = require('child_process');

                if (req.url === '/api/ffmpeg/trim') {
                  const { input, start = 0, duration = 10, output } = data;
                  if (!input || !fs.existsSync(input)) {
                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: 'Input file does not exist' }));
                    return;
                  }

                  const outputPath = output || input.replace(/(\.[^.]+)$/, `_trimmed_${Date.now()}.mp4`);
                  
                  execFile(ffmpegPath, [
                    '-y',
                    '-ss', String(start),
                    '-i', input,
                    '-t', String(duration),
                    '-c', 'copy',
                    outputPath
                  ], (err: any) => {
                    if (err) {
                      execFile(ffmpegPath, [
                        '-y',
                        '-ss', String(start),
                        '-i', input,
                        '-t', String(duration),
                        '-c:v', 'libx264',
                        '-preset', 'ultrafast',
                        '-c:a', 'aac',
                        outputPath
                      ], (err2: any) => {
                        if (err2) {
                          res.statusCode = 500;
                          res.end(JSON.stringify({ error: err2.message }));
                          return;
                        }
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({ outputPath }));
                      });
                      return;
                    }
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ outputPath }));
                  });
                  return;
                }

                if (req.url === '/api/ffmpeg/speed') {
                  const { input, speed = 1.0, output } = data;
                  if (!input || !fs.existsSync(input)) {
                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: 'Input file does not exist' }));
                    return;
                  }

                  const outputPath = output || input.replace(/(\.[^.]+)$/, `_speed_${speed}x_${Date.now()}.mp4`);
                  const pts = 1 / speed;
                  
                  let atempo = '1.0';
                  if (speed === 0.5) atempo = '0.5';
                  else if (speed === 0.25) atempo = '0.5,atempo=0.5';
                  else if (speed === 2.0) atempo = '2.0';

                  execFile(ffmpegPath, [
                    '-y',
                    '-i', input,
                    '-filter_complex', `[0:v]setpts=${pts}*PTS[v];[0:a]atempo=${atempo}[a]`,
                    '-map', '[v]',
                    '-map', '[a]',
                    '-c:v', 'libx264',
                    '-preset', 'ultrafast',
                    outputPath
                  ], (err: any) => {
                    if (err) {
                      res.statusCode = 500;
                      res.end(JSON.stringify({ error: err.message }));
                      return;
                    }
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ outputPath }));
                  });
                  return;
                }

                if (req.url === '/api/ffmpeg/reverse') {
                  const { input, speed = 1.0, output } = data;
                  if (!input || !fs.existsSync(input)) {
                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: 'Input file does not exist' }));
                    return;
                  }

                  const outputPath = output || input.replace(/(\.[^.]+)$/, `_reversed_${Math.abs(speed)}x_${Date.now()}.mp4`);
                  const speedAbs = Math.abs(speed);
                  const pts = 1 / speedAbs;

                  let vf = 'reverse';
                  if (speedAbs !== 1.0) {
                    vf = `reverse,setpts=${pts}*PTS`;
                  }

                  let af = 'areverse';
                  if (speedAbs === 0.5) af = 'areverse,atempo=0.5';
                  else if (speedAbs === 2.0) af = 'areverse,atempo=2.0';

                  execFile(ffmpegPath, [
                    '-y',
                    '-i', input,
                    '-vf', vf,
                    '-af', af,
                    '-c:v', 'libx264',
                    '-preset', 'ultrafast',
                    outputPath
                  ], (err: any) => {
                    if (err) {
                      res.statusCode = 500;
                      res.end(JSON.stringify({ error: err.message }));
                      return;
                    }
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ outputPath }));
                  });
                  return;
                }

                if (req.url === '/api/ffmpeg/thumbnail') {
                  const { input, time = 0.5, output } = data;
                  if (!input || !fs.existsSync(input)) {
                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: 'Input file does not exist' }));
                    return;
                  }

                  const outputPath = output || input.replace(/(\.[^.]+)$/, `_thumb_${Date.now()}.jpg`);

                  execFile(ffmpegPath, [
                    '-y',
                    '-ss', String(time),
                    '-i', input,
                    '-vframes', '1',
                    '-q:v', '2',
                    outputPath
                  ], (err: any) => {
                    if (err) {
                      res.statusCode = 500;
                      res.end(JSON.stringify({ error: err.message }));
                      return;
                    }
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ outputPath }));
                  });
                  return;
                }

                if (req.url === '/api/ffmpeg/standby') {
                  const outputFolder = path.join(__dirname, 'replays');
                  if (!fs.existsSync(outputFolder)) fs.mkdirSync(outputFolder, { recursive: true });
                  const outputPath = path.join(outputFolder, 'standby_loop.mp4');

                  if (fs.existsSync(outputPath)) {
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ outputPath }));
                    return;
                  }

                  execFile(ffmpegPath, [
                    '-y',
                    '-f', 'lavfi',
                    '-i', 'color=c=0x0f172a:s=1280x720:d=5',
                    '-f', 'lavfi',
                    '-i', 'anullsrc=r=44100:cl=stereo',
                    '-vf', "drawtext=text='PLAYINSTANT INSTANT REPLAY STANDBY':fontcolor=white@0.15:fontsize=36:x=(w-text_w)/2:y=(h-text_h)/2",
                    '-c:v', 'libx264',
                    '-preset', 'ultrafast',
                    '-c:a', 'aac',
                    '-shortest',
                    outputPath
                  ], (err: any) => {
                    if (err) {
                      res.statusCode = 500;
                      res.end(JSON.stringify({ error: err.message }));
                      return;
                    }
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ outputPath }));
                  });
                  return;
                }

                res.statusCode = 404;
                res.end(JSON.stringify({ error: 'Endpoint not found' }));
              } catch (e: any) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: e.message }));
              }
            });
            return;
          }

          next();
        });
      }
    }
  ],
  base: process.env.NODE_ENV === 'production' && !process.env.VERCEL ? '/React_Scoreboard/' : '/',
})
