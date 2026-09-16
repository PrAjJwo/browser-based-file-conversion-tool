/**
 * Verified Social Media Image Presets (2026)
 * Sourced directly from official platform developer documentation and help centers.
 */

export interface SocialPreset {
  id: string;
  platform: string;
  label: string;
  width: number;
  height: number;
  ratio: string;
  description: string;
  source: string;
  verifiedDate: string;
}

export interface PlatformGroup {
  name: string;
  icon: string;
  presets: SocialPreset[];
}

export const SOCIAL_PRESETS: SocialPreset[] = [
  // Instagram (Meta)
  {
    id: 'instagram-square',
    platform: 'Instagram',
    label: 'Square Post',
    width: 1080,
    height: 1080,
    ratio: '1:1',
    description: 'Standard feed photo format with square crop',
    source: 'Meta Business Help Center / Instagram Developer Docs',
    verifiedDate: '2026',
  },
  {
    id: 'instagram-portrait',
    platform: 'Instagram',
    label: 'Portrait Post',
    width: 1080,
    height: 1350,
    ratio: '4:5',
    description: 'Vertical feed photo that maximizes screen real estate',
    source: 'Meta Business Help Center',
    verifiedDate: '2026',
  },
  {
    id: 'instagram-landscape',
    platform: 'Instagram',
    label: 'Landscape Post',
    width: 1080,
    height: 566,
    ratio: '1.91:1',
    description: 'Horizontal wide feed image',
    source: 'Meta Business Help Center',
    verifiedDate: '2026',
  },
  {
    id: 'instagram-story',
    platform: 'Instagram',
    label: 'Story & Reel',
    width: 1080,
    height: 1920,
    ratio: '9:16',
    description: 'Full-screen vertical format for Stories, Highlights, and Reels',
    source: 'Meta Business Help Center',
    verifiedDate: '2026',
  },
  {
    id: 'instagram-profile',
    platform: 'Instagram',
    label: 'Profile Photo',
    width: 320,
    height: 320,
    ratio: '1:1',
    description: 'Circular profile photo avatar',
    source: 'Instagram Help Center',
    verifiedDate: '2026',
  },

  // Facebook (Meta)
  {
    id: 'facebook-feed',
    platform: 'Facebook',
    label: 'Shared Link / Feed Post',
    width: 1200,
    height: 630,
    ratio: '1.91:1',
    description: 'Landscape feed post and open graph shared link card',
    source: 'Meta Business Help Center',
    verifiedDate: '2026',
  },
  {
    id: 'facebook-square',
    platform: 'Facebook',
    label: 'Square Post',
    width: 1080,
    height: 1080,
    ratio: '1:1',
    description: 'Square news feed photo post',
    source: 'Meta Business Help Center',
    verifiedDate: '2026',
  },
  {
    id: 'facebook-cover',
    platform: 'Facebook',
    label: 'Page Cover Banner',
    width: 820,
    height: 312,
    ratio: '2.63:1',
    description: 'Desktop header banner (scales to 640x360 on mobile)',
    source: 'Meta Help Center',
    verifiedDate: '2026',
  },
  {
    id: 'facebook-story',
    platform: 'Facebook',
    label: 'Story',
    width: 1080,
    height: 1920,
    ratio: '9:16',
    description: 'Vertical full-screen story image',
    source: 'Meta Help Center',
    verifiedDate: '2026',
  },

  // X / Twitter
  {
    id: 'x-post',
    platform: 'X / Twitter',
    label: 'In-Stream Post',
    width: 1200,
    height: 675,
    ratio: '16:9',
    description: 'Standard feed photo and summary card image',
    source: 'X Developer Platform / Help Center',
    verifiedDate: '2026',
  },
  {
    id: 'x-header',
    platform: 'X / Twitter',
    label: 'Header Banner',
    width: 1500,
    height: 500,
    ratio: '3:1',
    description: 'Profile top header banner',
    source: 'X Help Center',
    verifiedDate: '2026',
  },
  {
    id: 'x-profile',
    platform: 'X / Twitter',
    label: 'Profile Photo',
    width: 400,
    height: 400,
    ratio: '1:1',
    description: 'Account profile avatar',
    source: 'X Help Center',
    verifiedDate: '2026',
  },

  // LinkedIn
  {
    id: 'linkedin-post',
    platform: 'LinkedIn',
    label: 'Shared Post / Article',
    width: 1200,
    height: 627,
    ratio: '1.91:1',
    description: 'Standard feed photo and article link preview',
    source: 'LinkedIn Marketing Solutions',
    verifiedDate: '2026',
  },
  {
    id: 'linkedin-square',
    platform: 'LinkedIn',
    label: 'Square Post',
    width: 1080,
    height: 1080,
    ratio: '1:1',
    description: 'Square feed post photo',
    source: 'LinkedIn Marketing Solutions',
    verifiedDate: '2026',
  },
  {
    id: 'linkedin-cover',
    platform: 'LinkedIn',
    label: 'Personal Cover Banner',
    width: 1584,
    height: 396,
    ratio: '4:1',
    description: 'Personal profile background banner',
    source: 'LinkedIn Help',
    verifiedDate: '2026',
  },
  {
    id: 'linkedin-company-cover',
    platform: 'LinkedIn',
    label: 'Company Cover Banner',
    width: 1128,
    height: 191,
    ratio: '5.91:1',
    description: 'Company organization page cover banner',
    source: 'LinkedIn Help',
    verifiedDate: '2026',
  },
  {
    id: 'linkedin-profile',
    platform: 'LinkedIn',
    label: 'Profile Photo',
    width: 400,
    height: 400,
    ratio: '1:1',
    description: 'Professional headshot avatar',
    source: 'LinkedIn Help',
    verifiedDate: '2026',
  },

  // YouTube
  {
    id: 'youtube-thumbnail',
    platform: 'YouTube',
    label: 'Video Thumbnail',
    width: 1280,
    height: 720,
    ratio: '16:9',
    description: 'Standard high-definition video preview thumbnail',
    source: 'YouTube Help Center',
    verifiedDate: '2026',
  },
  {
    id: 'youtube-banner',
    platform: 'YouTube',
    label: 'Channel Banner',
    width: 2560,
    height: 1440,
    ratio: '16:9',
    description: 'Channel desktop/TV banner (safe area 1232x338)',
    source: 'YouTube Help Center',
    verifiedDate: '2026',
  },
  {
    id: 'youtube-profile',
    platform: 'YouTube',
    label: 'Channel Profile',
    width: 800,
    height: 800,
    ratio: '1:1',
    description: 'Channel avatar icon',
    source: 'YouTube Help Center',
    verifiedDate: '2026',
  },

  // Pinterest
  {
    id: 'pinterest-pin',
    platform: 'Pinterest',
    label: 'Standard Pin',
    width: 1000,
    height: 1500,
    ratio: '2:3',
    description: 'Optimal portrait pin format for maximum feed visibility',
    source: 'Pinterest Business Best Practices',
    verifiedDate: '2026',
  },
  {
    id: 'pinterest-square',
    platform: 'Pinterest',
    label: 'Square Pin',
    width: 1000,
    height: 1000,
    ratio: '1:1',
    description: 'Square product pin',
    source: 'Pinterest Business',
    verifiedDate: '2026',
  },
  {
    id: 'pinterest-story',
    platform: 'Pinterest',
    label: 'Idea Pin / Story',
    width: 1080,
    height: 1920,
    ratio: '9:16',
    description: 'Vertical full-length idea pin',
    source: 'Pinterest Help',
    verifiedDate: '2026',
  },

  // TikTok
  {
    id: 'tiktok-cover',
    platform: 'TikTok',
    label: 'Video Cover / Story',
    width: 1080,
    height: 1920,
    ratio: '9:16',
    description: 'Vertical video cover and full-screen image post',
    source: 'TikTok Business Creative Center',
    verifiedDate: '2026',
  },
  {
    id: 'tiktok-profile',
    platform: 'TikTok',
    label: 'Profile Photo',
    width: 200,
    height: 200,
    ratio: '1:1',
    description: 'Account profile photo',
    source: 'TikTok Help Center',
    verifiedDate: '2026',
  },
];

/**
 * Group presets by platform
 */
export function getPresetsByPlatform(): Record<string, SocialPreset[]> {
  const grouped: Record<string, SocialPreset[]> = {};
  for (const p of SOCIAL_PRESETS) {
    if (!grouped[p.platform]) {
      grouped[p.platform] = [];
    }
    grouped[p.platform].push(p);
  }
  return grouped;
}

/**
 * Find preset by ID
 */
export function getPresetById(id: string): SocialPreset | undefined {
  return SOCIAL_PRESETS.find((p) => p.id === id);
}
