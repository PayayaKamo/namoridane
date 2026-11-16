import type { Dimension, StudyNotes } from '../types'

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
