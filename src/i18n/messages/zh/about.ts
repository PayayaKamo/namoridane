// AboutView 文案
export const about = {
  eyebrow: 'About',
  title: '关于本站',
  lead: '水母绘日记 · Namori Diary 收录 Namori（@namoridane）发布在 Instagram 的手绘绘日记，整理日期、角色、标签与翻译，方便按时间与主题翻阅、检索和临摹。',
  findMe: '找到我',
  links: {
    github: { label: 'GitHub 主页', desc: '账号主页与日常更新' },
    repository: { label: '站点仓库', desc: '本站源码与数据管线' },
    xiaohongshu: { label: '小红书 · @PayaYa', desc: '绘日记归档与资源分享' },
    xiaohongshuAlt: { label: '小红书 · @PayayaKamo', desc: '网站开发、科技与绘画' },
    wechat: {
      label: '微信公众号 · @PayapayaYa',
      desc: '更新提醒与幕后记录',
      hint: '悬浮或点击查看二维码',
      qrAlt: 'PayapayaYa 微信公众号二维码',
    },
  },
  site: {
    title: '本站信息',
    version: '版本号',
    buildTime: '构建时间',
    works: '收录作品',
    years: '覆盖年份',
    characters: '角色',
    tags: '标签',
    note: '数据来自 Instagram 公开帖文，仅供浏览、学习与临摹参考。',
  },
}

export type AboutMessages = typeof about
