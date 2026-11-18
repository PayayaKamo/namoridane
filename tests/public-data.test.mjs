import { describe, expect, it } from 'vitest'
import {
  applyReviewExport,
  sanitizePublicData,
  validateReviewExport,
  validateUserData,
} from '../scripts/lib/public-data.mjs'

const baseUserData = (items, overrides = {}) => ({
  version: 2,
  updatedAt: '2024-01-01T00:00:00.000Z',
  dimensions: [],
  tags: [],
  characters: [],
  collections: [],
  storylines: [],
  items,
  ...overrides,
})

describe('validateUserData', () => {
  it('拒绝非对象、错误版本与缺失 items', () => {
    expect(() => validateUserData(null)).toThrow('不是有效的 JSON 对象')
    expect(() => validateUserData([])).toThrow('不是有效的 JSON 对象')
    expect(() => validateUserData(baseUserData({}, { version: 1 }))).toThrow('version 必须为 2')
    expect(() => validateUserData({ version: 2 })).toThrow('缺少 items 对象')
  })

  it('拒绝非对象的单图标注与非数组 tags', () => {
    expect(() => validateUserData(baseUserData({ a: 'oops' }))).toThrow('items["a"] 不是对象')
    expect(() => validateUserData(baseUserData({}, { tags: 'oops' }))).toThrow('tags 必须是数组')
  })
})

describe('sanitizePublicData', () => {
  const raw = baseUserData(
    {
      keep: {
        tags: ['mood_x', 5],
        favorite: true,
        reviewed: true,
        excluded: false,
        note: '私密备注',
        study: { memo: '私密拆解' },
        crop: { cx: 0.5, cy: 0.5, size: 1, tolerance: 18, transparent: true },
        date: { year: 2024, month: 2, day: 29, confirmed: true, source: 'manual' },
        translation: {
          source: '原文',
          sourceDraft: '未校对的草稿',
          slots: [
            { lang: 'zh', label: '中文', text: '译文' },
            { label: '缺少语言' },
          ],
          updatedAt: '2024-02-01T00:00:00.000Z',
        },
        xiaohongshu: '  https://xhs.example/1  ',
        wechat: '   ',
        updatedAt: '2024-02-02T00:00:00.000Z',
      },
      inferredOnly: {
        tags: [],
        date: { year: 2024, month: 1, day: 5, confirmed: false, source: 'inferred' },
      },
      badSource: {
        tags: [],
        date: { year: 2024, month: 3, day: 1, confirmed: true, source: 'guess' },
      },
      excluded: { excluded: true, note: '非绘日记的私密备注' },
      deleted: { deleted: true, excluded: true, note: '已删除' },
    },
    {
      datasetId: 'private-dataset',
      privateNote: '顶层私密字段',
      collections: [{ id: 'c1', name: '私密合集', itemIds: ['keep'] }],
      storylines: [
        { id: 's1', title: '已发布', published: true },
        { id: 's2', title: '草稿' },
      ],
    },
  )

  const result = sanitizePublicData(raw)

  it('只保留公开字段，剥离备注、收藏、拆解与裁切', () => {
    expect(result.items.keep).toEqual({
      tags: ['mood_x'],
      favorite: false,
      reviewed: true,
      excluded: false,
      note: '',
      updatedAt: '2024-02-02T00:00:00.000Z',
      date: { year: 2024, month: 2, day: 29, confirmed: true, source: 'manual' },
      translation: {
        source: '原文',
        slots: [{ lang: 'zh', label: '中文', text: '译文' }],
        updatedAt: '2024-02-01T00:00:00.000Z',
      },
      xiaohongshu: 'https://xhs.example/1',
    })
  })

  it('丢弃未确认日期与非法日期来源', () => {
    expect(result.items.inferredOnly.date).toBeUndefined()
    expect(result.items.badSource.date?.source).toBe('inferred')
  })

  it('非绘日记只保留 id，已删除条目完全移除', () => {
    expect(result.items.excluded).toBeUndefined()
    expect(result.items.deleted).toBeUndefined()
    expect(result.excludedIds).toEqual(['excluded'])
  })

  it('顶层只输出白名单字段，不泄露数据集指纹与未知字段', () => {
    expect(result.datasetId).toBeUndefined()
    expect(result.privateNote).toBeUndefined()
    expect(Object.keys(result).sort()).toEqual([
      'characters',
      'collections',
      'dimensions',
      'excludedIds',
      'items',
      'storylines',
      'tags',
      'updatedAt',
      'version',
    ])
    expect(result.collections).toEqual([])
  })

  it('只发布已发布的故事线', () => {
    expect(result.storylines.map((storyline) => storyline.id)).toEqual(['s1'])
  })

  it('公开数据再次通过完整校验', () => {
    expect(() => validateUserData(result)).not.toThrow()
  })
})

