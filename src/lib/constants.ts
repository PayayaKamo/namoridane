import type { Dimension, StudyNotes, Tag } from '../types'

/** 内置标签维度，可在界面里改名或新增自定义维度 */
export const BUILTIN_DIMENSIONS: Dimension[] = [
  { id: 'character', name: '人物 / 角色', order: 0, builtIn: true },
  { id: 'scene', name: '使用场景', order: 1, builtIn: true },
  { id: 'mood', name: '情绪', order: 2, builtIn: true },
  { id: 'element', name: '画面元素', order: 3, builtIn: true },
  { id: 'technique', name: '技法', order: 4, builtIn: true },
]

export const EXTRA_DIMENSIONS: Dimension[] = [
  { id: 'custom', name: '其他', order: 5, builtIn: true },
]

export const TAG_COLORS = [
  '#b0553b',
  '#c07a3e',
  '#b68a4b',
  '#7d8a52',
  '#5f7663',
  '#4f7f7a',
  '#5b7f9c',
  '#6d6c9c',
  '#8d6a92',
  '#a45c76',
  '#8a6a4f',
  '#6f6a5f',
]

/** 预置主要角色、家属与《大室家》同学；稳定 id 便于跨设备合并 JSON。 */
export const CHARACTER_PRESETS = [
  { id: 'char_akaza_akari', name: '赤座灯里', color: '#b0553b', series: '摇曳百合' },
  { id: 'char_toshinou_kyouko', name: '岁纳京子', color: '#c07a3e', series: '摇曳百合' },
  { id: 'char_funami_yui', name: '船见结衣', color: '#5f7663', series: '摇曳百合' },
  { id: 'char_yoshikawa_chinatsu', name: '吉川千夏', color: '#a45c76', series: '摇曳百合' },
  { id: 'char_sugiura_ayano', name: '杉浦绫乃', color: '#8d6a92', series: '摇曳百合' },
  { id: 'char_ikeda_chitose', name: '池田千岁', color: '#5b7f9c', series: '摇曳百合' },
  { id: 'char_oomuro_sakurako', name: '大室樱子', color: '#b68a4b', series: '摇曳百合' },
  { id: 'char_furutani_himawari', name: '古谷向日葵', color: '#6d6c9c', series: '摇曳百合' },
  { id: 'char_oomuro_nadeshiko', name: '大室抚子', color: '#4f7f7a', series: '大室家' },
  { id: 'char_oomuro_hanako', name: '大室花子', color: '#7d8a52', series: '大室家' },
  { id: 'char_matsumoto_rise', name: '松本理世', color: '#8a6a4f', series: '相关角色' },
  { id: 'char_nishigaki_nana', name: '西垣奈奈', color: '#6f6a5f', series: '相关角色' },
  { id: 'char_furutani_kaede', name: '古谷枫', color: '#b68a4b', series: '相关角色' },
  { id: 'char_akaza_akane', name: '赤座茜', color: '#b0553b', series: '相关角色' },
  { id: 'char_yoshikawa_tomoko', name: '吉川友子', color: '#a45c76', series: '相关角色' },
  { id: 'char_ikeda_chizuru', name: '池田千鹤', color: '#5b7f9c', series: '相关角色' },
  { id: 'char_funami_mari', name: '船见真理', color: '#4f7f7a', series: '相关角色' },
] as const

export function defaultCharacterTags(): Tag[] {
  return CHARACTER_PRESETS.map((character) => ({
    id: character.id,
    name: character.name,
    dimensionId: 'character',
    color: character.color,
    createdAt: '2026-01-01T00:00:00.000Z',
  }))
}

const PRESET_AVATAR_IDS: ReadonlySet<string> = new Set(CHARACTER_PRESETS.map((character) => character.id))

/** 预置角色在 public/characters/<id>.webp 有占位头像；用户新增角色返回 null */
export function presetAvatarPath(tagId: string): string | null {
  return PRESET_AVATAR_IDS.has(tagId) ? `characters/${tagId}.webp` : null
}

export const STUDY_FIELDS: { key: keyof StudyNotes; label: string; hint: string }[] = [
  { key: 'composition', label: '构图', hint: '主体位置、留白、视线引导、视角' },
  { key: 'palette', label: '配色', hint: '主色、辅助色、冷暖对比' },
  { key: 'linework', label: '线条', hint: '粗细变化、笔触、收尾方式' },
  { key: 'expression', label: '表情 / 神态', hint: '五官比例、情绪、动态' },
  { key: 'memo', label: '自由备注', hint: '其他想记下的点' },
]

export const STICKER_SIZES = [240, 512] as const

export const EMPTY_STUDY: StudyNotes = {
  composition: '',
  palette: '',
  linework: '',
  expression: '',
  memo: '',
}
