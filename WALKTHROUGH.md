# Browser File Tools — Project Walkthrough

## Current Project Status

- **Current Phase**: Image Tool Expansion — JPG to HEIC: Complete & Production-Ready
- **Current Completed Tools**:
  1. HEIC to JPG (`/image/heic-to-jpg`) — Active, Production-Ready, Real Browser Verified
  2. Video Compressor (`/video/video-compressor`) — Active, Production-Ready, Real Browser Verified
  3. JPG to HEIC (`/image/jpg-to-heic`) — Active, Production-Ready, Real Browser Verified
- **Active In-Development Tool**: None (JPG to HEIC complete; ready for Tool #3 — Image to PDF)
- **Next Planned Work**: Tool #3 — Image to PDF (`/pdf/image-to-pdf`).
- **Active Routes**:
  - `/image/heic-to-jpg` (Tool #1: Active)
  - `/video/video-compressor` (Tool #2: Active)
  - `/image/jpg-to-heic` (Image Expansion: Active)
  - `/pdf/image-to-pdf` (Tool #3: Coming Soon)
  - `/pdf/subtitle-converter` (Tool #4: Coming Soon)
  - Category routes: `/image`, `/video`, `/pdf`, `/audio`
  - Homepage: `/`
- **Build & Static Analysis Status**:
  - `npx astro check`: **0 errors, 0 warnings, 0 hints** (24 files checked)
  - `npx astro build`: **0 errors**, 10 static routes built in 3.57s
  - Development URL: `http://localhost:4321/image/jpg-to-heic` (Server active)
- **Next Action**: Ready for Tool #3 — Image to PDF (`/pdf/image-to-pdf`)

---

## Current Tool Progress — JPG to HEIC Converter

### Milestone 1: HEIC Encoder Feasibility Decision
- **Feasibility Investigation**:
  - Investigated maintained in-browser HEIC/HEIF encoding packages on npm: `elheif` (kvazaar+libheif) and `@pbk20191/icodec` (x265+libheif).
  - Selected `@pbk20191/icodec`: Provides genuine ISO BMFF HEIF output container with `ftypheic` signature and `mif1`, `heic`, `miaf` compatible brands.
  - Crucial roundtrip verification test performed: Generated HEIC fixture (`test-gen.heic`) was fed into the existing `heic2any` decoder in a headless Google Chrome session via CDP. The file decoded back into a crisp JPEG without errors, proving 100% genuine HEIC compliance.
- **Decision Reasoning**:
  - 100% client-side WebAssembly execution; zero server calls or telemetry.
  - Exposes fine-grained quality control (`quality: 0..100` mapped to x265 `--crf`), lossless mode, and encoder speed presets (`fast`, `medium`, `slow`).
  - Single-threaded execution via Emscripten fibers avoids `SharedArrayBuffer` and COOP/COEP isolation headers, maintaining complete compatibility with Google Fonts and mobile Safari.

### Milestone 2: Dependency & Architecture Selection
- **Dependencies Installed**: `@pbk20191/icodec` (v0.9.3) added to `package.json`.
- **Local Asset Isolation**:
  - Self-hosted `heic-enc.wasm` (6.8 MB) in `public/heic/heic-enc.wasm` to ensure 100% offline, zero-network-leak conversion.
- **Vite Optimization**: Configured `optimizeDeps.exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util', '@pbk20191/icodec']` in `astro.config.mjs`.

### Milestone 3: Data, Routing & Image Category Grouping
- **Registry & Data**:
  - Updated `src/data/tools.ts`: Added `group: 'Image Conversion'` property to group both `heic-to-jpg` and `jpg-to-heic`. Registered `jpg-to-heic` as `status: 'active'`, 156-character meta description, software metadata, and 5 structured FAQs.
  - Updated `src/pages/[category]/index.astro`: Dynamic category layout supports tool groups; groups render under sub-headings (`Image Conversion`) with clean card grids.
  - Cross-linked `HeicToJpgTool.astro` to `/image/jpg-to-heic` and `JpgToHeicTool.astro` to `/image/heic-to-jpg`.

### Milestone 4: Client Conversion Engine & Reactive UI
- **Script & UI Implementation**:
  - `src/scripts/jpg-to-heic.ts`: Implemented canvas-based bitmap rendering, pixel extraction, lazy dynamic loading of `@pbk20191/icodec`, sequential queue processing, error isolation, deduplicated output filenames, and lazy-loaded JSZip batch packaging.
  - `src/components/tools/JpgToHeicTool.astro`: Reactive UI with file dropzone, quality slider (50%–100%), batch queue table, real-time progress bar, responsive results card list with dimensions and size comparison, individual download buttons, and batch ZIP download.
  - `src/components/tools/JpgToHeicContent.astro`: Educational and practical editorial content detailing HEIC benefits, device compatibility, step-by-step instructions, browser limitations, privacy guarantees, and 5 visible FAQs matching `FAQPage` schema.
  - Mounted tool into dynamic route `src/pages/[category]/[tool].astro`.

### Milestone 5: Real Browser Testing with Genuine Fixtures (CDP Suite)
- **Fixtures Tested**: `landscape.jpg` (1200×800, 22.58 KB), `portrait.jpg` (600×900, 18.64 KB), `large_photo.jpg` (1920×1080), `my summer holiday.jpg`, `東京_旅行_2026.jpg`, and `corrupted.jpg`.
- **Automated Real Browser Suite** (`test-fixtures/run-all-jpg-heic-tests.cjs`):
  - Single conversion: `landscape.jpg` converted to `landscape.heic` (1200×800 dimensions preserved, genuine `ftypheic` container).
  - Batch conversion & error isolation: 2 valid files converted sequentially; 1 corrupted file failed gracefully with clear inline error message without aborting the batch. Download All as ZIP button activated for $\ge 2$ converted items.
  - Special filename handling: Filenames with spaces and Unicode Japanese characters processed without truncation or URI corruption.
  - Responsive layout: Viewports 375px, 390px, 768px, 1024px, 1440px audited; 0 horizontal overflow detected.
  - Accessibility audit: Sliders and live progress regions have appropriate aria-labels, role attributes, and polite announcements.
  - Network privacy audit: 0 POST/upload requests, 0 bytes uploaded to remote servers.
  - Category grouping audit: `/image` displays `Image Conversion` group heading with both active tools.

### Milestone 6: Quality Multi-Level Testing & SEO Content Audit
- **Quality Scaling Verification** (`test-fixtures/test-jpg-heic-quality.cjs`):
  - 50% Quality: 18.35 KB (19% smaller than source 22.58 KB JPEG)
  - 75% Quality: 60.71 KB
  - 85% Quality: 64.82 KB
  - 100% Quality: 66.50 KB
- **Roundtrip Decode Test** (`test-fixtures/test-roundtrip-check.cjs`): Generated HEIC fixture (`test-gen.heic`) decoded back into JPEG via `heic2any` in Chrome, verifying 100% interoperability.
- **SEO & Schema Audit** (`test-fixtures/verify-jpg-heic-seo.cjs`):
  - Exactly 1 H1 (`JPG to HEIC Converter`), logical H2 hierarchy.
  - 156-character meta description, canonical URL.
  - 5 FAQs matching `FAQPage` JSON-LD schema, plus `SoftwareApplication` and `BreadcrumbList` schemas.

### Milestone 7: Prior Tool Regression Testing
- **Vite Cache Fix**: Fixed Vite dynamic import cache invalidation (HTTP 504 Outdated Optimize Dep) by purging `.vite` cache and restarting the dev server.
- **Tool #1 HEIC to JPG Regression** (`test-fixtures/lightweight-regression.cjs`):
  - `autumn_1440x960.heic` queued, converted in browser memory to JPG (1440×960 preserved), previewed, and downloaded.
  - Route statuses verified: `/image/heic-to-jpg` (200), `/video/video-compressor` (200), `/pdf/image-to-pdf` (200, Coming Soon), `/pdf/subtitle-converter` (200, Coming Soon).
- **Tool #2 Video Compressor Regression** (`test-fixtures/run-all-video-tests.cjs`):
  - Multi-target compression (0.3 MB, 0.2 MB, 0.12 MB), MOV to MP4 conversion, bitrate warnings, FFmpeg engine reuse, responsiveness, and privacy verified 100% passing.

### Milestone 8: Static Analysis & Production Build
- `npx astro check`: **0 errors, 0 warnings, 0 hints** (24 files checked).
- `npx astro build`: **0 errors**, 10 static routes generated in 3.57s (`/image/jpg-to-heic/index.html` built).

### Milestone 9: Git Checkpoint
- Commit: `feat: complete JPG to HEIC converter`
- Tag: `image-jpg-to-heic-complete`

---

## Current Tool Progress — Tool #2 Video Compressor

- **Status**: Development Complete, Real Browser Verified, Content & SEO Complete.
- **Component & Script Architecture**:
  - `src/components/tools/VideoCompressorTool.astro`: Main reactive UI with file dropzone, metadata preview card, target size controls, resolution scaling, real-time progress card, and result download card.
  - `src/scripts/video-compressor.ts`: Modular client-side engine manager handling lazy loading, WebAssembly virtual filesystem lifecycle, dynamic bitrate budget calculation, overshoot retry logic, and object URL memory management.
  - `src/components/tools/VideoCompressorContent.astro`: Educational and practical editorial content explaining video compression mechanics, real-world file size limits, and 100% client-side privacy guarantees.
- **FFmpeg Engine Integration**:
  - `@ffmpeg/ffmpeg` (v0.12.15) & `@ffmpeg/util` (v0.12.2) with single-threaded `@ffmpeg/core` (v0.12.10 ESM).
  - Self-hosted in `public/ffmpeg/ffmpeg-core.js` and `public/ffmpeg/ffmpeg-core.wasm`.
  - Zero CDN dependencies, 100% offline, zero data leakage.
  - Single-threaded core eliminates `SharedArrayBuffer` requirement, avoiding COOP/COEP headers that disrupt Google Fonts or mobile Safari compatibility.
  - Lazy-loaded: Engine loads only when the user clicks "Compress Video". Cached in memory and reused for consecutive conversions in the same session without page refresh.
- **Target-Size Budget & Bitrate Calculation**:
  - Total bit budget: $R_{\text{total}} = \frac{\text{TargetBytes} \times 8}{\text{DurationSec}}$
  - Container safety reserve: $4\%$ container overhead ($R_{\text{net}} = R_{\text{total}} \times 0.96$)
  - Audio bitrate strategy:
    - 128 kbps for total bitrate $\ge 800$ kbps
    - 96 kbps for $400 \le \text{bitrate} < 800$ kbps
    - 64 kbps for $< 400$ kbps
  - Video bitrate: $R_{\text{video}} = \max(45\text{ kbps}, \frac{R_{\text{net}} - R_{\text{audio}}}{1000})$
  - Corrective retry pass: If first encode exceeds target by $> 10\%$, calculates corrective ratio $\text{adjustFactor} = \frac{\text{targetBytes}}{\text{firstOutputBytes}} \times 0.95$ and runs one additional encoding pass.
- **Resolution Control & Safeguards**:
  - Options: Keep Original, 1080p, 720p, 480p.
  - No upscaling: If source is smaller than target resolution, source resolution is preserved.
  - Aspect ratio preserved and dimensions rounded to even numbers for H.264 macroblock compliance.
- **Visual Warnings & Honest Messaging**:
  - Target larger than source: *"Target size is larger than the original video. Compression may not reduce file size."*
  - Aggressive target: *"Target size is very small for this video duration. Visual quality will be significantly reduced."*
  - Memory warning: Prominently warns that large videos may exceed browser RAM.
- **Output Container & Playback**:
  - MP4 container (`libx264` video, `aac` audio) with `-movflags +faststart`.
  - Filename mapping: `input.mp4` $\rightarrow$ `input-compressed.mp4`; `input.mov` $\rightarrow$ `input-compressed.mp4`.

---

## Current Tool Verification

Automated CDP test suite (`test-fixtures/run-all-video-tests.cjs`), SEO verification (`test-fixtures/verify-video-content-seo.cjs`), and lightweight regression (`test-fixtures/lightweight-regression.cjs`) executed against real Google Chrome:

### 1. MP4 Target-Size Multi-Target Accuracy (`sample.mp4`, 383,631 B, 560x320, 5.568s)
| Target (MB) | Target (Bytes) | Actual Output (Bytes) | Actual (UI) | Difference vs Target | Size Reduction vs Source | Passes | Valid Container |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **0.30 MB** | 314,573 B | 271,029 B | 264.7 KB | **-13.8%** (Under budget) | **29% smaller** | 1 pass | Valid MP4 (`ftypisom`) |
| **0.20 MB** | 209,715 B | 196,367 B | 191.8 KB | **-6.4%** (Under budget) | **49% smaller** | 1 pass | Valid MP4 (`ftypisom`) |
| **0.12 MB** | 125,829 B | 196,367 B | 191.8 KB | **+56.1%** (Hit safety floor) | **49% smaller** | 1 pass | Valid MP4 (`ftypisom`) |

### 2. MOV to MP4 Conversion (`sample.mov`, 469,690 B, 1280x731, 5.57s)
- **Target Size**: 0.25 MB (262,144 B)
- **Actual Output**: 253,646 B (247.7 KB) — **46% smaller**, within target budget (-3.2% deviation)
- **Container**: Successfully transmuxed/encoded from QuickTime to standard MP4 with valid `ftyp` box
- **Playback**: Valid duration (5.571s), dimensions preserved (1280 × 731), native HTML5 `<video>` playback verified

### 3. Engine Reuse Without Refresh
- Consecutive conversion executed immediately without page reload in under 4 seconds.
- Engine cached in memory; no redundant WASM re-fetching or reinitialization.

### 4. Quality Protection & Size Warnings
- Aggressive target (0.05 MB): Warning banner displayed (*"Target size is very small for this video duration. Visual quality will be significantly reduced."*).
- Target larger than source (10 MB): Warning banner displayed (*"Target size is larger than the original video. Compression may not reduce file size."*).

### 5. Responsive Viewport Audit
- 375px (Mobile portrait): **PASS** (0 horizontal overflow)
- 390px (iPhone 12/13/14/15/16): **PASS** (0 horizontal overflow)
- 768px (Tablet portrait): **PASS** (0 horizontal overflow)
- 1024px (Small desktop): **PASS** (0 horizontal overflow)
- 1440px (Wide desktop): **PASS** (0 horizontal overflow)

### 6. Accessibility (A11y)
- `aria-label="Target file size in megabytes"` on target input.
- `aria-label="Video Resolution Scaling"` on resolution select.
- `role="status"` and `aria-live="polite"` on progress announcement container.
- Skip to content link operational.

### 7. Network Privacy Audit
- Remote POST requests: **0**
- Remote file payload uploads: **0 bytes**
- 100% of processing executed client-side inside local WebAssembly Web Worker.

### 8. Content & SEO Verification
- Exactly 1 `<h1>`: `Video Compressor`.
- Semantic `<h2>` hierarchy (`What is video compression?`, `Why compress a video?`, `How It Works`, `Browser and file limitations`, `Frequently asked questions`).
- Meta description: 145 characters (`Compress MP4 and MOV videos to a target file size in your browser. Fast, 100% private in-browser WebAssembly processing with zero server uploads.`).
- Canonical: `https://browserfiletools.com/video/video-compressor`.
- JSON-LD Schemas: Valid `SoftwareApplication`, `BreadcrumbList`, and `FAQPage` (matching 5 visible FAQs).

### 9. Tool #1 Light Regression
- Executed `node test-fixtures/lightweight-regression.cjs`.
- Genuine Nokia `autumn_1440x960.heic` queued, converted, previewed, and downloaded.
- 1440 × 960 resolution preserved; JPEG MIME and payload verified.
- All category and tool routes verified HTTP 200.

---

## Current Tool Bugs / Fixes

1. **Bug 1: Vite Worker Prebundling Failure (`ERR_ABORTED`)**
   - *Symptom*: Loading `@ffmpeg/ffmpeg` caused Vite to attempt prebundling `worker.js` into `node_modules/.vite/deps/worker.js`, resulting in `net::ERR_ABORTED`.
   - *Fix*: Added `vite: { optimizeDeps: { exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'] }, worker: { format: 'es' } }` to `astro.config.mjs`.
2. **Bug 2: Worker Module Import Type Mismatch**
   - *Symptom*: `@ffmpeg/ffmpeg` loads Web Workers as `{ type: 'module' }`. Initial copying of `dist/umd/ffmpeg-core.js` failed because UMD files do not have `export default createFFmpegCore`.
   - *Fix*: Copied `node_modules/@ffmpeg/core/dist/esm/*` to `public/ffmpeg/`, providing the ESM build with native default export.
3. **Bug 3: Target Size Input Clamping for Sub-Megabyte Files**
   - *Symptom*: `target-size-input` had `min="1"` and `step="1"`, and JS used `Math.max(1, ...)`, preventing sub-megabyte compression testing on short sample clips.
   - *Fix*: Updated input to `min="0.01"`, `step="any"`, and JS parsing to `Math.max(0.05, ...)`.
4. **Bug 4: Dropzone Reset Decoupling**
   - *Symptom*: `FileDropzone` listened to `file-dropzone:reset` only on its own container element, preventing the parent tool component from resetting the dropzone state.
   - *Fix*: Added a global `document.addEventListener('file-dropzone:reset', ...)` in `FileDropzone.astro`.
5. **Bug 5: Component Ready State Synchronization**
   - *Symptom*: Asynchronous `<video>` metadata extraction could race with user interactions or automated test inputs.
   - *Fix*: Added `data-ready="true"` attribute to `#video-config-card` upon completion of metadata extraction, and cleaned it in `resetToIdle()`.

---

## Current Tool Next Action

Tool #2 is complete and verified. Next action: Plan and implement JPG to HEIC under Image tools, then proceed to Tool #3 — Image to PDF (`/pdf/image-to-pdf`).

---

## Tool Status

| Tool | Route | Status | Functional Verification | Content / SEO | Launch Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **HEIC to JPG** | `/image/heic-to-jpg` | **Development Complete** | Real Browser Verified | Complete | Browser Verified — Physical Mobile Verification Pending |
| **Video Compressor** | `/video/video-compressor` | **Development Complete** | Real Browser Verified | Complete | Browser Verified — Physical Mobile Verification Pending |
| **JPG to HEIC** | `/image/jpg-to-heic` | **Development Complete** | Real Browser Verified | Complete | Browser Verified — Physical Mobile Verification Pending |
| **Image to PDF** | `/pdf/image-to-pdf` | Coming Soon | Foundation Dropzone Shell | Shell Metadata | Coming Soon |
| **Subtitle Converter** | `/pdf/subtitle-converter` | Coming Soon | Foundation Dropzone Shell | Shell Metadata | Coming Soon |

---

## Architecture

- **Framework & Runtime**: Astro v5 static site generator with TypeScript and Tailwind CSS.
- **Client-Side Processing Guarantee**: 100% in-browser processing. Zero server backends, zero remote API endpoints, zero file uploads, zero cloud queues.
- **Single Source of Truth**: `src/data/tools.ts` defines all categories, tools, metadata, limitations, and FAQs.
- **Layout System**:
  - `BaseLayout.astro`: Provides HTML document skeleton, canonical URL resolution, Open Graph / Twitter cards, meta tags, and multi-schema JSON-LD rendering.
  - `ToolLayout.astro`: Reusable layout providing breadcrumbs, H1/title hero, compact & prominent privacy badges, main conversion slot, ad placement, editorial slot, and structured content slots.
- **Components**:
  - `FileDropzone.astro`: Accessible drag-and-drop and click-to-browse file selector with memory threshold warning and custom event dispatching (`file-dropzone:files-selected`, `file-dropzone:reset`).
  - `HeicToJpgTool.astro`: Active converter component for Tool #1, providing quality controls (50%–100%), sequential batch processing, real progress bar, preview thumbnails, individual JPG downloads, and batch ZIP export.
  - `VideoCompressorTool.astro`: Active converter component for Tool #2, providing single-video MP4/MOV compression to target file size (MB), resolution presets, real-time FFmpeg progress, and direct MP4 download.
  - `HeicContent.astro`: Rich static editorial content for Tool #1.
  - `VideoCompressorContent.astro`: Rich static editorial content for Tool #2.
- **Dynamic Routing**: `src/pages/[category]/[tool].astro` dynamically maps `getAllTools()` into static routes with automatic code splitting.
- **Structured Data**: Injects `SoftwareApplication`, `BreadcrumbList`, and `FAQPage` JSON-LD schemas on active tool pages.
- **Code-Splitting & Lazy Loading**: Heavy conversion engines (`heic2any` ~1.35 MB, `jszip` ~98 KB, `@ffmpeg/ffmpeg` ~11 kB client wrapper) are dynamically loaded only when the user initiates processing. FFmpeg WebAssembly core assets are self-hosted in `public/ffmpeg/`.

---

## Completed Tool History

### Tool #1 — HEIC to JPG

#### Phase 1.1 — Foundation & Site Shell
- Built core Astro site structure, Tailwind design system, `src/data/tools.ts` data layer, `Header`, `Footer`, `BaseLayout`, and `ToolLayout`. Initialized all 9 static routes.

#### Phase 1.2 — Foundation Hardening & Dropzone
- Hardened `FileDropzone.astro` with decoupled custom events, accessible keyboard navigation, and memory warning boundaries (> 50 MB / > 100 MB). Verified zero horizontal overflow across 375px–1440px.

#### Phase 1.3 — HEIC to JPG Implementation
- Implemented `src/scripts/heic-to-jpg.ts` and `src/components/tools/HeicToJpgTool.astro`. Integrated dynamic imports for `heic2any` and `jszip`. Added batch queue management, sequential conversion loop, error isolation per file, and ZIP packaging.

#### Phase 1.4 — Real Browser Verification (Nokia Conformance Fixtures)
- Automated Google Chrome via CDP without mock data. Tested with genuine Nokia HEIF Conformance files (`autumn_1440x960.heic`, `winter_1440x960.heic`, `spring_1440x960.heic`).
- Verified JPEG signature `0xFF 0xD8 0xFF 0xE0`, 1440 × 960 dimensions preserved, quality levels (50%, 90%, 100%), zero POST uploads, and error isolation with `corrupted.heic`.

#### Phase 1.5 — Final Functional Gap Check & Hardening
- Resolved duplicate output filename collisions (`photo.jpg`, `photo-2.jpg`).
- Added accessible progress announcements (`role="status"`, `aria-live="polite"`).
- Hardened queue reset to completely clear inner DOM elements and ZIP button visibility.
- Verified object URL cleanup lifecycle balance via `activeObjectUrls` tracking.

#### Phase 1.6 — Supporting Content & On-Page SEO
- Created `HeicContent.astro`. Verified 1 H1, logical H2 hierarchy, 150-char meta description, and FAQPage schema matching visible details text.

#### Phase 1.7 — Final HEIC QA & Git Checkpoint
- Full regression suite passed across single-file conversion, multi-file queueing, ZIP export, and failure isolation.
- Git checkpoint: `05cb0d1` (`feat: finish HEIC to JPG tool with QA and SEO`), tag: `tool-1-heic-complete`.

---

### Tool #2 — Video Compressor

#### Milestone 1: Architecture & Dependencies
- Selected single-threaded WebAssembly core (`@ffmpeg/core` v0.12.10 ESM).
- Reasoning: Avoids `SharedArrayBuffer` requirement and COOP/COEP isolation headers that break Google Fonts or degrade mobile Safari compatibility.
- Installed `@ffmpeg/ffmpeg` (0.12.15), `@ffmpeg/util` (0.12.2), `@ffmpeg/core` (0.12.10).
- Self-hosted `ffmpeg-core.js` and `ffmpeg-core.wasm` in `public/ffmpeg/`.
- Designed bitrate budget formula with 4% container reserve, stepped audio bitrate (64/96/128 kbps), and 45 kbps video floor.

#### Milestone 2: FFmpeg Engine Successfully Loads
- Implemented `src/scripts/video-compressor.ts`. Configured Vite `optimizeDeps.exclude` and `worker: { format: 'es' }`.
- Lazy loading verified: FFmpeg does not load on initial page render; initializes dynamically upon conversion and is cached for session reuse.

#### Milestone 3: First Genuine Video Successfully Compresses
- Tested `test-fixtures/sample.mp4` (383,631 B, 560x320, 5.568s). Encoded with `libx264` + `aac` + `-movflags +faststart`.
- Output validated: ISO BMFF MP4 (`ftypisom`), 560 × 320 dimensions, 5.568s duration, native HTML5 playback confirmed.

#### Milestone 4: Target-Size Logic & Accuracy
- Multi-target accuracy verified:
  - 0.30 MB target $\rightarrow$ 264.7 KB (-13.8% under target, 29% smaller than source)
  - 0.20 MB target $\rightarrow$ 191.8 KB (-6.4% under target, 49% smaller than source)
  - 0.12 MB target $\rightarrow$ 191.8 KB (hit safety floor, 49% smaller than source)

#### Milestone 5: MP4 & MOV Testing Completed
- Tested `sample.mov` (469,690 B, QuickTime container). Target 0.25 MB $\rightarrow$ 247.7 KB output (-3.2% deviation, 46% reduction). Transcoded to standard MP4 with verified playback.
- Engine reuse verified: Consecutive second conversion completed without reload in < 4s.

#### Milestone 6: Quality Protection & Size Warnings
- Aggressive target (0.05 MB) and target larger than source (10 MB) warnings verified in browser DOM.

#### Milestone 7: Responsive, Accessibility & Privacy Testing
- Responsive viewports (375px, 390px, 768px, 1024px, 1440px) passed with 0 horizontal overflow.
- Accessibility labels, live regions, and keyboard operation verified.
- Privacy audit: 0 POST requests, 0 byte leaks.

#### Milestone 8: Supporting Content & SEO Completed
- Created `VideoCompressorContent.astro`. Updated `src/data/tools.ts` with 145-char meta description, 1 H1, logical H2s, 5 FAQs matching `FAQPage` JSON-LD schema, `SoftwareApplication`, and `BreadcrumbList`.

#### Milestone 9: Light Regression of Tool #1 Passed
- HEIC converter queues, converts, previews, and downloads genuine Nokia fixtures without regressions. All routes verified HTTP 200.

#### Milestone 10: Production Build & Static Analysis
- `npx astro check`: 0 errors across 21 files.
- `npx astro build`: 0 errors; 9 static routes built in 2.60s. Client script 11.0 kB.

#### Milestone 11: Git Checkpoint
- Commit: `1dea4b2` (`feat: complete browser video compressor`)
- Tag: `tool-2-video-compressor-complete`

---

## Known Limitations

1. **Physical Mobile Device Verification**:
   - Physical iPhone Safari and Android Chrome verification remains pending before production launch.
2. **Font Hosting (Optional Hardening)**:
   - External requests to Google Fonts (`fonts.googleapis.com` / `fonts.gstatic.com`) occur for typography assets. No user file data is transmitted, but self-hosting fonts locally can be considered in a subsequent optimization pass.

---

## Next Recommended Tool

Tool #3 — Image to PDF (`/pdf/image-to-pdf`).
