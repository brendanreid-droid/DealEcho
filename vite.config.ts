import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      // SECURITY: never inject API keys via `define` — anything defined here is
      // embedded in the client bundle and readable by anyone. Gemini calls now
      // run server-side in Cloud Functions (see functions/src/reviewModeration.ts).
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
