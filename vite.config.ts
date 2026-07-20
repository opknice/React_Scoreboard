import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
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
          next();
        });
      }
    }
  ],
  base: process.env.VERCEL ? '/' : '/React_Scoreboard/',
})
