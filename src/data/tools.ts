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
    slug: 'image-converter',
    category: 'image',
    group: 'Image Conversion',
    title: 'WebP, PNG & JPG Converter',
    metaTitle: 'WebP, PNG & JPG Converter — Convert Image Formats',
    metaDescription: 'Convert JPG, PNG, and WebP images directly in your browser. Batch convert image formats with custom quality settings, full privacy, and zero server uploads.',
    shortBlurb: 'Convert JPG, PNG, and WebP images directly in your browser with custom quality settings, full transparency handling, and complete privacy.',
    acceptedFiles: '.jpg, .jpeg, .png, .webp, image/jpeg, image/png, image/webp',
    acceptedTypesLabel: 'JPG, PNG, or WebP images',
    sizeWarningMB: 50,
    sizeCeilingNote: 'Batch processing large photos may consume significant browser memory on mobile devices.',
    status: 'active',
    howItWorks: [
      {
        step: 1,
        title: 'Choose or drop images',
        description: 'Select one or more JPG, PNG, or WebP images from your device, or drag and drop them into the converter.',
      },
      {
        step: 2,
        title: 'Select output format and quality',
        description: 'Choose your target format (JPG, PNG, or WebP) and adjust quality for lossy formats. Transparency is automatically composited cleanly on white for JPGs.',
      },
      {
        step: 3,
        title: 'Convert and download',
        description: 'Process images instantly in device memory, then download individually or package the entire batch into a single ZIP archive.',
      },
    ],
    limitations: [
      'In-browser format conversion decodes raw uncompressed pixel bitmaps into client device RAM; very large images or extensive batches may cause memory pressure on mobile devices.',
      'When converting transparent PNG or WebP images to JPG, transparent areas are automatically flattened onto a solid white background because JPEG does not support transparency.',
      'PNG export uses lossless compression and does not support lossy quality factor adjustments.',
      'EXIF camera metadata, color profiles, and location tags are stripped during browser canvas re-encoding.',
      'Converting a lossy image (such as JPG) to a lossless format (such as PNG) preserves visual fidelity but cannot restore details discarded during the original compression.',
    ],
    faqs: [
      {
        question: 'What is the difference between JPG, PNG and WebP?',
        answer: 'JPG is a lossy format ideal for photos where small file sizes are preferred over pixel perfection. PNG is a lossless format that preserves crisp graphics and transparent backgrounds, often with larger file sizes. WebP is a modern format developed by Google that offers both lossy and lossless compression with transparency support, typically yielding 25% to 35% smaller file sizes than comparable JPGs or PNGs.',
      },
      {
        question: 'Can I convert PNG with transparency to JPG?',
        answer: 'Yes, but because the JPEG specification does not support an alpha transparency channel, transparent pixels are automatically composited onto a solid white background (#FFFFFF) to prevent dark borders or black backgrounds.',
      },
      {
        question: 'Does converting an image reduce quality?',
        answer: 'Converting between lossless formats (e.g. transparent PNG to lossless WebP) or to high-quality settings preserves visual fidelity. When converting to JPG or lossy WebP, subtle color variations are discarded to reduce file size. At the default 90% quality setting, visual degradation is virtually imperceptible.',
      },
      {
        question: 'Can I convert multiple images at once?',
        answer: 'Yes. You can select multiple JPG, PNG, and WebP files simultaneously. The converter processes images sequentially in local device memory to ensure system stability, and automatically offers a "Download All as ZIP" option when two or more files are completed.',
      },
      {
        question: 'Are my images uploaded anywhere?',
        answer: 'No. All image loading, canvas drawing, pixel compositing, and format re-encoding execute 100% locally inside your web browser. Zero image bytes, filenames, or metadata are ever transmitted across the internet.',
      },
    ],
  },
  {
    slug: 'image-resizer',
    category: 'image',
    group: 'Resize & Compress',
    title: 'Image Resizer',
    metaTitle: 'Image Resizer — Resize JPG, PNG & WebP Images',
    metaDescription: 'Resize JPG, PNG, and WebP images by exact pixel dimensions or percentage directly in your browser. Fast, 100% private local processing with zero server uploads.',
    shortBlurb: 'Resize JPG, PNG, and WebP images by exact pixel dimensions or percentage directly in your browser with complete privacy and zero server uploads.',
    acceptedFiles: '.jpg, .jpeg, .png, .webp, image/jpeg, image/png, image/webp',
    acceptedTypesLabel: 'JPG, PNG, or WebP images',
    sizeWarningMB: 50,
    sizeCeilingNote: 'Batch processing large photos may consume significant browser memory on mobile devices.',
    status: 'active',
    howItWorks: [
      {
        step: 1,
        title: 'Choose or drop images',
        description: 'Select one or more JPG, PNG, or WebP images from your device, or drag and drop them into the resize area.',
      },
      {
        step: 2,
        title: 'Set dimensions or percentage',
        description: 'Specify target width and height with aspect-ratio lock, or choose a percentage scaling factor and select your output format.',
      },
      {
        step: 3,
        title: 'Resize and download',
        description: 'Process single images or full batches instantly in device memory, then download individually or package into a ZIP archive.',
      },
    ],
    limitations: [
      'In-browser resizing decodes full uncompressed pixel bitmaps into client device RAM; very large batches or 48 MP+ camera images may cause memory pressure on mobile devices.',
      'Upscaling images beyond 100% does not recreate lost camera detail and may result in softer or blurred images.',
      'When converting transparent PNG or WebP images to JPG, transparent areas are automatically flattened onto a solid white background because JPEG lacks alpha support.',
      'PNG export uses lossless compression and does not support lossy quality factor adjustments.',
      'Animated WebP and GIF animations are resized to their first frame when exported to static canvas targets.',
    ],
    faqs: [
      {
        question: 'Can I resize multiple images at once?',
        answer: 'Yes. You can select multiple JPG, PNG, and WebP photos at once. Batch resizing processes images sequentially in your browser, and you can download all resized files as a single ZIP archive.',
      },
      {
        question: 'How do I resize without stretching the image?',
        answer: 'Keep the "Lock aspect ratio" toggle enabled. When you enter a new width, the height is automatically calculated based on the original image proportions (and vice versa) to prevent stretching or distortion.',
      },
      {
        question: 'Does resizing reduce image quality?',
        answer: 'Downscaling an image reduces pixel dimensions while preserving high visual sharpness using bicubic canvas smoothing. Upscaling beyond 100% enlarges existing pixels and does not add new detail. For JPG and WebP, you can adjust the quality slider between 50% and 100%.',
      },
      {
        question: 'Can I resize PNG and WebP images?',
        answer: 'Yes. The resizer fully supports PNG and WebP formats. Transparency channels are preserved when exporting to PNG or WebP, and transparent areas are cleanly composited on white when converting to JPG.',
      },
      {
        question: 'Are my images uploaded anywhere?',
        answer: 'No. All image loading, canvas scaling, and file compression execute 100% locally inside your web browser using HTML5 Canvas APIs. No images or files are ever sent to an external server.',
      },
    ],
  },
  {
    slug: 'image-compressor',
    category: 'image',
    group: 'Resize & Compress',
    title: 'Image Compressor',
    metaTitle: 'Image Compressor — Compress JPG, PNG & WebP Images',
    metaDescription: 'Compress JPG, PNG, and WebP images directly in your browser. Reduce file sizes with customizable quality settings, batch processing, and zero server uploads.',
    shortBlurb: 'Compress JPG, PNG, and WebP images directly in your browser with customizable quality settings, batch processing, and 100% private local processing.',
    acceptedFiles: '.jpg, .jpeg, .png, .webp, image/jpeg, image/png, image/webp',
    acceptedTypesLabel: 'JPG, PNG, or WebP images',
    sizeWarningMB: 50,
    sizeCeilingNote: 'Batch processing large photos may consume significant browser memory on mobile devices.',
    status: 'active',
    howItWorks: [
      {
        step: 1,
        title: 'Choose or drop images',
        description: 'Select one or more JPG, PNG, or WebP images from your device, or drag and drop them into the compressor.',
      },
      {
        step: 2,
        title: 'Choose quality or format',
        description: 'Set your preferred compression quality (10% to 100%) or select an output format such as WebP for optimal size reduction.',
      },
      {
        step: 3,
        title: 'Compress and download',
        description: 'Process single photos or full batches locally in memory, then download individually or package into a ZIP archive.',
      },
    ],
    limitations: [
      'In-browser compression decodes source images into device RAM; large batches of 48 MP+ camera images may cause memory pressure on mobile devices.',
      'PNG compression uses lossless encoding; converting photographic PNGs to WebP or JPG offers dramatically greater file size savings.',
      'When converting transparent PNG or WebP images to JPG, transparent areas are composited onto a solid white background because JPEG does not support transparency.',
      'Lower compression quality settings reduce file size significantly but may introduce visual artifacts or softness.',
      'Damaged or corrupted image files are isolated and flagged without stopping valid files in the batch.',
    ],
    faqs: [
      {
        question: 'How much can I compress an image?',
        answer: 'Compression savings depend on source format and visual content. For standard JPGs and WebP images, quality settings between 60% and 80% typically reduce file size by 40% to 80% with minimal visual degradation. Converting high-resolution PNG photos to modern WebP often achieves 70% to 90% size reductions.',
      },
      {
        question: 'Does image compression reduce quality?',
        answer: 'JPEG and WebP use lossy compression algorithms that discard subtle high-frequency color variations that the human eye rarely perceives. At the default 80% balanced setting, images look virtually identical to the original while occupying significantly less storage.',
      },
      {
        question: 'Can I compress PNG and WebP files?',
        answer: 'Yes. The compressor fully supports PNG and WebP files. WebP images can be compressed lossily using the quality slider. For PNG files, browser canvas re-encoding is lossless; converting PNG images to WebP or JPG provides maximum file size reduction while preserving transparency or compositing cleanly onto white.',
      },
      {
        question: 'Can I compress multiple images at once?',
        answer: 'Yes. You can select multiple images simultaneously. The compressor processes items sequentially in device memory to prevent browser crashes, and provides a "Download All as ZIP" option when two or more images are completed.',
      },
      {
        question: 'Are my images uploaded anywhere?',
        answer: 'No. All image loading, canvas drawing, and compression happen entirely on your computer or phone using HTML5 Canvas APIs. Zero image bytes, filenames, or metadata are ever transmitted over the network.',
      },
    ],
  },
  {
    slug: 'social-resizer',
    category: 'image',
    group: 'Resize & Compress',
    title: 'Social Media Image Resizer',
    metaTitle: 'Social Media Image Resizer — Resize for Instagram, X & LinkedIn',
    metaDescription: 'Resize and crop images for Instagram, Facebook, X, LinkedIn, YouTube, Pinterest, and TikTok. 100% private in-browser resizing with zero server uploads.',
    shortBlurb: 'Resize and crop images to fit Instagram, Facebook, X, LinkedIn, YouTube, TikTok, and Pinterest presets with focal control and zero server uploads.',
    acceptedFiles: '.jpg, .jpeg, .png, .webp, image/jpeg, image/png, image/webp',
    acceptedTypesLabel: 'JPG, PNG, or WebP images',
    sizeWarningMB: 50,
    sizeCeilingNote: 'High-resolution source photos process locally in browser memory. Sequential multi-export ensures smooth performance.',
    status: 'active',
    howItWorks: [
      {
        step: 1,
        title: 'Upload your photo',
        description: 'Select or drop a high-resolution JPG, PNG, or WebP photo to resize. It loads instantly in your browser.',
      },
      {
        step: 2,
        title: 'Select social presets & focal point',
        description: 'Choose presets for Instagram, Facebook, X, LinkedIn, YouTube, Pinterest, TikTok, or custom dimensions. Adjust Crop or Fit mode and 3x3 focal alignment.',
      },
      {
        step: 3,
        title: 'Export and download',
        description: 'Review the live aspect ratio preview, generate your social images locally, and download single files or package all selected presets into a ZIP.',
      },
    ],
    limitations: [
      'Client-side canvas rendering decodes full source image bitmaps into device RAM; large source images (such as 48 MP photos) consume temporary browser memory.',
      'Crop to Fill mode discards pixels outside the target aspect ratio; use the 3x3 focal position grid to anchor critical subjects.',
      'Fit Entire Image mode letterboxes or pillarboxes images onto a solid white background (or transparent canvas for PNG and WebP) to prevent stretching.',
      'When exporting to JPG, transparent source pixels are automatically flattened onto solid white because the JPEG specification does not support an alpha channel.',
      'Social media platforms periodically adjust recommended aspect ratios and upload compression algorithms; all presets are verified against current 2026 platform documentation.',
    ],
    faqs: [
      {
        question: 'What social media platforms and presets are supported?',
        answer: 'Our tool supports verified 2026 specifications for Instagram (Square 1:1, Portrait 4:5, Landscape 1.91:1, Story/Reels 9:16, Profile), Facebook (Feed 1200x630, Square, Cover 820x312, Story), X/Twitter (Post 16:9, Header 3:1, Profile), LinkedIn (Post 1200x627, Square, Personal & Company Cover, Profile), YouTube (Thumbnail 16:9, Banner, Profile), Pinterest (Standard Pin 2:3, Square, Story), TikTok (Story/Cover 9:16, Profile), plus custom pixel dimensions.',
      },
      {
        question: 'What is the difference between Crop to Fill and Fit Entire Image?',
        answer: 'Crop to Fill scales your photo to cover the entire preset area without distortion and trims excess borders according to your chosen 3x3 focal alignment point (Center, Top, Bottom, Left, Right, or corners). Fit Entire Image scales your full photo to fit completely inside the dimensions without cropping, padding extra space with solid white (or transparent background for PNG/WebP).',
      },
      {
        question: 'How does the 3x3 focal alignment grid work?',
        answer: 'When your source photo does not match the target aspect ratio, cropping is required. The 3x3 focal grid lets you decide which part of the photo stays visible—for example, selecting Top-Center preserves faces in vertical portraits, while selecting Left or Right preserves off-center subjects.',
      },
      {
        question: 'Can I export multiple social sizes at once?',
        answer: 'Yes. You can select multiple platform presets (or all presets for a platform) simultaneously. The tool generates all selected variants locally and lets you download them individually or package them into a single convenient ZIP archive.',
      },
      {
        question: 'Are my images uploaded to any remote server?',
        answer: 'No. All image loading, canvas drawing, focal cropping, and file compression occur 100% locally inside your web browser using HTML5 Canvas APIs. Zero image data or metadata is ever transmitted over the network.',
      },
    ],
  },
  {
    slug: 'video-compressor',
    category: 'video',
    group: 'Video Compression',
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
    group: 'Document Compilation',
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
    group: 'Media & Captions',
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

export function getAllTools(): Tool[] {
  return TOOLS;
}

export function getActiveTools(): Tool[] {
  return TOOLS.filter((tool) => tool.status === 'active');
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
