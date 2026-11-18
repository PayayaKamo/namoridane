import { describe, expect, it } from 'vitest'
import { inferDiaryDate, parseName, shiftDay } from '../scripts/lib/index-dates.mjs'

describe('parseName', () => {
  it('解析带发布日期的标准文件名', () => {
    expect(parseName('2024-05-10-Cx1y2Z3aB4c.jpg')).toEqual({
      publishedAt: '2024-05-10',
      year: 2024,
      month: 5,
      day: 10,
      shortcode: 'Cx1y2Z3aB4c',
      postIndex: 0,
      dateKnown: true,
    })
  })

  it('保留同帖多图的序号', () => {
    const parsed = parseName('2024-05-10-Cx1y2Z3aB4c-3.JPG')
    expect(parsed?.postIndex).toBe(3)
    expect(parsed?.shortcode).toBe('Cx1y2Z3aB4c')
  })

  it('unknown- 前缀视为日期未知', () => {
    expect(parseName('unknown-IMG_0001.jpg')).toEqual({
      publishedAt: '',
      year: 0,
      month: 0,
      day: 0,
      shortcode: 'unknown-IMG_0001',
      postIndex: 0,
      dateKnown: false,
    })
  })

  it('不符合命名约定的文件返回 null', () => {
    expect(parseName('random.jpg')).toBeNull()
    expect(parseName('2024-05-10-too-short.jpg')).toBeNull()
    expect(parseName('2024-05-10-Cx1y2Z3aB4c.png')).toBeNull()
  })
})

describe('shiftDay', () => {
  it('跨月时正确处理闰年二月', () => {
    expect(shiftDay({ year: 2024, month: 3, day: 1 }, -1)).toEqual({ year: 2024, month: 2, day: 29 })
    expect(shiftDay({ year: 2023, month: 3, day: 1 }, -1)).toEqual({ year: 2023, month: 2, day: 28 })
  })

  it('跨年时回退到上一年', () => {
    expect(shiftDay({ year: 2024, month: 1, day: 1 }, -1)).toEqual({ year: 2023, month: 12, day: 31 })
  })

  it('正向平移同样跨月', () => {
    expect(shiftDay({ year: 2024, month: 12, day: 31 }, 1)).toEqual({ year: 2025, month: 1, day: 1 })
  })
})

describe('inferDiaryDate', () => {
  const published = (publishedAt, overrides = {}) => ({
    ...parseName(`${publishedAt}-Cx1y2Z3aB4c.jpg`),
    ...overrides,
  })

  it('无 OCR 时取发布日前一天，同月不提示 rollover', () => {
    const { inferred, rollover } = inferDiaryDate(published('2024-05-10'))
    expect(inferred).toEqual({ year: 2024, month: 5, day: 9 })
    expect(rollover).toBe('')
  })

  it('发布日是月初时提示跨月', () => {
    const { inferred, rollover } = inferDiaryDate(published('2024-03-01'))
    expect(inferred).toEqual({ year: 2024, month: 2, day: 29 })
    expect(rollover).toBe('month')
  })

  it('发布日是一月一日时提示跨年', () => {
    const { inferred, rollover } = inferDiaryDate(published('2024-01-01'))
    expect(inferred).toEqual({ year: 2023, month: 12, day: 31 })
    expect(rollover).toBe('year')
  })

  it('OCR 候选优先于发布日期推断', () => {
    const { inferred, rollover } = inferDiaryDate(published('2024-05-10'), {
      year: 2024,
      month: 4,
      day: 28,
    })
    expect(inferred).toEqual({ year: 2024, month: 4, day: 28 })
    expect(rollover).toBe('month')
  })

  it('日期未知时返回全零且不提示 rollover', () => {
    const { inferred, rollover } = inferDiaryDate(parseName('unknown-scan.jpg'))
    expect(inferred).toEqual({ year: 0, month: 0, day: 0 })
    expect(rollover).toBe('')
  })
})
