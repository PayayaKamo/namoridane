export const lib = {
  newCharacter: '新角色',
  newCollection: '未命名合集',
  newStoryline: '未命名故事线',
  seedNotFound: '没有找到种子数据（public/data/userdata.seed.json）',
  seedMerged: '已合并仓库种子标注',
  annotationsCleared: '本地标注已清空',
  imageLoadFailed: '图片加载失败：{src}',
  originalLoadFailed: '原图读取失败：{file}',
  seo: {
    itemTitle: 'Namori 绘日记 {date} · {site}',
    itemTitleNoDate: 'Namori 绘日记 · {site}',
  },
  search: {
    date: '日期',
    publishedAt: '发布日',
    source: '原文',
    sourceDraft: '原文草稿',
    translation: '翻译',
    translationSlot: '翻译 · {name}',
    caption: '文案',
    shortcode: '短码',
    file: '文件名',
    character: '人物',
    tag: '标签',
    note: '备注',
    collection: '合集',
    study: '拆解备注',
  },
  studyFields: {
    composition: { label: '构图', hint: '主体位置、留白、视线引导、视角' },
    palette: { label: '配色', hint: '主色、辅助色、冷暖对比' },
    linework: { label: '线条', hint: '粗细变化、笔触、收尾方式' },
    expression: { label: '表情 / 神态', hint: '五官比例、情绪、动态' },
    memo: { label: '自由备注', hint: '其他想记下的点' },
  },
}

export type LibMessages = typeof lib
