import { describe, expect, it } from 'vitest'
import { applyFilters, DEFAULT_FILTER, groupByMonth, hasTranslation } from '../src/lib/filtering'
import type { DiaryItem, FilterState, ItemAnnotation, Tag } from '../src/types'

function makeItem(id: string, overrides: Partial<DiaryItem> = {}): DiaryItem {
  return {
    id,
    shortcode: id,
    file: `${id}.jpg`,
    sourceFile: null,
    caption: null,
    permalink: null,
    postIndex: 0,
    postCount: 1,
    category: 'diary',
    includedInPublic: true,
    publishedAt: '2024-05-10',
    dateKnown: true,
    inferredYear: 2024,
    inferredMonth: 5,
    inferredDay: 9,
    rollover: '',
    ocr: null,
    suggestedDiaryDate: null,
    thumb: '',
    large: '',
    original: '',
    bytes: 0,
    w: 0,
    h: 0,
    palette: [],
    color: '#ffffff',
    ...overrides,
  }
}

function makeAnnotation(overrides: Partial<ItemAnnotation> = {}): ItemAnnotation {
  return {
    tags: [],
    favorite: false,
    reviewed: false,
    excluded: false,
    note: '',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}

const tags: Tag[] = [
  { id: 'char_a', name: '角色A', dimensionId: 'character', color: '#000000', createdAt: '' },
  { id: 'char_b', name: '角色B', dimensionId: 'character', color: '#000000', createdAt: '' },
  { id: 'mood_x', name: '开心', dimensionId: 'mood', color: '#000000', createdAt: '' },
]

const filter = (overrides: Partial<FilterState> = {}): FilterState => ({
  ...DEFAULT_FILTER,
  ...overrides,
})

describe('applyFilters 日期筛选', () => {
  const items = [
    makeItem('a', { publishedAt: '2024-05-10' }),
    makeItem('b', { publishedAt: '2023-12-31', inferredYear: 2023, inferredMonth: 12, inferredDay: 30 }),
    makeItem('c', { publishedAt: '', dateKnown: false, inferredYear: 0, inferredMonth: 0, inferredDay: 0 }),
  ]
  const annotations = {
    a: makeAnnotation({
      date: { year: 2024, month: 6, day: 1, confirmed: true, source: 'manual' },
    }),
  }

  const run = (f: Partial<FilterState>) =>
    applyFilters({ items, annotations, tags }, filter(f)).map((item) => item.id)

  it('年份与月份以人工确认日期为准', () => {
    expect(run({ year: '2024' })).toEqual(['a'])
    expect(run({ month: '6' })).toEqual(['a'])
  })

  it('起止日期按 ISO 闭区间比较', () => {
    expect(run({ from: '2024-01-01', to: '2024-12-31' })).toEqual(['a'])
    // 未知日期的 iso 为空串，按默认 publishedAsc 排在最前
    expect(run({ to: '2023-12-31' })).toEqual(['c', 'b'])
  })

  it('仅看未确认日期时排除已确认条目', () => {
    expect(run({ unconfirmedOnly: true })).toEqual(['c', 'b'])
  })

  it('仅看收藏', () => {
    expect(
      applyFilters(
        { items, annotations: { ...annotations, b: makeAnnotation({ favorite: true }) }, tags },
        filter({ favoriteOnly: true }),
      ).map((item) => item.id),
    ).toEqual(['b'])
  })
})

describe('applyFilters 翻译状态', () => {
  const items = [makeItem('a'), makeItem('b'), makeItem('c')]
  const annotations = {
    a: makeAnnotation({ translation: { source: '', slots: [{ lang: 'zh', label: '中文', text: '译文' }], updatedAt: '' } }),
    b: makeAnnotation({ translation: { source: '', slots: [{ lang: 'zh', label: '中文', text: '   ' }], updatedAt: '' } }),
    c: makeAnnotation(),
  }

  it('translated 只保留有实际译文的条目', () => {
    expect(hasTranslation(annotations.a)).toBe(true)
    expect(hasTranslation(annotations.b)).toBe(false)
    const result = applyFilters({ items, annotations, tags }, filter({ translation: 'translated' }))
    expect(result.map((item) => item.id)).toEqual(['a'])
  })

  it('none 保留未翻译或译文为空的条目', () => {
    const result = applyFilters({ items, annotations, tags }, filter({ translation: 'none' }))
    expect(result.map((item) => item.id)).toEqual(['b', 'c'])
  })
})

describe('applyFilters 标签与关键词', () => {
  const items = [makeItem('a'), makeItem('b'), makeItem('c')]
  const annotations = {
    a: makeAnnotation({ tags: ['char_a', 'mood_x'], note: '雨天的午后' }),
    b: makeAnnotation({ tags: ['char_a', 'char_b'] }),
    c: makeAnnotation({ tags: ['char_a', 'char_b', 'mood_x'] }),
  }
  const run = (f: Partial<FilterState>) =>
    applyFilters({ items, annotations, tags }, filter(f)).map((item) => item.id)

  it('同维度内 any / all 生效', () => {
    expect(run({ tagIds: ['char_a', 'char_b'], tagMode: 'any' })).toEqual(['a', 'b', 'c'])
    expect(run({ tagIds: ['char_a', 'char_b'], tagMode: 'all' })).toEqual(['b', 'c'])
  })

  it('跨维度之间始终 AND，维度内可单独设置模式', () => {
    // 默认 any：人物维度有 char_a 即可，情绪维度仍需命中 mood_x
    expect(run({ tagIds: ['char_a', 'char_b', 'mood_x'] })).toEqual(['a', 'c'])
    expect(
      run({
        tagIds: ['char_a', 'char_b', 'mood_x'],
        dimensionModes: { character: 'all' },
      }),
    ).toEqual(['c'])
    expect(
      run({
        tagIds: ['char_a', 'char_b'],
        dimensionModes: { character: 'all' },
      }),
    ).toEqual(['b', 'c'])
  })

  it('关键词按空格拆分且逐词命中，忽略大小写', () => {
    expect(run({ keyword: '雨天 午后' })).toEqual(['a'])
    expect(run({ keyword: '角色B' })).toEqual(['b', 'c'])
    expect(run({ keyword: 'A.JPG' })).toEqual(['a'])
    expect(run({ keyword: '不存在的词' })).toEqual([])
  })

  it('合集筛选只保留合集内条目', () => {
    expect(
      applyFilters(
        { items, annotations, tags, collectionItemIds: ['a', 'c'] },
        filter({ collectionId: 'col_1' }),
      ).map((item) => item.id),
    ).toEqual(['a', 'c'])
  })
})

describe('applyFilters 排序', () => {
  const items = [
    makeItem('b', { publishedAt: '2024-05-10', postIndex: 0 }),
    makeItem('a', { publishedAt: '2024-05-10', postIndex: 1 }),
    makeItem('c', { publishedAt: '2023-01-01' }),
    makeItem('d', { publishedAt: '', dateKnown: false, inferredYear: 0, inferredMonth: 0, inferredDay: 0 }),
  ]
  const annotations = {
    a: makeAnnotation({ updatedAt: '2024-03-01T00:00:00.000Z' }),
    b: makeAnnotation({ updatedAt: '2024-01-01T00:00:00.000Z' }),
    c: makeAnnotation({ updatedAt: '2024-02-01T00:00:00.000Z' }),
  }
  const run = (sort: FilterState['sort']) =>
    applyFilters({ items, annotations, tags }, filter({ sort })).map((item) => item.id)

  it('publishedAsc / publishedDesc 以同帖序号收尾', () => {
    expect(run('publishedAsc')).toEqual(['d', 'c', 'b', 'a'])
    expect(run('publishedDesc')).toEqual(['b', 'a', 'c', 'd'])
  })

  it('diaryAsc / diaryDesc 按日记日期排序，未知日期排在最前/最后', () => {
    // a/b/c 推断日期相同，按同帖序号升序：b(0)、c(0)、a(1)
    expect(run('diaryAsc')).toEqual(['d', 'b', 'c', 'a'])
    expect(run('diaryDesc')).toEqual(['a', 'b', 'c', 'd'])
  })

  it('updatedDesc 按标注更新时间倒序', () => {
    expect(run('updatedDesc')).toEqual(['a', 'c', 'b', 'd'])
  })
})

describe('groupByMonth', () => {
  it('按年月分组并把未知日期放在最后', () => {
    const items = [
      makeItem('a', { inferredYear: 2024, inferredMonth: 5, inferredDay: 9 }),
      makeItem('b', { inferredYear: 2023, inferredMonth: 12, inferredDay: 30 }),
      makeItem('c', { inferredYear: 0, inferredMonth: 0, inferredDay: 0 }),
    ]
    const groups = groupByMonth(items, {})
    expect(groups.map((group) => group.key)).toEqual(['2023-12', '2024-05', 'unknown'])
    expect(groups[2].items.map((item) => item.id)).toEqual(['c'])
  })
})
