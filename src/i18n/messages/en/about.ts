import type { AboutMessages } from '../zh/about'

export const about: AboutMessages = {
  eyebrow: 'About',
  title: 'About',
  lead: 'Namori Diary collects the hand-drawn diary illustrations Namori (@namoridane) posts on Instagram, with dates, characters, tags and translations organised for browsing, searching and study.',
  findMe: 'Find me',
  links: {
    github: { label: 'GitHub profile', desc: 'Account and day-to-day updates' },
    repository: { label: 'Site repository', desc: 'Source code and data pipeline' },
    xiaohongshu: { label: 'Xiaohongshu · @PayaYa', desc: 'Sketches, journals and site news' },
    xiaohongshuAlt: { label: 'Xiaohongshu · @PayayaKamo', desc: 'Diary artwork and archiving notes' },
    wechat: {
      label: 'WeChat official account · @PayapayaYa',
      desc: 'Update notices and behind-the-scenes notes',
      hint: 'Hover or click to show the QR code',
      qrAlt: 'QR code for the PayapayaYa WeChat official account',
    },
  },
  site: {
    title: 'Site information',
    version: 'Version',
    buildTime: 'Build time',
    works: 'Artworks',
    years: 'Years covered',
    characters: 'Characters',
    tags: 'Tags',
    note: 'Data comes from public Instagram posts and is provided for browsing, learning and sketching reference.',
  },
}