describe('validateReviewExport', () => {
  const review = (overrides = {}) => ({
    type: 'namori-diary-review',
    version: 1,
    updatedAt: '2024-01-01T00:00:00.000Z',
    items: [
      {
        id: 'a',
        file: 'a.jpg',
        publishedAt: '2024-05-10',
        status: 'diary',
        diaryDate: '2024-05-09',
        dateConfirmed: true,
        dateSource: 'manual',
      },
    ],
    ...overrides,
  })

  it('接受合法的审核导出', () => {
    expect(() => validateReviewExport(review())).not.toThrow()
  })

  it('拒绝错误类型、非法状态与非法日期', () => {
    expect(() => validateReviewExport(review({ type: 'other' }))).toThrow('namori-diary-review v1')
    expect(() =>
      validateReviewExport(review({ items: [{ ...review().items[0], status: 'maybe' }] })),
    ).toThrow('status 非法')
    expect(() =>
      validateReviewExport(review({ items: [{ ...review().items[0], diaryDate: '2024/05/09' }] })),
    ).toThrow('diaryDate 非法')
    expect(() => validateReviewExport(review({ items: [{ ...review().items[0], id: '' }] }))).toThrow(
      '缺少 id',
    )
  })
})

describe('applyReviewExport', () => {
  const base = baseUserData({
    a: {
      tags: ['mood_x'],
      favorite: true,
      reviewed: false,
      excluded: false,
      note: '保留备注',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
  })

  const review = {
    type: 'namori-diary-review',
    version: 1,
    updatedAt: '2024-02-01T00:00:00.000Z',
    items: [
      {
        id: 'a',
        file: 'a.jpg',
        publishedAt: '2024-05-10',
        status: 'not_diary',
        diaryDate: '2024-05-09',
        dateConfirmed: false,
        dateSource: 'inferred',
      },
      {
        id: 'new',
        file: 'new.jpg',
        publishedAt: '2024-04-01',
        status: 'diary',
        diaryDate: '2024-03-31',
        dateConfirmed: true,
        dateSource: 'published',
      },
    ],
  }

  it('更新审核状态与日期，其余标注内容保持原样', () => {
    const { data, applied } = applyReviewExport(base, review)
    expect(applied).toBe(2)
    expect(data.items.a).toMatchObject({
      tags: ['mood_x'],
      favorite: true,
      note: '保留备注',
      reviewed: true,
      excluded: true,
      date: { year: 2024, month: 5, day: 9, confirmed: false, source: 'inferred' },
    })
    expect(data.items.new).toMatchObject({
      tags: [],
      favorite: false,
      reviewed: true,
      excluded: false,
      note: '',
      date: { year: 2024, month: 3, day: 31, confirmed: true, source: 'published' },
    })
  })

  it('不修改传入的原始数据', () => {
    applyReviewExport(base, review)
    expect(base.items.a.reviewed).toBe(false)
    expect(base.items.a.excluded).toBe(false)
    expect(base.items.a.note).toBe('保留备注')
  })
})
