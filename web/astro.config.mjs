import { fileURLToPath } from 'node:url';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

const edition = process.env.PUBLIC_EDITION === 'irn' ? 'irn' : 'glb';
const outDir =
  process.env.ASTRO_OUT_DIR || (edition === 'irn' ? './dist-irn' : './dist-glb');
const site = edition === 'irn' ? 'https://sanjia.ir' : 'https://mockza.com';

export default defineConfig({
  output: 'static',
  outDir,
  site,
  integrations: [
    react(),
    sitemap({
      filter: (page) => !new URL(page).pathname.startsWith('/app'),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
    build: {
      rollupOptions: {
        output: {
          experimentalMinChunkSize: 10_000,
        },
      },
    },
    define: {
      'import.meta.env.PUBLIC_EDITION': JSON.stringify(edition),
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        '@@edition-fonts.css': fileURLToPath(
          new URL(
            edition === 'irn' ? './src/styles/irn-fonts.css' : './src/styles/empty-fonts.css',
            import.meta.url,
          ),
        ),
      },
    },
  },
});
