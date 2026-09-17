# PureFile — Owner QA & Testing Guide

Welcome to the **PureFile Quality Assurance Guide**. This document is written specifically for the site owner and non-developers. It explains how to verify that the website and every file converter works properly without needing to read or understand the underlying source code.

---

## 1. Quick Start: The 3 Commands You Need

Open PowerShell or your terminal in the project directory (`browser-based file conversion tools`):

### ⚡ Quick Smoke Test (Takes ~4 seconds)
```powershell
npm run test:smoke
```
* **When to run:** After any minor text, style, or layout edit.
* **What it checks:** Confirms the homepage, all 4 category hubs, and all 9 active converter pages return HTTP 200, have valid page titles, and displays an active dropzone. Also performs one rapid live conversion in headless Chrome.
* **Expected output:** A clean green table showing `ALL TESTS PASSED`.

---

### 🛡️ Pre-Deployment Site Health Check (Takes ~15 seconds)
```powershell
npm run qa
```
* **When to run:** **Always run this command before publishing or deploying changes.**
* **What it checks:**
  1. Runs the quick smoke test suite.
  2. Runs `astro check` (verifies TypeScript types and template markup).
  3. Runs `npm run build` (validates that static production pages build with zero errors).
* **Expected output:** `✔ ALL PRE-DEPLOYMENT HEALTH CHECKS PASSED`.

---

### 🔬 Full Master Verification Suite (Takes ~25 seconds)
```powershell
npm run test:all
```
* **When to run:** Before releasing new converter features or when conducting a full platform health review.
* **What it checks:**
  1. **Route & SEO Verification:** Validates HTTP 200, `<title>`, and `<meta description>` across all 14 pages.
  2. **Real-Browser In-Memory Conversions:** Automates Google Chrome to actually convert files on all 9 active tools.
  3. **Binary Signature Inspection:** Inspects raw output byte headers to guarantee valid binary files (`JPEG`, `PNG`, `WebP`, `HEIC`, `MP4`, `PDF`, `WEBVTT`, `ZIP`).
  4. **Multi-Preset ZIP Archive Check:** Packages social variants into a ZIP and inspects the archive contents.
  5. **Responsive Viewport Audit:** Tests Desktop (1440px), Tablet (768px), and Mobile (390px, 375px) to ensure 0px horizontal overflow.
  6. **Visual Regression Baselines:** Saves fresh PNG screenshots into `qa/screenshots/`.
  7. **Type & Build Validation:** Runs both `astro check` and `npm run build`.

---

## 2. Reading the QA Results

At the end of every test run, you will see a clean, colorized summary table:

```text
============================================================
PureFile Master QA Summary
============================================================
Route & SEO: /                                      PASS
Route & SEO: /image/heic-to-jpg                     PASS
HEIC to JPG Converter                               PASS
JPG to HEIC Converter                               PASS
Image Format Converter                              PASS
Image Resizer                                       PASS
Image Compressor                                    PASS
Social Media Resizer & ZIP Export                   PASS
Video Compressor                                    PASS
Image to PDF Converter                              PASS
Subtitle Converter                                  PASS
Viewport Layout: Mobile iPhone 15 (390px)           PASS
Astro Check (Type Integrity)                        PASS
Production Build (npm run build)                    PASS
------------------------------------------------------------
 ALL TESTS PASSED  (24.81s)

TOTAL:
  ✔ 29 passed
  ✖ 0 failed
```

### If a Test Fails
The system will display an easy-to-read **Failure Diagnostic Block** that tells you exactly which tool broke and where to look:

```text
[#1] Video Compressor
  Test:         WASM Transcoding & MP4 Header
  Expected:     MP4 ISO container header (ftypisom)
  Actual:       Timeout or transcode failure
  Inspect File: src/components/tools/VideoCompressorTool.astro
```

---

## 3. Local Owner QA Dashboard (`/__qa`)

When running the site locally with `npm run dev`, you have access to a visual QA Control Deck:

👉 **URL:** [http://localhost:4321/__qa](http://localhost:4321/__qa)

> [!NOTE]
> **Zero Production Footprint:** This dashboard is powered by a local development server plugin. It is **never** included in the production build output. It only exists while you are running the site locally.

**What the dashboard provides:**
- Direct "Open Tool" launch buttons for all 9 active converters.
- Underlying technology engines for each tool (Canvas, WASM, jsPDF, etc.).
- Fixture pack availability checklist.
- 1-minute manual testing cheat-sheet next to each tool.

---

## 4. Test Fixtures Library (`test-fixtures/`)

All test files are stored in organized subfolders inside `test-fixtures/`:

| Subfolder | Filename | Description | Used For |
| :--- | :--- | :--- | :--- |
| `images/` | `landscape.jpg` | High-res nature photo (1440 × 960) | Image Resizer, Converter, Social Resizer, PDF |
| `images/` | `portrait.jpg` | Vertical sample photo (960 × 1440) | Social Resizer, Image to PDF |
| `images/` | `large_photo.jpg` | Complex photography sample | Image Compressor |
| `images/` | `transparent_badge.png` | PNG with alpha transparency channel | WebP/PNG/JPG Converter |
| `images/` | `sample.webp` | Modern WebP image | Image Format Converter |
| `heic/` | `autumn_1440x960.heic` | Apple iPhone HEIC photo | HEIC to JPG Converter |
| `heic/` | `spring_1440x960.heic` | Secondary HEIC sample | Batch & Reset verification |
| `heic/` | `corrupted.heic` | Intentionally damaged HEIC file | Error handling & recovery testing |
| `video/` | `sample.mp4` | Short H.264 video with audio (374 KB) | Video Compressor |
| `video/` | `sample.mov` | Apple QuickTime MOV file | MOV format detection & transcode |
| `subtitles/`| `sample.srt` | SubRip subtitle file with timecodes | Subtitle Converter (SRT → VTT) |
| `subtitles/`| `sample.vtt` | WebVTT subtitle file | Subtitle Converter (VTT → SRT) |
| `subtitles/`| `unicode.srt` | Multilingual UTF-8 subtitle file | Character encoding verification |
| `pdf/` | `landscape.jpg` & `portrait.jpg` | Image pairing | Multi-page PDF compilation |

---

## 5. Manual Testing Checklist (1–2 Minutes Per Tool)

If you prefer to manually test the tools in your own web browser, use this step-by-step checklist:

### 1. HEIC to JPG (`/image/heic-to-jpg`)
- [ ] Open [http://localhost:4321/image/heic-to-jpg](http://localhost:4321/image/heic-to-jpg).
- [ ] Drag & drop `test-fixtures/heic/autumn_1440x960.heic`.
- [ ] Drag quality slider to `85%` (badge updates to 85%).
- [ ] Click **Convert to JPG**.
- [ ] Instant preview image appears.
- [ ] Click **Download** button → saves `autumn_1440x960.jpg`. Open it to verify image displays clearly.
- [ ] Click **Clear All** → queue and results clear cleanly.

### 2. JPG to HEIC (`/image/jpg-to-heic`)
- [ ] Open [http://localhost:4321/image/jpg-to-heic](http://localhost:4321/image/jpg-to-heic).
- [ ] Drag & drop `test-fixtures/images/landscape.jpg`.
- [ ] Click **Convert to HEIC**.
- [ ] Progress bar finishes and card displays ready state.
- [ ] Click **Download HEIC** → saves `landscape.heic`.

### 3. WebP, PNG & JPG Converter (`/image/image-converter`)
- [ ] Open [http://localhost:4321/image/image-converter](http://localhost:4321/image/image-converter).
- [ ] Drag & drop `test-fixtures/images/transparent_badge.png`.
- [ ] In the format selector, choose **WebP**.
- [ ] Click **Convert Images**.
- [ ] Download output → saves `transparent_badge.webp`.

### 4. Image Resizer (`/image/image-resizer`)
- [ ] Open [http://localhost:4321/image/image-resizer](http://localhost:4321/image/image-resizer).
- [ ] Drag & drop `test-fixtures/images/landscape.jpg`.
- [ ] In the **Width** box, type `500`. Notice that Height automatically computes to `333`.
- [ ] Click **Resize Images**.
- [ ] Result card shows `500 × 333 px`. Click **Download** to save.

### 5. Image Compressor (`/image/image-compressor`)
- [ ] Open [http://localhost:4321/image/image-compressor](http://localhost:4321/image/image-compressor).
- [ ] Drag & drop `test-fixtures/images/large_photo.jpg`.
- [ ] Click the **50% (High Compression)** preset button.
- [ ] Click **Compress Images**.
- [ ] Result shows emerald savings badge (e.g. `~35-40% smaller`). Click **Download**.

### 6. Social Media Image Resizer (`/image/social-resizer`)
- [ ] Open [http://localhost:4321/image/social-resizer](http://localhost:4321/image/social-resizer).
- [ ] Drag & drop `test-fixtures/images/landscape.jpg`.
- [ ] Click on **Instagram — Square Post** preset card.
- [ ] Live preview updates showing the 1:1 square crop.
- [ ] Click **Export Selected Presets (3)**.
- [ ] Three cards appear in the results grid. Click **Download All as ZIP**.
- [ ] Open the downloaded `.zip` file → contains all 3 cropped photos.

### 7. Video Compressor (`/video/video-compressor`)
- [ ] Open [http://localhost:4321/video/video-compressor](http://localhost:4321/video/video-compressor).
- [ ] Drag & drop `test-fixtures/video/sample.mp4`.
- [ ] In Target File Size, enter `0.2` MB.
- [ ] Click **Compress Video**.
- [ ] The WebAssembly engine transcode progress bar runs from 0% to 100%.
- [ ] Result video player appears with reduction statistics. Click **Download Compressed MP4**.

### 8. Image to PDF (`/pdf/image-to-pdf`)
- [ ] Open [http://localhost:4321/pdf/image-to-pdf](http://localhost:4321/pdf/image-to-pdf).
- [ ] Select both `landscape.jpg` and `portrait.jpg`.
- [ ] Set Orientation to **Landscape** and Page Size to **A4**.
- [ ] Click **Convert to PDF**.
- [ ] Result displays `2 Pages`. Click **Download PDF** → opens in your PDF reader.

### 9. Subtitle Converter (`/pdf/subtitle-converter`)
- [ ] Open [http://localhost:4321/pdf/subtitle-converter](http://localhost:4321/pdf/subtitle-converter).
- [ ] Drag & drop `test-fixtures/subtitles/sample.srt`.
- [ ] Subtitle cues appear in the interactive editor textarea.
- [ ] Target format defaults to **WebVTT (.vtt)**.
- [ ] Click **Convert Subtitles**.
- [ ] Click **Download File** → saves `sample.vtt`.

---

## 6. Visual QA Screenshots

The master test suite (`npm run test:all`) automatically saves fresh visual captures to:
- `qa/screenshots/desktop/homepage.png`
- `qa/screenshots/desktop/category-image.png`
- `qa/screenshots/desktop/category-video.png`
- `qa/screenshots/desktop/category-pdf.png`
- `qa/screenshots/mobile/homepage.png`

You can open these image files at any time to visually check how pages render without opening a browser.
