// HomeView 文案
export const home = {
  hero: {
    eyebrow: 'Namori · 水母绘日记 2021 — 2025',
    srTitle: '水母绘日记 · Namori Diary · ',
    title: '把每一天，画成一页。',
    lead: '收录 Namori 老师发布在 Instagram 的 {count} 张手绘日记。在这里按日历翻阅、按角色与场景整理，也可以记录临摹拆解与出场人物。',
    startReading: '开始翻阅',
    openCalendar: '看日历',
    openGallery: '进入图库',
  },
  daily: {
    label: '每日一图',
    imageAlt: 'Namori 水母绘日记 {date} 每日一图',
    fromPastYear: '往年今日 · {date} 发布',
    shuffle: '换一张',
  },
  empty: {
    publicTitle: '内容正在整理',
    publicHint: '绘日记还在整理中，稍后再来看看。',
    localTitle: '还没有图片',
    localHintBefore: '把重新解压的 Instagram 保存页目录导入：',
    localHintAfterImport: '，再运行 ',
    localHintAfterData: '（或 ',
    localHintAfterDev: '）生成索引和衍生图。标注会绑定当前数据集版本，换数据后旧记录自动作废。',
  },
  stats: {
    total: '总张数',
    totalHint: '按图内日记日期整理，已排除非绘日记',
    years: '覆盖年份',
    tagged: '已打标签',
    taggedHint: '共 {count} 个标签，{uses} 次使用',
    pending: '待校对日期',
    pendingHint: '已确认 {count} 张',
    favoritesHint: '在详情页点按爱心',
    collectionsHint: '临摹参考 / 场景分组',
  },
  years: {
    title: '各年份收录',
    viewStats: '查看统计',
    barTitle: '{year} · {count} 张',
  },
  topTags: {
    title: '常用标签',
    manage: '管理',
  },
  quick: {
    title: '快捷入口',
    calendar: { title: '日历', desc: '按月份查看每天画了什么' },
    gallery: { title: '图库', desc: '瀑布流浏览与批量整理' },
    characters: { title: '角色图鉴', desc: '按人物聚合的所有出场' },
    review: { title: '日期校对', desc: '核对手写日期与发布日' },
    collections: { title: '合集', desc: '把喜欢的收进同一本册子' },
  },
}

export type HomeMessages = typeof home
