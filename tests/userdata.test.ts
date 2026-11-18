import { describe, expect, it } from 'vitest'
import { normalizeUserData } from '../src/lib/storage'

describe('normalizeUserData', () => {
  it('非对象输入回落到完整默认结构', () => {
    const data = normalizeUserData(null)
    expect(data.version).toBe(2)
    expect(data.items).toEqual({})
    expect(data.characters).toEqual([])
    expect(data.collections).toEqual([])
    expect(data.storylines).toEqual([])
    expect(data.dimensions.map((d) => d.id)).toEqual([
      'character',
      'scene',
      'mood',
      'element',
      'technique',
      'custom',
    ])
    expect(data.tags.length).toBeGreaterThan(0)
  })

  it('标签按 id 去重，缺名丢弃，未知维度归入 custom', () => {
    const data = normalizeUserData({
      tags: [
        { id: 'mood_x', name: '开心', dimensionId: 'mood', color: '#123456' },
        { id: 'mood_x', name: '重复', dimensionId: 'mood' },
        { id: 'no_name', dimensionId: 'mood' },
        { id: 'weird', name: '未知维度', dimensionId: 'nope' },
      ],
    })
    expect(data.tags.filter((t) => t.id === 'mood_x')).toHaveLength(1)
    expect(data.tags.find((t) => t.id === 'mood_x')?.name).toBe('开心')
    expect(data.tags.some((t) => t.id === 'no_name')).toBe(false)
    expect(data.tags.find((t) => t.id === 'weird')?.dimensionId).toBe('custom')
    expect(data.tags.find((t) => t.id === 'weird')?.color).toBe('#b0553b')
  })

  it('单图标注补齐默认字段并过滤未知标签', () => {
    const data = normalizeUserData({
      tags: [{ id: 'mood_x', name: '开心', dimensionId: 'mood' }],
      items: {
        a: {
          tags: ['mood_x', 'mood_x', 'ghost'],
          favorite: 1,
          note: '私密备注',
          excluded: true,
        },
        b: { tags: 'not-an-array' },
        c: null,
      },
    })
    expect(Object.keys(data.items).sort()).toEqual(['a', 'b'])
    expect(data.items.a.tags).toEqual(['mood_x'])
    expect(data.items.a.favorite).toBe(true)
    expect(data.items.a.note).toBe('私密备注')
    expect(data.items.a.excluded).toBe(true)
    expect(data.items.a.reviewed).toBe(true)
    expect(data.items.b.tags).toEqual([])
    expect(data.items.b.note).toBe('')
    expect(data.items.b.updatedAt).toBeTruthy()
  })

  it('日期必须完整，非法 source 回落到 inferred', () => {
    const data = normalizeUserData({
      items: {
        ok: { date: { year: 2024, month: 2, day: 29, confirmed: true, source: 'published' } },
        partial: { date: { year: 2024, month: 2 } },
        bogus: { date: { year: 2024, month: 2, day: 3, source: 'guess' } },
      },
    })
    expect(data.items.ok.date).toEqual({
      year: 2024,
      month: 2,
      day: 29,
      confirmed: true,
      source: 'published',
    })
    expect(data.items.partial.date).toBeUndefined()
    expect(data.items.bogus.date?.source).toBe('inferred')
    expect(data.items.bogus.date?.confirmed).toBe(false)
  })

  it('翻译槽位过滤无语言项，空翻译整体丢弃', () => {
    const data = normalizeUserData({
      items: {
        t: {
          translation: {
            source: '原文',
            slots: [
              { lang: 'zh', text: '你好' },
              { text: '没有语言' },
              { lang: 'ja', label: '日本語', text: 'こんにちは' },
            ],
          },
        },
        empty: { translation: { slots: [] } },
        draft: { translation: { sourceDraft: '待校对' } },
      },
    })
    expect(data.items.t.translation?.slots).toEqual([
      { lang: 'zh', label: 'zh', text: '你好' },
      { lang: 'ja', label: '日本語', text: 'こんにちは' },
    ])
    expect(data.items.empty.translation).toBeUndefined()
    expect(data.items.draft.translation?.sourceDraft).toBe('待校对')
  })

  it('拆解笔记与裁切参数按字段补默认值', () => {
    const data = normalizeUserData({
      items: { a: { study: { composition: '三角构图' }, crop: { tolerance: 40 } } },
    })
    expect(data.items.a.study).toEqual({
      composition: '三角构图',
      palette: '',
      linework: '',
      expression: '',
      memo: '',
    })
    expect(data.items.a.crop).toEqual({
      cx: 0.5,
      cy: 0.5,
      size: 1,
      tolerance: 40,
      transparent: true,
    })
  })

  it('离线角色从标签、角色、故事线与标注中一并清除', () => {
    const data = normalizeUserData({
      tags: [
        { id: 'char_miwa_ai', name: '三和爱', dimensionId: 'character' },
        { id: 'mood_x', name: '开心', dimensionId: 'mood' },
      ],
      characters: [{ id: 'char_miwa_ai' }],
      storylines: [{ id: 's1', title: '线', tags: ['char_miwa_ai', 'mood_x'] }],
      items: { a: { tags: ['char_miwa_ai', 'mood_x'] } },
    })
    expect(data.tags.some((t) => t.id === 'char_miwa_ai')).toBe(false)
    expect(data.characters.some((c) => c.id === 'char_miwa_ai')).toBe(false)
    expect(data.storylines[0].tags).toEqual(['mood_x'])
    expect(data.items.a.tags).toEqual(['mood_x'])
  })

  it('旧角色名就地迁移到现行定义', () => {
    const data = normalizeUserData({
      tags: [{ id: 'char_nishigaki_nana', name: '老师们', dimensionId: 'character' }],
    })
    expect(data.tags.find((t) => t.id === 'char_nishigaki_nana')?.name).toBe('西垣奈奈')
  })

  it('补齐新增角色标签且不覆盖已有名称', () => {
    const data = normalizeUserData({
      tags: [{ id: 'char_toushi_hoko', name: '自定义志帆', dimensionId: 'character' }],
    })
    expect(data.tags.find((t) => t.id === 'char_toushi_hoko')?.name).toBe('自定义志帆')
    expect(data.tags.some((t) => t.id === 'char_kitamiya_hatsumi')).toBe(true)
    expect(data.tags.some((t) => t.id === 'char_minamino_tsubasa')).toBe(true)
  })

  it('角色必须对应已有标签，裁切与封面参数收敛到合法范围', () => {
    const data = normalizeUserData({
      tags: [{ id: 'char_akaza_akari', name: '赤座灯里', dimensionId: 'character' }],
      characters: [
        {
          id: 'char_akaza_akari',
          coverCrop: { x: 130, y: -8, zoom: 9 },
          avatarCrop: { cx: 0.2, cy: 0.8, size: 0.5, tolerance: 30, transparent: false },
          profile: { cv: 'CV' },
          note: '角色备注',
        },
        { id: 'ghost' },
      ],
    })
    expect(data.characters).toHaveLength(1)
    const character = data.characters[0]
    expect(character.coverCrop).toEqual({ x: 100, y: 0, zoom: 4 })
    expect(character.avatarCrop).toEqual({
      cx: 0.2,
      cy: 0.8,
      size: 0.5,
      tolerance: 30,
      transparent: false,
    })
    expect(character.profile).toEqual({ cv: 'CV', role: '', traits: '' })
    expect(character.note).toBe('角色备注')
  })

  it('合集去除重复与非字符串条目', () => {
    const data = normalizeUserData({
      collections: [
        { id: 'c1', name: '合集', itemIds: ['a', 'a', 3, 'b'] },
        { id: 'c2' },
      ],
    })
    expect(data.collections).toHaveLength(1)
    expect(data.collections[0].itemIds).toEqual(['a', 'b'])
    expect(data.collections[0].description).toBe('')
  })

  it('故事线过滤非法内容块并去重标签', () => {
    const data = normalizeUserData({
      storylines: [
        {
          id: 's1',
          title: '故事',
          tags: ['a', 'a', 'b'],
          published: true,
          blocks: [
            { id: 'b1', type: 'image', itemId: 'x' },
            { id: 'b2', type: 'image' },
            { id: 'b3', type: 'note', text: '   ' },
            { id: 'b4', type: 'note', text: '注' },
            { id: 'b5', type: 'video' },
          ],
        },
        { id: 's2' },
      ],
    })
    expect(data.storylines).toHaveLength(1)
    expect(data.storylines[0].tags).toEqual(['a', 'b'])
    expect(data.storylines[0].published).toBe(true)
    expect(data.storylines[0].blocks).toEqual([
      { id: 'b1', type: 'image', itemId: 'x' },
      { id: 'b4', type: 'note', text: '注' },
    ])
  })
})
