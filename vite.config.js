import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// Plugin to preserve absolute URLs for favicons (required by Google Search)
function preserveAbsoluteFaviconUrls() {
  return {
    name: 'preserve-absolute-favicon-urls',
    transformIndexHtml(html) {
      // Preserve absolute URLs for favicon-related links
      return html.replace(
        /href="\.\/favicons\/(favicon[^"]*|apple-touch-icon[^"]*|site\.webmanifest)"/g,
        'href="https://scarlo.dev/favicons/$1"'
      ).replace(
        /href="\.\/favicon\.ico"/g,
        'href="https://scarlo.dev/favicon.ico"'
      );
    }
  };
}

export default defineConfig({
  base: './',  // Keep this as-is for GitHub Pages

  plugins: [
    react(),
    preserveAbsoluteFaviconUrls()
  ],
  
  server: {
    port: 3000,
    open: true,
    host: true,
    fs: {
      strict: false
    }
  },

  appType: 'mpa',
  
  build: {
  outDir: 'dist',
  assetsDir: 'assets',
  sourcemap: false,
  minify: 'esbuild',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      output: {
        manualChunks: undefined,
        assetFileNames: 'assets/[name].[hash][extname]',
        chunkFileNames: 'assets/[name].[hash].js',
        entryFileNames: 'assets/[name].[hash].js'
      }
    }
  },
  
  preview: {
    port: 4173,
    open: true
  },
  
  envPrefix: 'VITE_'
});