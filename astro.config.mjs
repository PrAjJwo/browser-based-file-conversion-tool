import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

function devQaDashboardPlugin() {
  return {
    name: 'dev-qa-dashboard-plugin',
    configureServer(server) {
      server.middlewares.use('/__qa', (_req, res, next) => {
        try {
          const { generateDashboardHtml } = require('./qa/helpers/dashboard-html.cjs');
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(generateDashboardHtml());
        } catch (err) {
          next(err);
        }
      });
    },
  };
}

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
    plugins: [devQaDashboardPlugin()],
    optimizeDeps: {
      include: ['jspdf', 'jszip'],
      exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util', '@pbk20191/icodec'],
    },
    worker: {
      format: 'es',
    },
  },
});
