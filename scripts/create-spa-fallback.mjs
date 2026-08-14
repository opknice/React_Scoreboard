import { copyFile } from 'node:fs/promises';

// GitHub Pages serves 404.html for direct requests to client-side routes.
// Keep it in sync with the production entry point so BrowserRouter can boot.
await copyFile('dist/index.html', 'dist/404.html');
