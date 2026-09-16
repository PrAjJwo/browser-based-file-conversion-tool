import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: process.env.SITE_URL || 'https://browserfiletools.com',
  integrations: [
    tailwind({
      applyBaseStyles: false,
    }),
    sitemap(),
  ],
  vite: {
    optimizeDeps: {
      include: ['jspdf', 'jszip'],
      exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util', '@pbk20191/icodec'],
    },
    worker: {
      format: 'es',
    },
  },
});
