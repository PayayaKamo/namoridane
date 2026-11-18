import type { LibMessages } from '../zh/lib'

export const lib: LibMessages = {
  newCharacter: '新規キャラクター',
  newCollection: '無題のコレクション',
  newStoryline: '無題のストーリー',
  seedNotFound: 'シードデータが見つかりません（public/data/userdata.seed.json）',
  seedMerged: 'リポジトリのシード注釈を統合しました',
  annotationsCleared: 'ローカル注釈をクリアしました',
  imageLoadFailed: '画像の読み込みに失敗しました：{src}',
  originalLoadFailed: '元画像の読み込みに失敗しました：{file}',
  seo: {
    itemTitle: 'Namori 絵日記 {date} · {site}',
    itemTitleNoDate: 'Namori 絵日記 · {site}',
  },
  search: {
    date: '日付',
    publishedAt: '投稿日',
    source: '原文',
    sourceDraft: '原文の下書き',
    translation: '翻訳',
    translationSlot: '翻訳 · {name}',
    caption: 'キャプション',
    shortcode: 'ショートコード',
    file: 'ファイル名',
    character: '人物',
    tag: 'タグ',
    note: 'メモ',
    collection: 'コレクション',
    study: '模写メモ',
  },
  studyFields: {
    composition: { label: '構図', hint: '被写体の位置、余白、視線誘導、視点' },
    palette: { label: '配色', hint: 'メインカラー、サブカラー、暖冷の対比' },
    linework: { label: '線', hint: '太さの変化、筆致、線の終わり方' },
    expression: { label: '表情 / 仕草', hint: '顔の比率、感情、動き' },
    memo: { label: '自由メモ', hint: 'その他メモしておきたいこと' },
  },
}
