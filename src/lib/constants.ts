import type { CharacterProfile, Dimension, StudyNotes, Tag } from '../types'
import { translate } from '../i18n/core'

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
  { id: 'char_toushi_hoko', name: '东志帆子', color: '#8d6a92', series: '相关角色' },
  { id: 'char_kitamiya_hatsumi', name: '北宫初美', color: '#5b7f9c', series: '相关角色' },
  { id: 'char_minamino_tsubasa', name: '南野翼', color: '#7d8a52', series: '相关角色' },
  { id: 'char_furutani_kaede', name: '古谷枫', color: '#b68a4b', series: '相关角色' },
  { id: 'char_akaza_akane', name: '赤座茜', color: '#b0553b', series: '相关角色' },
  { id: 'char_yoshikawa_tomoko', name: '吉川友子', color: '#a45c76', series: '相关角色' },
  { id: 'char_ikeda_chizuru', name: '池田千鹤', color: '#5b7f9c', series: '相关角色' },
  { id: 'char_funami_mari', name: '船见真理', color: '#4f7f7a', series: '相关角色' },
] as const

/** 预置角色资料；用户在编辑面板保存后写入 characters[].profile 覆盖这里 */
export const CHARACTER_PROFILES: Readonly<Record<string, CharacterProfile>> = {
  char_nishigaki_nana: {
    cv: '白石凉子',
    role: '理科老师、科学家',
    traits:
      '热衷科学实验，但经常在学校里引起爆炸；和学生会长松本理世关系很好，自称其为「爆友」，也是全校唯一能听懂并正常与寡言的松本理世交流的人。',
  },
  char_toushi_hoko: {
    cv: '桥本千波',
    role: '美术老师',
    traits: '总是笑脸迎人，非常有亲和力；与西垣奈奈是高中同学，关系十分要好，一直很想为奈奈画像。',
  },
  char_kitamiya_hatsumi: {
    cv: '新井里美',
    role: '家庭经济课老师',
    traits: '',
  },
  char_minamino_tsubasa: {
    cv: '渡部优衣',
    role: '',
    traits: '',
  },
}

/** 缺省时回退到预置资料，避免旧数据没有 profile 字段时卡片空白 */
export function presetCharacterProfile(id: string): CharacterProfile | undefined {
  return CHARACTER_PROFILES[id]
}

export function defaultCharacterTags(): Tag[] {
  return CHARACTER_PRESETS.map((character) => ({
    id: character.id,
    name: character.name,
    dimensionId: 'character',
    color: character.color,
    createdAt: '2026-01-01T00:00:00.000Z',
  }))
}

/** 只有这些预置角色在 public/characters/<id>.webp 有占位头像；其余用首字占位 */
const PRESET_AVATAR_IDS: ReadonlySet<string> = new Set([
  'char_akaza_akari',
  'char_toshinou_kyouko',
  'char_funami_yui',
  'char_yoshikawa_chinatsu',
  'char_sugiura_ayano',
  'char_ikeda_chitose',
  'char_oomuro_sakurako',
  'char_furutani_himawari',
  'char_oomuro_nadeshiko',
  'char_oomuro_hanako',
  'char_matsumoto_rise',
  'char_nishigaki_nana',
  'char_furutani_kaede',
  'char_akaza_akane',
  'char_yoshikawa_tomoko',
  'char_ikeda_chizuru',
  'char_funami_mari',
])

const CHARACTER_PRESET_ORDER: ReadonlyMap<string, number> = new Map(
  CHARACTER_PRESETS.map((character, index) => [character.id, index]),
)

/** 角色统一排序：预置角色按定义顺序，自定义角色排在后面按添加时间；图鉴、芯片与选择器共用 */
export function compareCharacterTags(a: Tag, b: Tag): number {
  const ai = CHARACTER_PRESET_ORDER.get(a.id)
  const bi = CHARACTER_PRESET_ORDER.get(b.id)
  if (ai !== undefined || bi !== undefined) {
    if (ai === undefined) return 1
    if (bi === undefined) return -1
    return ai - bi
  }
  return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)
}

export function sortCharacterTags(tags: Tag[]): Tag[] {
  return [...tags].sort(compareCharacterTags)
}

/** 预置角色在 public/characters/<id>.webp 有占位头像；用户新增角色返回 null */
export function presetAvatarPath(tagId: string): string | null {
  return PRESET_AVATAR_IDS.has(tagId) ? `characters/${tagId}.webp` : null
}

export function studyFields(): { key: keyof StudyNotes; label: string; hint: string }[] {
  return [
    {
      key: 'composition',
      label: translate('lib.studyFields.composition.label'),
      hint: translate('lib.studyFields.composition.hint'),
    },
    {
      key: 'palette',
      label: translate('lib.studyFields.palette.label'),
      hint: translate('lib.studyFields.palette.hint'),
    },
    {
      key: 'linework',
      label: translate('lib.studyFields.linework.label'),
      hint: translate('lib.studyFields.linework.hint'),
    },
    {
      key: 'expression',
      label: translate('lib.studyFields.expression.label'),
      hint: translate('lib.studyFields.expression.hint'),
    },
    {
      key: 'memo',
      label: translate('lib.studyFields.memo.label'),
      hint: translate('lib.studyFields.memo.hint'),
    },
  ]
}

export const STICKER_SIZES = [240, 512] as const

export const EMPTY_STUDY: StudyNotes = {
  composition: '',
  palette: '',
  linework: '',
  expression: '',
  memo: '',
}
