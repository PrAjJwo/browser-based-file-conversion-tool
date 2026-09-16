export type ToolCategory = 'video' | 'image' | 'audio' | 'pdf';

export interface HowItWorksStep {
  step: number;
  title: string;
  description: string;
}

export interface FAQItem {
  question: string;
  answer: string;
}

export interface Tool {
  slug: string;
  category: ToolCategory;
  title: string;
  metaTitle?: string;
  metaDescription: string;
  shortBlurb: string;
  acceptedFiles: string;
  acceptedTypesLabel: string;
  sizeWarningMB: number;
  sizeCeilingNote: string;
  status: 'coming-soon' | 'active';
  howItWorks: HowItWorksStep[];
  limitations: string[];
  faqs: FAQItem[];
}

export interface CategoryInfo {
  id: ToolCategory;
  name: string;
  shortTitle: string;
  description: string;
  icon: string;
  badge: string;
}

export const CATEGORIES: Record<ToolCategory, CategoryInfo> = {
  image: {
    id: 'image',
    name: 'Image Tools',
    shortTitle: 'Image',
    description: 'Convert, compress, and edit images right in your browser. Powered by HTML5 Canvas & WebAssembly.',
    icon: 'image',
    badge: 'Canvas API & Local Wasm',
  },
  video: {
    id: 'video',
    name: 'Video Tools',
    shortTitle: 'Video',
    description: 'Compress, trim, and convert video files locally. Zero cloud queues, zero server uploads.',
    icon: 'video',
    badge: 'ffmpeg.wasm Client-Side',
  },
  pdf: {
    id: 'pdf',
    name: 'PDF & Document Tools',
    shortTitle: 'PDF',
    description: 'Generate PDFs, convert subtitle formats, and manage documents with client-side libraries.',
    icon: 'pdf',
    badge: 'jsPDF & pdf-lib',
  },
  audio: {
    id: 'audio',
    name: 'Audio Tools',
    shortTitle: 'Audio',
    description: 'Convert, trim, and extract audio tracks privately on your device via Web Audio API.',
    icon: 'audio',
    badge: 'Web Audio & Local Wasm',
  },
};

