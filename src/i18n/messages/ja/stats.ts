import type { StatsMessages } from '../zh/stats'

export const stats: StatsMessages = {
  overview: {
    subtitle: '{from} — {to} · 全 {count} 枚（{posts} 件の投稿）',
  },
  cards: {
    works: '作品',
    multiPosts: 'うち複数枚の投稿 {count} 枚',
    drawingDays: '絵を描いた日',
    longestStreak: '最長 {count} 日連続',
    tagged: '分類済み',
    tagsCount: 'タグ {count} 個',
    tagsAndCollections: 'タグ {tags} 個 · コレクション {collections} 個',
    characters: 'キャラクター登場',
    charactersHint: '{count} 人のキャラクターが登場',
    confirmedDates: '日付確認済み',
    pendingReview: '要確認 {count}',
    favorites: 'お気に入り / メモ',
    favoritesHint: '分解またはメモ {count} 枚',
  },
  monthly: {
    title: '月別の枚数',
    barTooltip: '{month} · {count} 枚 · {days} 日',
    hint: '濃いバーは作品数。カーソルを合わせると、その月に絵を描いた日数が見られます。',
  },
  yearly: {
    title: '年間の概要',
    average: '1 日あたり',
    span: '期間',
    localNotes: 'ローカル注釈',
    records: '{count} 件の記録',
  },
  tags: {
    title: 'タグの分布',
    subtitle: 'ディメンション別 · すべてのタグ',
    groupCount: '{items} 件 · {uses} 回',
    barTooltip: '{name} · {count} 回 · クリックで関連作品へ',
    emptyPublic: '表示できるタグの分布はまだありません。',
    empty: 'タグはまだ使われていません。ギャラリーで作品を複数選んでタグを付けると、ここに分布が表示されます。',
  },
  castRank: {
    title: 'キャラクター登場ランキング',
    subtitle: '{characters} 人 · 累計 {count} 回登場',
    count: '{count} 回 · {percent}',
    empty: '公開されているキャラクター登場記録はまだありません。',
  },
  cast: {
    title: 'キャラクターの組み合わせ',
    subtitlePublic: '公開の絵日記のみ集計 · 人物タグ付き {count} 枚',
    subtitle: '確認済みの絵日記のみ集計 · 人物タグ付き {count} 枚',
    single: '一人',
    singleHint: '1 人だけ登場',
    double: '二人',
    doubleHint: 'CP のペア',
    multi: '複数人',
    multiHint: '3 人以上',
    countPercent: '{count} 枚 · {percent}',
    singleNote:
      '定義：1 枚にそのキャラクターだけが登場する枚数を数え、1 枚につき 1 回とします。二人・複数人と合わせると、人物タグ付きの {total} 枚になります。',
    doubleNote:
      '定義：同じ絵の中のキャラクターを 2 人ずつ組み合わせます。3 人以上は複数の組に分かれる（3 人なら 3 組）ため、割合は「2 人以上タグ付きの {count} 枚」を分母とし、合計が 100% を超えることがあります。全体の群像は「複数人」で確認してください。',
    multiNote:
      '定義：組全体で数えます（A × B × C で 1 組、1 枚につき 1 回）。3 人を 3 組に分ける「二人」タブのペア集計とは異なります。',
    singleEmptyPublic: '1 人だけ登場する公開タグはまだありません。',
    singleEmpty: '「1 人だけ登場」のタグはまだありません。1 人のキャラクターだけの絵日記に人物タグを付けると、ここにランキングが表示されます。',
    doubleEmptyPublic: '表示できる二人の組み合わせはまだありません。',
    doubleEmpty: 'ペアにできる登場タグがまだありません。確認済みの絵日記に 2 人以上のキャラクターが付くと、ここに組み合わせが表示されます。',
    multiEmptyPublic: '3 人以上の公開群像はまだありません。',
    multiEmpty: '3 人以上の群像タグはまだありません。複数のキャラクターをタグ付けすると、組全体が枚数順に表示されます。',
  },
  characterTooltip: '「{name}」のキャラクター図鑑を見る',
}
