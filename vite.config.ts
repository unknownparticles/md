import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import packageJson from './package.json';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  const pagesBuild = process.env.BUILD_TARGET === 'pages';

  return {
    // Electron loads the production build from file://, so emitted asset URLs
    // must be relative instead of rooted at the web server domain.
    base: './',
    build: pagesBuild
      ? {
        emptyOutDir: false,
        outDir: 'docs',
        rollupOptions: {
          input: path.resolve(__dirname, 'index.html'),
        },
      }
      : undefined,
    plugins: [react(), tailwindcss()],
    define: {
      'import.meta.env.PACKAGE_VERSION': JSON.stringify(packageJson.version),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
