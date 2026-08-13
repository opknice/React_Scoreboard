import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

const MAX_REPLAY_FILE_SIZE = 250 * 1024 * 1024
let activeReplay: { id: string; name: string; mime: string; data: Buffer } | null = null

function getSafeVideoMime(value: string | undefined, name: string): string {
  const extension = path.extname(name).toLowerCase()
  const mimeByExtension: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.m4v': 'video/mp4',
    '.webm': 'video/webm',
    '.mkv': 'video/x-matroska',
  }
  if (mimeByExtension[extension]) return mimeByExtension[extension]

  const mime = value?.split(';', 1)[0].trim()
  return mime && /^video\/[a-z0-9.+-]+$/i.test(mime) ? mime : 'video/mp4'
}

function sendJson(res: import('http').ServerResponse, statusCode: number, body: unknown) {
  const payload = JSON.stringify(body)
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.end(payload)
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'serve-logos',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          // Store one active replay in the local dev server so OBS Browser
          // Source can stream it even when OBS uses a separate browser profile.
          if (req.url === '/api/replay' && req.method === 'POST') {
            const contentLength = Number(req.headers['content-length'] || 0)
            if (contentLength > MAX_REPLAY_FILE_SIZE) {
              sendJson(res, 413, { error: 'Replay file is too large' })
              return
            }

            const chunks: Buffer[] = []
            let totalSize = 0
            let rejected = false

            req.on('data', (chunk: Buffer) => {
              if (rejected) return
              totalSize += chunk.length
              if (totalSize > MAX_REPLAY_FILE_SIZE) {
                rejected = true
                res.statusCode = 413
                res.end('Replay file is too large')
                req.destroy()
                return
              }
              chunks.push(chunk)
            })
            req.on('end', () => {
              if (rejected) return
              const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
              const encodedName = String(req.headers['x-replay-name'] || 'replay.mp4').replace(/[\r\n]/g, '')
              let name = 'replay.mp4'
              try { name = decodeURIComponent(encodedName) || name } catch { /* use fallback */ }
              const mime = getSafeVideoMime(String(req.headers['content-type'] || ''), name)
              activeReplay = { id, name, mime, data: Buffer.concat(chunks) }
              sendJson(res, 200, {
                id,
                name,
                mime,
                size: activeReplay.data.length,
                url: `/api/replay/${id}`,
              })
            })
            req.on('error', () => {
              if (!res.writableEnded) sendJson(res, 400, { error: 'Could not receive replay file' })
            })
            return
          }

          if (req.url === '/api/replay/latest/meta' && req.method === 'GET') {
            if (!activeReplay) {
              sendJson(res, 404, { error: 'No replay loaded' })
              return
            }
            sendJson(res, 200, {
              id: activeReplay.id,
              name: activeReplay.name,
              mime: activeReplay.mime,
              size: activeReplay.data.length,
              url: `/api/replay/${activeReplay.id}`,
            })
            return
          }

          const replayMatch = req.url?.match(/^\/api\/replay\/([A-Za-z0-9_-]+)$/)
          if (replayMatch && req.method === 'GET') {
            if (!activeReplay || activeReplay.id !== replayMatch[1]) {
              res.statusCode = 404
              res.end('Replay not found')
              return
            }

            const data = activeReplay.data
            let start = 0
            let end = data.length - 1
            const range = req.headers.range
            if (range) {
              const match = range.match(/^bytes=(\d*)-(\d*)$/)
              if (match) {
                if (match[1]) start = Number(match[1])
                if (match[2]) end = Number(match[2])
                if (!match[1] && match[2]) start = Math.max(0, data.length - Number(match[2]))
                end = Math.min(end, data.length - 1)
              }
            }

            if (start < 0 || start >= data.length || end < start) {
              res.statusCode = 416
              res.setHeader('Content-Range', `bytes */${data.length}`)
              res.end()
              return
            }

            const isPartial = Boolean(range)
            res.statusCode = isPartial ? 206 : 200
            res.setHeader('Content-Type', activeReplay.mime)
            res.setHeader('Accept-Ranges', 'bytes')
            res.setHeader('Cache-Control', 'no-store')
            res.setHeader('Content-Length', String(end - start + 1))
            if (isPartial) res.setHeader('Content-Range', `bytes ${start}-${end}/${data.length}`)
            res.end(data.subarray(start, end + 1))
            return
          }

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
          next();
        });
      }
    }
  ],
  base: process.env.VERCEL ? '/' : '/React_Scoreboard/',
})
