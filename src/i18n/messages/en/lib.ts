import type { LibMessages } from '../zh/lib'

export const lib: LibMessages = {
  newCharacter: 'New character',
  newCollection: 'Untitled collection',
  newStoryline: 'Untitled storyline',
  seedNotFound: 'Seed data not found (public/data/userdata.seed.json)',
  seedMerged: 'Merged repository seed annotations',
  annotationsCleared: 'Local annotations cleared',
  imageLoadFailed: 'Failed to load image: {src}',
  originalLoadFailed: 'Failed to read the original image: {file}',
  seo: {
    itemTitle: 'Namori diary {date} · {site}',
    itemTitleNoDate: 'Namori diary · {site}',
  },
  search: {
    date: 'Date',
    publishedAt: 'Posted',
    source: 'Source',
    sourceDraft: 'Source draft',
    translation: 'Translation',
    translationSlot: 'Translation · {name}',
    caption: 'Caption',
    shortcode: 'Shortcode',
    file: 'File',
    character: 'Character',
    tag: 'Tag',
    note: 'Note',
    collection: 'Collection',
    study: 'Study note',
  },
  studyFields: {
    composition: { label: 'Composition', hint: 'Subject placement, negative space, sight lines, angle' },
    palette: { label: 'Palette', hint: 'Main and accent colors, warm/cool contrast' },
    linework: { label: 'Linework', hint: 'Width variation, brushwork, how strokes end' },
    expression: { label: 'Expression', hint: 'Facial proportions, mood, movement' },
    memo: { label: 'Notes', hint: 'Anything else worth remembering' },
  },
}
