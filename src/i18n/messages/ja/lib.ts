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
  studyFields: {
    composition: { label: '構図', hint: '被写体の位置、余白、視線誘導、視点' },
    palette: { label: '配色', hint: 'メインカラー、サブカラー、暖冷の対比' },
    linework: { label: '線', hint: '太さの変化、筆致、線の終わり方' },
    expression: { label: '表情 / 仕草', hint: '顔の比率、感情、動き' },
    memo: { label: '自由メモ', hint: 'その他メモしておきたいこと' },
  },
}
