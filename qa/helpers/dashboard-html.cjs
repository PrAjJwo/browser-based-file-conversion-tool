const { getActiveTools } = require('./routes.cjs');
const { verifyFixtures } = require('../../test-fixtures/index.cjs');

function generateDashboardHtml() {
  const activeTools = getActiveTools();
  const fixtureStatus = verifyFixtures();

  const toolDetails = [
    {
      slug: 'heic-to-jpg',
      engine: 'heic2any (libheif/libde265 Wasm)',
      sampleFile: 'test-fixtures/heic/autumn_1440x960.heic',
      expectedOutput: 'Universal .jpg file, FF D8 FF signature, near-lossless 90%',
      steps: ['Drop autumn_1440x960.heic', 'Adjust slider to 85%', 'Click Convert to JPG', 'Download .jpg and check image'],
    },
    {
      slug: 'jpg-to-heic',
      engine: '@pbk20191/icodec (libheif Wasm)',
      sampleFile: 'test-fixtures/images/landscape.jpg',
      expectedOutput: 'High-efficiency .heic container (ftypheic)',
      steps: ['Drop landscape.jpg', 'Leave quality at 85%', 'Click Convert to HEIC', 'Download .heic container'],
    },
    {
      slug: 'image-converter',
      engine: 'HTML5 Canvas API',
      sampleFile: 'test-fixtures/images/transparent_badge.png',
      expectedOutput: 'Clean WebP/PNG/JPG image with transparency preserved',
      steps: ['Drop transparent_badge.png', 'Select WebP format', 'Click Convert Images', 'Download .webp and verify RIFF..WEBP'],
    },
    {
      slug: 'image-resizer',
      engine: 'HTML5 Canvas 2D Context',
      sampleFile: 'test-fixtures/images/landscape.jpg',
      expectedOutput: 'Scaled dimensions (e.g. 500 × 333 px)',
      steps: ['Drop landscape.jpg', 'Enter Width: 500 (Height auto-adjusts to 333)', 'Click Resize Images', 'Download resized image'],
    },
    {
      slug: 'image-compressor',
      engine: 'Lossy Canvas JPEG/WebP Re-encoder',
      sampleFile: 'test-fixtures/images/large_photo.jpg',
      expectedOutput: 'Compressed image with ~30-50% size reduction',
      steps: ['Drop large_photo.jpg', 'Select 50% or 70% quality preset', 'Click Compress Images', 'Verify emerald savings badge'],
    },
    {
      slug: 'social-resizer',
      engine: 'Multi-Canvas Aspect Ratio Framing',
      sampleFile: 'test-fixtures/images/landscape.jpg',
      expectedOutput: 'Preset cuts (1080×1080 Instagram, etc.) & ZIP pack',
      steps: ['Drop landscape.jpg', 'Preview Instagram Square', 'Click Export Selected Presets', 'Download individual or ZIP archive'],
    },
    {
      slug: 'video-compressor',
      engine: 'ffmpeg.wasm v0.12 (Single-Threaded)',
      sampleFile: 'test-fixtures/video/sample.mp4',
      expectedOutput: 'Target-budgeted MP4 (H.264 / AAC) with ftypisom header',
      steps: ['Drop sample.mp4', 'Input target size: 0.2 MB', 'Click Compress Video', 'Wait for WASM transcode, download MP4'],
    },
    {
      slug: 'image-to-pdf',
      engine: 'jsPDF & HTML5 Canvas',
      sampleFile: 'test-fixtures/images/landscape.jpg & portrait.jpg',
      expectedOutput: 'Multi-page sequenced document (%PDF-1.3)',
      steps: ['Drop 2 photos', 'Select A4 & Landscape', 'Reorder sequence if desired', 'Click Convert to PDF, download PDF'],
    },
    {
      slug: 'subtitle-converter',
      engine: 'Pure Client-Side Subtitle Parser',
      sampleFile: 'test-fixtures/subtitles/sample.srt',
      expectedOutput: 'Standard WebVTT (.vtt) or SubRip (.srt) with valid timecodes',
      steps: ['Drop sample.srt', 'Review/edit cues in live editor', 'Click Convert Subtitles', 'Download .vtt file'],
    },
  ];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PureFile — Owner QA Dashboard</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
  </style>
</head>
<body class="bg-slate-900 text-slate-100 min-h-screen">
  <!-- Top Banner -->
  <header class="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-50">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-sm">
          QA
        </div>
        <div>
          <h1 class="text-base font-bold text-white flex items-center gap-2">
            <span>PureFile Owner QA Control Deck</span>
            <span class="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Local Dev Only</span>
          </h1>
          <p class="text-xs text-slate-400">Zero production footprint • Real-time status & manual test guides</p>
        </div>
      </div>
      <div class="flex items-center gap-2 text-xs">
        <a href="/" target="_blank" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors">
          Open Homepage &rarr;
        </a>
      </div>
    </div>
  </header>

  <main class="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
    <!-- Quick Commands Bar -->
    <section class="p-5 rounded-2xl bg-slate-800/60 border border-slate-700/80 shadow-sm">
      <h2 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Owner Automated QA Commands</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div class="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
          <div class="flex items-center justify-between mb-1">
            <span class="font-bold text-emerald-400 mono">npm run test:smoke</span>
            <span class="text-[10px] text-slate-400">~4 seconds</span>
          </div>
          <p class="text-slate-400 text-[11px]">Quick health check after standard edits. Tests all 14 routes + live conversion sanity.</p>
        </div>
        <div class="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
          <div class="flex items-center justify-between mb-1">
            <span class="font-bold text-cyan-400 mono">npm run test:all</span>
            <span class="text-[10px] text-slate-400">~25 seconds</span>
          </div>
          <p class="text-slate-400 text-[11px]">Comprehensive automated browser audit of all 9 tools, binary headers, ZIPs, and layouts.</p>
        </div>
        <div class="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
          <div class="flex items-center justify-between mb-1">
            <span class="font-bold text-purple-400 mono">npm run qa</span>
            <span class="text-[10px] text-slate-400">~15 seconds</span>
          </div>
          <p class="text-slate-400 text-[11px]">Pre-release health check: smoke tests, Astro TypeScript check, and static build validation.</p>
        </div>
      </div>
    </section>

    <!-- Fixture Status -->
    <section class="p-5 rounded-2xl bg-slate-800/40 border border-slate-700/60">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-xs font-bold uppercase tracking-wider text-slate-400">QA Fixture Pack Status</h2>
        <span class="text-xs ${fixtureStatus.valid ? 'text-emerald-400' : 'text-rose-400'} font-semibold">
          ${fixtureStatus.valid ? '✔ All Fixtures Available' : '✖ Missing Fixtures'}
        </span>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px] mono">
        <div class="p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-300">📁 images/ (5 files)</div>
        <div class="p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-300">📁 heic/ (4 files)</div>
        <div class="p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-300">📁 video/ (2 files)</div>
        <div class="p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-300">📁 subtitles/ (5 files)</div>
        <div class="p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-300">📁 pdf/ (2 files)</div>
      </div>
    </section>

    <!-- Active Converters Directory -->
    <section class="space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-bold text-white uppercase tracking-wider">
          Active Converter Directory (${activeTools.length} Operational Tools)
        </h2>
        <span class="text-xs text-slate-400">Click any tool to launch in a new tab</span>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        ${activeTools
          .map((tool) => {
            const detail = toolDetails.find((d) => d.slug === tool.slug) || {
              engine: 'Browser Engine',
              sampleFile: 'test-fixtures/',
              expectedOutput: 'Clean download',
              steps: ['Upload file', 'Run conversion', 'Download output'],
            };

            return `
          <div class="p-5 rounded-2xl bg-slate-800/80 border border-slate-700 hover:border-slate-600 transition-all flex flex-col justify-between gap-4">
            <div>
              <div class="flex items-center justify-between gap-2 mb-2">
                <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-700 text-slate-300">
                  ${tool.category.toUpperCase()}
                </span>
                <span class="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  Active
                </span>
              </div>

              <h3 class="text-sm font-bold text-white mb-1">
                <a href="${tool.route}" target="_blank" class="hover:text-emerald-400 transition-colors">
                  ${tool.title} &rarr;
                </a>
              </h3>
              <p class="text-[11px] text-slate-400 mb-3 mono">${tool.route}</p>

              <div class="space-y-2 text-[11px] border-t border-slate-700/60 pt-3">
                <div>
                  <span class="text-slate-500 font-medium block">Underlying Engine:</span>
                  <span class="text-slate-300">${detail.engine}</span>
                </div>
                <div>
                  <span class="text-slate-500 font-medium block">Recommended Sample Fixture:</span>
                  <span class="text-slate-300 mono text-[10px] bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 block truncate">
                    ${detail.sampleFile}
                  </span>
                </div>
                <div>
                  <span class="text-slate-500 font-medium block">Expected Output:</span>
                  <span class="text-slate-300">${detail.expectedOutput}</span>
                </div>
              </div>
            </div>

            <div class="border-t border-slate-700/60 pt-3">
              <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">1-Minute Manual Check:</span>
              <ul class="space-y-1 text-[11px] text-slate-300">
                ${detail.steps.map((s) => `<li class="flex items-start gap-1.5"><span class="text-emerald-400">✔</span><span>${s}</span></li>`).join('')}
              </ul>
              <div class="mt-3 pt-2">
                <a
                  href="${tool.route}"
                  target="_blank"
                  class="w-full py-2 px-3 rounded-xl bg-slate-700 hover:bg-emerald-600 hover:text-white text-slate-200 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                >
                  <span>Open Tool in Browser</span>
                  <span>&rarr;</span>
                </a>
              </div>
            </div>
          </div>
        `;
          })
          .join('')}
      </div>
    </section>
  </main>
</body>
</html>`;
}

module.exports = {
  generateDashboardHtml,
};
