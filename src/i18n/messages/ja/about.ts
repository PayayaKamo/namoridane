import type { AboutMessages } from '../zh/about'

export const about: AboutMessages = {
  eyebrow: 'About',
  title: 'このサイトについて',
  lead: 'Namori Diary は、Namori（@namoridane）が Instagram に投稿した手描きの絵日記を収録し、日付・キャラクター・タグ・翻訳を整理して、時期やテーマから閲覧・検索・模写できるサイトです。',
  findMe: 'リンク',
  links: {
    github: { label: 'GitHub プロフィール', desc: 'アカウントと日々の更新' },
    repository: { label: 'サイトのリポジトリ', desc: 'このサイトのソースとデータ処理' },
    xiaohongshu: { label: '小红书 · @PayaYa', desc: '絵日記のアーカイブと素材共有' },
    xiaohongshuAlt: { label: '小红书 · @PayayaKamo', desc: 'Web 制作・テック・イラスト' },
    wechat: {
      label: 'WeChat 公式アカウント · @PayapayaYa',
      desc: '更新のお知らせと制作の裏側',
      hint: 'ホバーまたはクリックで QR コードを表示',
      qrAlt: 'PayapayaYa の WeChat 公式アカウント QR コード',
    },
  },
  site: {
    title: 'サイト情報',
    version: 'バージョン',
    buildTime: 'ビルド日時',
    works: '収録作品',
    years: '収録年',
    characters: 'キャラクター',
    tags: 'タグ',
    note: 'データは Instagram の公開投稿に基づくもので、閲覧・学習・模写の参考用です。',
  },
}
