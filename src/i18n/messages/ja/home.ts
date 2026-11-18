import type { HomeMessages } from '../zh/home'

export const home: HomeMessages = {
  hero: {
    eyebrow: 'Namori Diary · 2021 — 2025',
    srTitle: 'Namori Diary · ',
    title: '毎日を、1ページの絵に。',
    lead: 'Namori 先生が Instagram に投稿した手描き日記 {count} 枚を収録。カレンダーからめくったり、キャラクターや場面で整理したり、模写の分解や登場人物を書き留めることもできます。',
    startReading: 'めくりはじめる',
    openCalendar: 'カレンダーを見る',
    openGallery: 'ギャラリーへ',
  },
  daily: {
    label: '今日の1枚',
    imageAlt: 'Namori Diary {date} の今日の1枚',
    fromPastYear: '過去の今日 · {date} 投稿',
    shuffle: '別の1枚',
  },
  empty: {
    publicTitle: '内容を整理しています',
    publicHint: '絵日記はまだ整理中です。また後でのぞいてみてください。',
    localTitle: 'まだ画像がありません',
    localHintBefore: '解凍し直した Instagram 保存ページのフォルダを取り込んでください：',
    localHintAfterImport: '、続けて ',
    localHintAfterData: '（または ',
    localHintAfterDev: '）を実行すると索引と派生画像が作られます。注釈は現在のデータセット版に紐づき、データを差し替えると古い記録は無効になります。',
  },
  stats: {
    total: '総枚数',
    totalHint: '画像内の日記日付で整理、絵日記以外は除外済み',
    years: '収録年',
    tagged: 'タグ付け済み',
    taggedHint: '全 {count} 個のタグ、{uses} 回使用',
    pending: '日付未校正',
    pendingHint: '{count} 枚確認済み',
    favoritesHint: '詳細ページでハートをタップ',
    collectionsHint: '模写参考 / 場面分け',
  },
  years: {
    title: '年別の収録数',
    viewStats: '統計を見る',
    barTitle: '{year} · {count} 枚',
  },
  topTags: {
    title: 'よく使うタグ',
    manage: '管理',
  },
  quick: {
    title: 'クイックアクセス',
    calendar: { title: 'カレンダー', desc: '月ごとに毎日何を描いたか見る' },
    gallery: { title: 'ギャラリー', desc: '無限スクロールで眺めてまとめて整理' },
    characters: { title: 'キャラクター図鑑', desc: '人物ごとにまとめた登場作品' },
    review: { title: '日付の校正', desc: '手書きの日付と投稿日を照合' },
    collections: { title: 'コレクション', desc: 'お気に入りを同じ冊子に' },
  },
}
