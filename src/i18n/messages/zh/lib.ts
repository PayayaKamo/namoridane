export const lib = {
  newCharacter: '新角色',
  newCollection: '未命名合集',
  newStoryline: '未命名故事线',
  seedNotFound: '没有找到种子数据（public/data/userdata.seed.json）',
  seedMerged: '已合并仓库种子标注',
  annotationsCleared: '本地标注已清空',
  imageLoadFailed: '图片加载失败：{src}',
  originalLoadFailed: '原图读取失败：{file}',
  studyFields: {
    composition: { label: '构图', hint: '主体位置、留白、视线引导、视角' },
    palette: { label: '配色', hint: '主色、辅助色、冷暖对比' },
    linework: { label: '线条', hint: '粗细变化、笔触、收尾方式' },
    expression: { label: '表情 / 神态', hint: '五官比例、情绪、动态' },
    memo: { label: '自由备注', hint: '其他想记下的点' },
  },
}

export type LibMessages = typeof lib
