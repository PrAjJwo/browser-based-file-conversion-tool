# PureFile — Privacy-First Client-Side File Utilities

> **Instant, secure file conversion that runs 100% in your local browser memory.**  
> Zero server uploads • Zero cloud storage queues • Zero tracking cookies • Free forever.

[![Astro](https://img.shields.io/badge/Astro-5.0-BC52EE?style=flat-square&logo=astro)](https://astro.build)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg?style=flat-square)](LICENSE)

---

## Overview

**PureFile** is a collection of high-performance media and document utilities engineered to run entirely inside client browser threads using **WebAssembly (WASM)**, the **HTML5 Canvas API**, and **modern web standards**. 

Unlike conventional conversion websites that upload your personal documents, screen recordings, and photos to remote cloud server farms, PureFile executes every transformation locally on your device's CPU and GPU. Your files never cross the network.

---

## Active Utilities (9 Converters)

| Category | Utility | Route | Core Engine | Key Capabilities |
| :--- | :--- | :--- | :--- | :--- |
| **Image** | **HEIC to JPG** | `/image/heic-to-jpg` | `heic2any` (libheif WASM) | Apple HEIC/HEIF photos to standard JPEG with quality slider |
| **Image** | **JPG to HEIC** | `/image/jpg-to-heic` | `@pbk20191/icodec` (libheif WASM) | JPEG to high-efficiency ISO container (`ftypheic`) |
| **Image** | **Format Converter** | `/image/image-converter` | HTML5 Canvas | Bidirectional conversion between WebP, PNG, and JPEG |
| **Image** | **Image Resizer** | `/image/image-resizer` | HTML5 Canvas | Exact pixel scaling, percentage presets (25%, 50%, 75%), aspect lock |
| **Image** | **Image Compressor** | `/image/image-compressor` | HTML5 Canvas | Quality presets, byte size reduction reporting, side-by-side comparison |
| **Image** | **Social Media Resizer**| `/image/social-resizer` | Canvas + `JSZip` | 3×3 focal grid framing (Instagram, YouTube, LinkedIn, X) + ZIP export |
| **Video** | **Video Compressor** | `/video/video-compressor`| `ffmpeg.wasm` (H.264 / AAC) | Custom target MB bitrate calculation, 100% on-device transcode |
| **PDF** | **Image to PDF** | `/pdf/image-to-pdf` | `jspdf` | Multi-image compilation, drag reordering, A4/Letter margins |
| **Document**| **Subtitle Converter** | `/pdf/subtitle-converter`| Client-Side Regex Parser | SRT ⇄ VTT conversion, plain text transcript extraction, cue editor |

---

## Technology Stack & Architecture

- **Framework**: [Astro 5](https://astro.build/) (Static Site Generation with zero client-side JavaScript overhead by default)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) with a custom design system tokens (`brand`, `surface`)
- **Execution Sandboxing**:
  - **Video Transcoding**: Single-threaded FFmpeg WASM compiled for web browser memory.
  - **Image Processing**: Native HTML5 Canvas 2D rendering contexts with hardware acceleration.
  - **Archive Generation**: Client-side ZIP packaging via `JSZip`.
  - **Document Generation**: In-memory vector PDF generation via `jsPDF`.
- **Memory Safety**: Systematic revocation of Object URLs (`URL.revokeObjectURL`) to prevent memory leaks during large batch operations.

---

## Getting Started Locally

### Prerequisites
- **Node.js**: v18.0.0 or later (Node 20+ recommended)
- **npm**: v9.0.0 or later

### Installation

```bash
# Clone the repository
git clone https://github.com/PrAjJwo/browser-based-file-conversion-tool.git

# Navigate into the project directory
cd browser-based-file-conversion-tool

# Install dependencies
npm install
```

### Development Server

```bash
# Start local development server on http://localhost:4321
npm run dev
```

Visit `http://localhost:4321` in your browser.

---

## Owner QA & Verification System

PureFile includes an automated Quality Assurance test suite that operates the website and converters in a real, headless Google Chrome instance:

```bash
# 1. Quick Smoke Test (~4 seconds)
# Validates all 14 routes, HTTP 200, SEO tags, and runs an in-memory conversion
npm run test:smoke

# 2. Master Verification Suite (~25 seconds)
# End-to-end automation of all 9 converters, binary signature inspection,
# responsive viewport checks (375px to 1440px), astro check, and production build
npm run test:all

# 3. Pre-Deployment Site Health Check (~15 seconds)
# Runs smoke tests, TypeScript template verification, and static production build
npm run qa
```

### Dev QA Control Deck
When running the development server (`npm run dev`), open:
👉 **`http://localhost:4321/__qa`** to view fixture registries, manual test checklists, and conversion diagnostics. *(This route has zero footprint in production builds).*

---

## Production Build

```bash
# Verify TypeScript & template diagnostics
npx astro check

# Build static production bundle into dist/
npm run build

# Preview production build locally
npm run preview
```

---

## Privacy Policy & Data Architecture

- **Zero Remote Storage**: PureFile has no backend databases, user accounts, or cloud file buckets.
- **Local RAM Only**: Uploaded files exist only in volatile browser memory while the browser tab is active.
- **Zero Telemetry**: No tracking cookies, third-party analytics pixels, or device fingerprinting.

---

## License

Released under the [MIT License](LICENSE). Built for a faster, more private web.