export const TOOLS: Tool[] = [
  {
    slug: 'heic-to-jpg',
    category: 'image',
    title: 'HEIC to JPG Converter',
    metaTitle: 'HEIC to JPG Converter — Convert HEIC Photos Online',
    metaDescription: 'Convert HEIC and HEIF photos to JPG format directly in your browser. Process single or multiple images locally with complete privacy and zero server uploads.',
    shortBlurb: 'Convert Apple iPhone HEIC and HEIF photos into universally compatible JPGs entirely in your browser with zero data leaving your device.',
    acceptedFiles: '.heic, .heif, image/heic, image/heif',
    acceptedTypesLabel: 'HEIC or HEIF images',
    sizeWarningMB: 50,
    sizeCeilingNote: 'Batch conversions over 50 MB total may use significant browser memory on mobile devices.',
    status: 'active',
    howItWorks: [
      {
        step: 1,
        title: 'Choose or drop HEIC/HEIF files',
        description: 'Select one or more .heic or .heif photos from your device, or drag and drop them directly onto the converter.',
      },
      {
        step: 2,
        title: 'Select JPG quality and convert',
        description: 'Adjust the quality slider (50% to 100%) to balance file size against visual detail, then click Convert to JPG.',
      },
      {
        step: 3,
        title: 'Preview and download JPGs',
        description: 'Review instant image previews and download individual JPGs, or package multiple converted photos into a single ZIP archive.',
      },
    ],
    limitations: [
      'In-browser decoding requires allocating client-side device RAM to unpack compressed image containers into raw pixel buffers.',
      'Large photos (such as 48 MP camera images) and extensive batches consume significant device memory.',
      'Mobile browsers operate with stricter RAM allowances than desktop systems and may reload if pushed past device memory limits.',
      'Processing is performed sequentially to minimize peak memory pressure and ensure system stability.',
      'Conversion speed depends on local device processor capabilities, available browser threads, and source image dimensions.',
      'JPG output can sometimes exceed the file size of the original HEIC because HEIC compression is fundamentally more storage-efficient.',
      'Selecting 100% output quality generates substantially larger JPG files with negligible visible detail improvement.',
      'Damaged, incomplete, or corrupted HEIC/HEIF files will be safely isolated and flagged as failed without interrupting the remaining batch.',
      'Niche proprietary camera RAW profiles or non-standard HEIF container variations may not be supported by browser decoding libraries.',
    ],
    faqs: [
      {
        question: 'What is a HEIC file?',
        answer: 'HEIC (High Efficiency Image Container) is an image format based on the HEIF standard. It stores high-resolution image data at roughly half the file size of older JPEG files while supporting features like 16-bit color depth and auxiliary depth maps.',
      },
      {
        question: 'Why does my iPhone save photos as HEIC?',
        answer: 'Apple adopted HEIC as the default camera format in iOS to save device and iCloud storage. Because HEIC compresses images more efficiently than standard JPEG without visible quality loss, you can store significantly more photos in the same space.',
      },
      {
        question: 'Will converting HEIC to JPG reduce image quality?',
        answer: 'JPEG uses lossy compression, but converting at the default 90% quality setting yields near-lossless results that are virtually indistinguishable from the original image. Lower settings reduce file size further, while higher settings preserve fine detail.',
      },
      {
        question: 'Why is my JPG larger than the original HEIC?',
        answer: 'HEIC uses modern, highly advanced compression technology that is substantially more efficient than the legacy JPEG standard. Re-encoding high-resolution pixel data into standard JPG often requires more bytes to store the same visual information.',
      },
      {
        question: 'Are my HEIC photos uploaded anywhere?',
        answer: 'No. Your photos are never transmitted over the internet or uploaded to any server. All decoding and JPG encoding execute 100% locally inside your web browser. Your files never leave your device.',
      },
    ],
  },
  {
    slug: 'video-compressor',
    category: 'video',
    title: 'In-Browser Video Compressor',
    metaDescription: 'Compress MP4, MOV, and WebM videos directly in your browser to meet Discord, WhatsApp, and email size limits. No server uploads.',
    shortBlurb: 'Shrink MP4 and MOV videos under size limits for Discord, WhatsApp, and email without uploading your private footage to any remote server.',
    acceptedFiles: '.mp4, .mov, .webm, .mkv, video/*',
    acceptedTypesLabel: 'MP4, MOV, or WebM videos',
    sizeWarningMB: 100,
    sizeCeilingNote: 'In-browser WebAssembly memory struggles past roughly 100 MB on mobile browsers. For best results on mobile, keep clips under 100 MB.',
    status: 'coming-soon',
    howItWorks: [
      {
        step: 1,
        title: 'Select your video clip',
        description: 'Choose any MP4, MOV, or WebM file from your local storage. The file stays completely on your computer or phone.',
      },
      {
        step: 2,
        title: 'Select target size or preset',
        description: 'Pick quick targets such as "Under 25 MB for Discord", "Under 16 MB for WhatsApp", or a custom bitrate/resolution.',
      },
      {
        step: 3,
        title: 'In-browser transcoding',
        description: 'FFmpeg WebAssembly processes the audio and video streams using your computer\'s CPU cores directly inside the browser sandbox.',
      },
    ],
    limitations: [
      'ffmpeg.wasm utilizes browser WebAssembly memory limits (typically 2 GB to 4 GB maximum). Processing videos over 100 MB on mobile devices can cause tab termination.',
      'Client-side video compression speed depends heavily on your local CPU performance rather than server GPU farms.',
      'Hardware-accelerated H.265/AV1 encode is subject to browser WebCodecs API availability.',
    ],
    faqs: [
      {
        question: 'Is my video sent to an external server or cloud queue?',
        answer: 'No. Traditional converters force you to upload large video files to their server queue. Browser File Tools executes ffmpeg locally inside your browser sandbox.',
      },
      {
        question: 'What is the maximum file size I can compress?',
        answer: 'On desktop browsers (Chrome, Edge, Firefox), files up to 250 MB generally compress without issue. On mobile devices, we recommend files under 100 MB due to mobile RAM constraints.',
      },
      {
        question: 'How do I compress a video specifically for Discord or email?',
        answer: 'Select the "Discord (25 MB)" or "Email (20 MB)" preset before starting. The tool calculates the exact bitrate needed so the output is guaranteed to fit.',
      },
    ],
  },
  {
    slug: 'image-to-pdf',
    category: 'pdf',
    title: 'Image to PDF Converter',
    metaDescription: 'Merge multiple JPG, PNG, and WebP images into a single clean PDF document entirely in your browser. Fast, free, and completely private.',
    shortBlurb: 'Combine multiple photos, receipts, or document scans into a clean, well-formatted PDF file without uploading confidential records.',
    acceptedFiles: '.jpg, .jpeg, .png, .webp, .bmp, image/*',
    acceptedTypesLabel: 'JPG, PNG, WebP, or BMP images',
    sizeWarningMB: 100,
    sizeCeilingNote: 'You can add up to 50 photos at once. Large high-res batches are paginated locally.',
    status: 'coming-soon',
    howItWorks: [
      {
        step: 1,
        title: 'Add your images',
        description: 'Drop one or multiple photos, screenshots, or receipts into the dropzone. Reorder pages as needed.',
      },
      {
        step: 2,
        title: 'Customize layout & margins',
        description: 'Select page orientation (Portrait, Landscape, or Auto-fit), margins, and page sizes (A4, US Letter, or Fit-to-Image).',
      },
      {
        step: 3,
        title: 'Generate instant PDF',
        description: 'Our client-side engine generates the PDF binary in memory and prompts an instant download. Zero server requests.',
      },
    ],
    limitations: [
      'Very large batches (100+ images) may consume substantial browser RAM while generating the preview thumbnails.',
      'Password-encrypted output PDFs will be supported in a future update.',
    ],
    faqs: [
      {
        question: 'Is it safe to convert private documents like passports or IDs?',
        answer: 'Yes, this is the safest way to convert sensitive documents. Because the conversion runs 100% inside your browser, no person or server ever has access to your files.',
      },
      {
        question: 'Can I combine different image formats into one PDF?',
        answer: 'Yes. You can freely combine JPG, PNG, and WebP images in the same document and arrange their order before generating the PDF.',
      },
      {
        question: 'Does this tool add any watermarks to my PDF?',
        answer: 'No. All generated PDFs are completely clean, watermark-free, and high resolution.',
      },
    ],
  },
  {
    slug: 'subtitle-converter',
    category: 'pdf',
    title: 'Subtitle Converter (SRT, VTT, TXT)',
    metaDescription: 'Convert between SRT, VTT, and plain text subtitle formats in your browser. Clean timestamps, shift offset timings, and export instantly.',
    shortBlurb: 'Convert subtitles between SRT and VTT formats, strip timestamps for plain text transcripts, or adjust time offsets directly in your browser.',
    acceptedFiles: '.srt, .vtt, .txt, .sub, text/plain',
    acceptedTypesLabel: 'SRT, VTT, or TXT subtitle files',
    sizeWarningMB: 10,
    sizeCeilingNote: 'Subtitle files are typically lightweight text files under 5 MB.',
    status: 'coming-soon',
    howItWorks: [
      {
        step: 1,
        title: 'Upload your subtitle file',
        description: 'Drop your .srt or .vtt file into the conversion area.',
      },
      {
        step: 2,
        title: 'Choose target format',
        description: 'Select whether to convert SRT to VTT for HTML5 video, VTT to SRT for media players, or strip timecodes for text transcript extraction.',
      },
      {
        step: 3,
        title: 'Download converted subtitles',
        description: 'Instantly download your converted file with perfectly formatted cues and character encodings preserved.',
      },
    ],
    limitations: [
      'Complex multi-color ASS/SSA styling tags may be converted to plain text formatting depending on target format.',
      'Ensure files are encoded in UTF-8 or standard UTF-16 for accurate non-Latin character rendering.',
    ],
    faqs: [
      {
        question: 'Why do HTML5 web video players require VTT instead of SRT?',
        answer: 'WebVTT (.vtt) is the standardized subtitle format developed by the W3C for the HTML5 <track> element, whereas SRT (.srt) is a legacy SubRip format.',
      },
      {
        question: 'Can I extract just the spoken words without timestamps?',
        answer: 'Yes! Select the "Plain Text (.txt)" export option, and all timecodes, cue numbers, and styling markers will be stripped cleanly.',
      },
      {
        question: 'Are my subtitle scripts private?',
        answer: 'Yes. The parser executes locally in JavaScript on your device, ensuring unreleased video scripts or confidential meeting transcripts remain 100% confidential.',
      },
    ],
  },
];

// Helper functions for easy querying
export function getAllTools(): Tool[] {
  return TOOLS;
}

export function getToolsByCategory(category: ToolCategory): Tool[] {
  return TOOLS.filter((tool) => tool.category === category);
}

export function getToolBySlug(category: ToolCategory, slug: string): Tool | undefined {
  return TOOLS.find((tool) => tool.category === category && tool.slug === slug);
}

export function getAllCategories(): CategoryInfo[] {
  return Object.values(CATEGORIES);
}

export function getCategoryInfo(category: ToolCategory): CategoryInfo {
  return CATEGORIES[category];
}
