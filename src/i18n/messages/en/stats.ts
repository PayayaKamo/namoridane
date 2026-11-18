import type { StatsMessages } from '../zh/stats'

export const stats: StatsMessages = {
  overview: {
    subtitle: '{from} — {to} · {count} images ({posts} posts)',
  },
  cards: {
    works: 'Works',
    multiPosts: 'Including {count} from multi-image posts',
    drawingDays: 'Days with art',
    longestStreak: 'Longest streak: {count} days',
    tagged: 'Classified',
    tagsCount: '{count} tags',
    tagsAndCollections: '{tags} tags · {collections} collections',
    characters: 'Character appearances',
    charactersHint: '{count} characters have appeared',
    confirmedDates: 'Dates confirmed',
    pendingReview: '{count} to review',
    favorites: 'Favorites / notes',
    favoritesHint: '{count} with breakdowns or notes',
  },
  monthly: {
    title: 'Images per month',
    barTooltip: '{month} · {count} images · {days} days',
    hint: 'Dark bars show the number of works; hover to see how many days had art that month.',
  },
  yearly: {
    title: 'Year at a glance',
    average: 'Average per day',
    span: 'Span',
    localNotes: 'Local annotations',
    records: '{count} records',
  },
  tags: {
    title: 'Tag distribution',
    subtitle: 'Grouped by dimension · all tags',
    groupCount: '{items} items · {uses} uses',
    barTooltip: '{name} · {count} uses · click to view related works',
    emptyPublic: 'No tag distribution to show yet.',
    empty: 'No tags in use yet. Select works in the gallery and tag them in bulk, and the distribution will appear here.',
  },
  castRank: {
    title: 'Character appearances',
    subtitle: '{characters} characters · {count} appearances in total',
    count: '{count} times · {percent}',
    empty: 'No public character appearances yet.',
  },
  cast: {
    title: 'Character combinations',
    subtitlePublic: 'Public diary entries only · {count} images with character tags',
    subtitle: 'Confirmed diary entries only · {count} images with character tags',
    single: 'Solo',
    singleHint: 'only one character',
    double: 'Pairs',
    doubleHint: 'CP pairings',
    multi: 'Groups',
    multiHint: '3 or more',
    countPercent: '{count} images · {percent}',
    singleNote:
      'Definition: counts the images where this is the only character shown, once per image. Added to pairs and groups, this equals the {total} images with character tags.',
    doubleNote:
      'Definition: characters in the same image are paired two by two. Images with 3 or more characters split into several pairs (3 characters = 3 pairs), so the share uses “the {count} images with 2+ characters” as its denominator and may add up past 100%. See the “Groups” tab for full group portraits.',
    multiNote:
      'Definition: counts each whole group once per image (A × B × C is one group). This differs from the pair counts on the “Pairs” tab, where 3 characters become 3 pairs.',
    singleEmptyPublic: 'No public solo tags yet.',
    singleEmpty: 'No “solo” tags yet. Tag diary entries that feature a single character and they will rank here.',
    doubleEmptyPublic: 'No pairs to show yet.',
    doubleEmpty: 'No appearance tags to pair yet. Once a confirmed diary entry has 2 or more characters tagged, combinations will appear here.',
    multiEmptyPublic: 'No public group portraits of 3 or more characters yet.',
    multiEmpty: 'No group portraits of 3 or more characters yet. Tag multiple characters and whole groups will be ranked here by image count.',
  },
  characterTooltip: 'View the character guide for “{name}”',
}
