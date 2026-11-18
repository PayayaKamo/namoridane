import type { HomeMessages } from '../zh/home'

export const home: HomeMessages = {
  hero: {
    eyebrow: 'Namori · Jellyfish Diary 2021 — 2025',
    srTitle: 'Jellyfish Diary · Namori Diary · ',
    title: 'Turn every day into a page.',
    lead: 'A collection of {count} hand-drawn diary pages that Namori posted on Instagram. Flip through by calendar, sort by character and scene, and note down study breakdowns and the characters in each page.',
    startReading: 'Start browsing',
    openCalendar: 'View calendar',
    openGallery: 'Open gallery',
  },
  daily: {
    label: 'Daily pick',
    imageAlt: 'Namori Jellyfish Diary {date}, daily pick',
    fromPastYear: 'On this day · posted {date}',
    shuffle: 'Another one',
  },
  empty: {
    publicTitle: 'Content in progress',
    publicHint: 'The diary is still being organized — please check back soon.',
    localTitle: 'No images yet',
    localHintBefore: 'Import the extracted Instagram saved-pages folder: ',
    localHintAfterImport: ', then run ',
    localHintAfterData: ' (or ',
    localHintAfterDev: ') to generate the index and derived images. Annotations are tied to the current dataset version, so older records are discarded when the data changes.',
  },
  stats: {
    total: 'Total images',
    totalHint: 'Organized by the date written in each page; non-diary posts excluded',
    years: 'Years covered',
    tagged: 'Tagged',
    taggedHint: '{count} tags, {uses} uses',
    pending: 'Dates to review',
    pendingHint: '{count} confirmed',
    favoritesHint: 'Tap the heart on the detail page',
    collectionsHint: 'Study references / scene groups',
  },
  years: {
    title: 'Images by year',
    viewStats: 'View stats',
    barTitle: '{year} · {count} images',
  },
  topTags: {
    title: 'Frequent tags',
    manage: 'Manage',
  },
  quick: {
    title: 'Quick links',
    calendar: { title: 'Calendar', desc: 'See what was drawn each day' },
    gallery: { title: 'Gallery', desc: 'Masonry browsing and batch organizing' },
    characters: { title: 'Character guide', desc: 'Every appearance grouped by character' },
    review: { title: 'Date review', desc: 'Check handwritten dates against post dates' },
    collections: { title: 'Collections', desc: 'Gather favorites into one book' },
  },
}
