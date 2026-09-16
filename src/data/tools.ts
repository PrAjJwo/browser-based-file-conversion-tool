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
  group?: string;
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
    group: 'Image Conversion',
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
    slug: 'jpg-to-heic',
    category: 'image',
    group: 'Image Conversion',
    title: 'JPG to HEIC Converter',
    metaTitle: 'JPG to HEIC Converter — Convert JPG Images to HEIC',
    metaDescription: 'Convert JPG and JPEG images to high-efficiency HEIC format directly in your browser. Fast, 100% private in-browser WebAssembly processing with zero uploads.',
    shortBlurb: 'Convert standard JPG/JPEG images into modern high-efficiency HEIC files right in your browser with complete privacy and zero server uploads.',
    acceptedFiles: '.jpg, .jpeg, image/jpeg',
    acceptedTypesLabel: 'JPG or JPEG images',
    sizeWarningMB: 50,
    sizeCeilingNote: 'Batch conversions over 50 MB total execute in browser device memory. Sequential encoding ensures stability.',
    status: 'active',
    howItWorks: [
      {
        step: 1,
        title: 'Choose or drop JPG images',
        description: 'Select one or more .jpg or .jpeg images from your device, or drag and drop them directly onto the converter.',
      },
      {
        step: 2,
        title: 'Select HEIC quality level',
        description: 'Adjust the quality slider (50% to 100%) to balance file size against visual detail. Default 85% delivers strong compression efficiency.',
      },
      {
        step: 3,
        title: 'Convert and download HEIC files',
        description: 'Download individual converted .heic files or package the entire batch into a convenient ZIP archive.',
      },
    ],
    limitations: [
      'In-browser HEIC encoding requires allocating device RAM to unpack and compress high-resolution pixel data using WebAssembly.',
      'Converting JPG to HEIC cannot restore image quality or details that were already lost during original JPEG compression.',
      'Original EXIF camera metadata and GPS tags are stripped during browser pixel decoding to ensure user privacy.',
      'File size reduction varies: while HEIC is generally more efficient, already heavily-compressed JPGs may see minimal file size reduction.',
      'HEIC format compatibility varies: while modern Apple and Android devices natively support HEIC, some older Windows software and web browsers require dedicated decoders.',
    ],
    faqs: [
      {
        question: 'What is the difference between JPG and HEIC?',
        answer: 'JPG is an established image format widely supported across virtually all devices and browsers. HEIC (High Efficiency Image Container) is a newer format based on HEIF/HEVC compression that often delivers smaller file sizes at comparable visual quality, though it has more limited native compatibility in legacy software.',
      },
      {
        question: 'Will converting JPG to HEIC reduce file size?',
        answer: 'In many cases, yes. HEIC\'s advanced compression algorithms are more efficient than standard JPEG. However, because the original JPG was already compressed, file size reduction varies depending on image complexity, texture, and your chosen quality setting.',
      },
      {
        question: 'Does JPG to HEIC improve image quality?',
        answer: 'No. Converting a JPG to HEIC cannot restore or improve visual quality that was already discarded during the original JPEG compression. The conversion preserves the source pixels as faithfully as possible within the HEIC container.',
      },
      {
        question: 'Will my photo metadata be preserved?',
        answer: 'Browser-side re-encoding normalizes orientation and decodes raw pixels via standard HTML5 canvas APIs, which strips embedded EXIF camera metadata and location tags. This ensures clean privacy when sharing photos online.',
      },
      {
        question: 'Are my JPG photos uploaded anywhere?',
        answer: 'No. All decoding, pixel processing, and HEIC encoding execute 100% locally inside your web browser via client-side WebAssembly. Your photos never leave your device and are never sent to any remote server or cloud service.',
      },
    ],
  },
  {
    slug: 'video-compressor',
    category: 'video',
    title: 'Video Compressor',
    metaTitle: 'Video Compressor — Compress MP4 & MOV Online',
    metaDescription: 'Compress MP4 and MOV videos to a target file size in your browser. Fast, 100% private in-browser WebAssembly processing with zero server uploads.',
    shortBlurb: 'Shrink MP4 and MOV videos under custom target size limits for Discord, WhatsApp, and email without uploading your private footage to any remote server.',
    acceptedFiles: '.mp4, .mov, video/mp4, video/quicktime',
    acceptedTypesLabel: 'MP4 or MOV video',
    sizeWarningMB: 100,
    sizeCeilingNote: 'Large videos over 100 MB execute in browser device memory. For best performance on mobile devices, keep clips under 100 MB.',
    status: 'active',
    howItWorks: [
      {
        step: 1,
        title: 'Choose an MP4 or MOV file',
        description: 'Select a video from your computer or phone, or drag and drop it into the compressor. The file remains entirely on your device.',
      },
      {
        step: 2,
        title: 'Set target size and resolution',
        description: 'Enter your desired target file size in megabytes (e.g. 10 MB, 25 MB) or pick a preset, and optionally adjust output resolution scaling.',
      },
      {
        step: 3,
        title: 'Compress and download MP4',
        description: 'Our local WebAssembly engine calculates the exact bitrate budget, encodes video with H.264 and audio with AAC, and saves your compressed MP4 instantly.',
      },
    ],
    limitations: [
      'Video compression is CPU intensive: Encoding high-definition footage executes directly on your device\'s processor and may take some time depending on video length and hardware performance.',
      'Device memory ceilings: In-browser processing uses local RAM. Large video files or very long clips can consume significant memory, and mobile browsers have lower practical memory limits.',
      'Estimated target file sizes: Output size is derived from bitrate budgets over video duration and container overhead. The resulting size is a close estimate rather than an exact byte count.',
      'Lossy compression trade-offs: Aggressive size reduction lowers video bitrate and can visibly reduce picture quality. Moderate compression targets preserve high visual fidelity.',
      'Input format compatibility: Supported input formats are MP4 and QuickTime MOV. Corrupted video streams, non-standard codecs, or unreadable audio tracks may fail to transcode.',
    ],
    faqs: [
      {
        question: 'How does the video compressor reduce file size?',
        answer: 'The compressor re-encodes your video using the efficient H.264 video codec and AAC audio. It calculates an optimal bitrate budget from your target file size and video duration, reducing the data required per frame while preserving visual clarity.',
      },
      {
        question: 'Can I compress a video to an exact size?',
        answer: 'Target-size compression aims for your requested megabyte budget by calculating required bitrates. While video frame complexity prevents exact byte perfection, our engine includes corrective retry logic to produce output within a small tolerance of your target.',
      },
      {
        question: 'Will video compression reduce quality?',
        answer: 'Yes, video compression is lossy. Setting a realistic target (such as 50% to 70% of the original size) retains clear video, while aggressive targets on long videos force lower bitrates that reduce sharpness and visual detail.',
      },
      {
        question: 'Can I compress MOV to MP4?',
        answer: 'Yes. Apple QuickTime MOV videos are decoded client-side and re-encoded into broadly compatible MP4 files with H.264 video and AAC audio, ready for sharing on any modern device or messaging platform.',
      },
      {
        question: 'Is my video uploaded to a server?',
        answer: 'No. Your video never leaves your browser. All decoding, compression, and MP4 packaging run locally on your device using WebAssembly. No files, logs, or video bytes are transmitted to any remote server.',
      },
    ],
  },
  {
    slug: 'image-to-pdf',
    category: 'pdf',
    title: 'Image to PDF Converter',
    metaTitle: 'Image to PDF Converter — Combine Images into a PDF',
    metaDescription: 'Convert JPG, PNG, and WebP images into a single PDF document in your browser. Fast, 100% private client-side processing with zero server uploads.',
    shortBlurb: 'Combine multiple photos, receipts, or document scans into a clean, well-formatted PDF file without uploading confidential records.',
    acceptedFiles: '.jpg, .jpeg, .png, .webp, .bmp, image/jpeg, image/png, image/webp, image/bmp',
    acceptedTypesLabel: 'JPG, PNG, or WebP images',
    sizeWarningMB: 50,
    sizeCeilingNote: 'You can add multiple photos at once. Large high-resolution batches are processed sequentially in browser memory.',
    status: 'active',
    howItWorks: [
      {
        step: 1,
        title: 'Add your images',
        description: 'Drop one or multiple JPG, PNG, or WebP images into the dropzone. Reorder images up or down to set page sequence.',
      },
      {
        step: 2,
        title: 'Customize layout & margins',
        description: 'Select your preferred page size (A4, US Letter, Legal, or Fit to Image), page orientation (Auto, Portrait, or Landscape), and margin width.',
      },
      {
        step: 3,
        title: 'Generate & download PDF',
        description: 'Our client-side engine generates the multi-page PDF binary in memory and prompts an instant download with zero server uploads.',
      },
    ],
    limitations: [
      'In-browser processing requires allocating client-side device RAM to decode and render each image before embedding it into the PDF document.',
      'Extensive batches (50+ photos) or very large camera images (4K+) consume substantial browser memory; processing is executed sequentially to prevent mobile crashes.',
      'Transparent PNG and WebP images are rendered against a clean solid white background to prevent dark or garbled borders in standard PDF readers.',
      'Image metadata (EXIF tags, GPS coordinates, and camera profiles) is normalized during canvas rendering and is not embedded into PDF streams.',
      'Password protection and digital signature encryption are not currently supported.',
    ],
    faqs: [
      {
        question: 'Can I combine multiple images into one PDF?',
        answer: 'Yes. You can select multiple JPG, PNG, and WebP photos at once. Each image is placed onto its own page in the order you specify.',
      },
      {
        question: 'Can I change the order of pages?',
        answer: 'Yes. Use the Move Up (↑) and Move Down (↓) buttons next to each selected image to arrange them into your exact desired page sequence before generating the PDF.',
      },
      {
        question: 'Which image formats are supported?',
        answer: 'The converter supports standard browser-decodable formats including JPG/JPEG, PNG, WebP, and BMP. Transparent PNG and WebP files are automatically given a clean white backdrop.',
      },
      {
        question: 'Will my images lose quality?',
        answer: 'Images are drawn to high-resolution canvas buffers and compressed into high-quality JPEG streams within the PDF. Original aspect ratios are strictly preserved without stretching or distortion.',
      },
      {
        question: 'Are my images uploaded anywhere?',
        answer: 'No. All image loading, canvas drawing, and PDF binary compilation occur 100% locally inside your web browser. No photos, files, or document contents are ever transmitted to a server.',
      },
    ],
  },
  {
    slug: 'subtitle-converter',
    category: 'pdf',
    title: 'Subtitle Converter',
    metaTitle: 'Subtitle Converter — Convert SRT, VTT & TXT',
    metaDescription: 'Convert SRT, VTT, and TXT subtitle files directly in your browser. Fast, 100% private local conversion with live editing and zero server uploads.',
    shortBlurb: 'Convert subtitles between SRT and WebVTT formats, extract clean plain text transcripts, or edit cues directly in your browser with zero server uploads.',
    acceptedFiles: '.srt, .vtt, .txt, text/vtt, application/x-subrip, text/plain',
    acceptedTypesLabel: 'SRT, VTT, or TXT subtitle files',
    sizeWarningMB: 10,
    sizeCeilingNote: 'Subtitle files are lightweight text files typically under 5 MB.',
    status: 'active',
    howItWorks: [
      {
        step: 1,
        title: 'Select or drop subtitle file',
        description: 'Choose a .srt, .vtt, or .txt file from your device, or drag and drop it into the conversion zone.',
      },
      {
        step: 2,
        title: 'Choose target format & edit cues',
        description: 'Select your preferred output format (VTT, SRT, or TXT), preview the parsed cues, and make any live text edits.',
      },
      {
        step: 3,
        title: 'Convert & download instantly',
        description: 'Generate your converted subtitle file directly in device memory with correct UTF-8 encoding and zero server uploads.',
      },
    ],
    limitations: [
      'Formatting and styling markup may not transfer completely between formats; unsupported tags are sanitized for player compatibility.',
      'WebVTT-specific placement settings (such as line positioning and text alignment) are stripped when exporting to SubRip (SRT).',
      'Plain TXT files lack timecode metadata; valid SRT or VTT timestamps cannot be synthesized automatically from untimed text.',
      'Malformed timestamps or corrupted cue blocks are flagged with actionable warnings and can be corrected in the built-in editor.',
      'UTF-8 is the required text encoding standard; legacy non-UTF-8 character sets may cause corrupted character rendering.',
    ],
    faqs: [
      {
        question: 'What is the difference between SRT and VTT?',
        answer: 'SubRip (.srt) is an older, widely supported subtitle format using commas for milliseconds (HH:MM:SS,mmm) and sequential numbers. WebVTT (.vtt) is the modern web standard developed by the W3C for HTML5 <track> video players, utilizing periods for milliseconds (HH:MM:SS.mmm) and supporting optional cue placement settings.',
      },
      {
        question: 'Can I convert SRT to VTT?',
        answer: 'Yes. Our converter transforms SubRip (.srt) files into standard WebVTT (.vtt) format with a leading WEBVTT header, converted millisecond delimiters, and clean sequential cue separation ready for any HTML5 video player.',
      },
      {
        question: 'Can I convert VTT to SRT?',
        answer: 'Yes. WebVTT (.vtt) files are converted into standard SubRip (.srt) subtitles by re-indexing cue numbers from 1, formatting timestamps with comma millisecond separators, and stripping web-specific cue settings for maximum compatibility with desktop media players like VLC.',
      },
      {
        question: 'Can plain TXT be converted into timed subtitles?',
        answer: 'Plain text files without timing metadata cannot be converted into timed subtitles automatically, because timing cannot be fabricated without speech recognition. However, if your TXT file already contains timestamp arrows (-->), our parser will detect and convert it. You can also extract spoken dialogue from SRT or VTT into a clean TXT transcript.',
      },
      {
        question: 'Are my subtitle files uploaded anywhere?',
        answer: 'No. All file reading, text parsing, format serialization, and downloads happen 100% locally inside your web browser. No subtitle lines, dialogue transcripts, or file metadata are ever transmitted to an external server.',
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
