# Namori 絵日記 · 閲覧と整理

[English](README.md) · [中文](README.zh-CN.md)

Namori さん（Instagram [@namori__](https://www.instagram.com/namori__/)）の「絵日記」イラストを閲覧・検索・整理するための、完全に静的なフロントエンドのみのサイトです。

- **既定では空のアーカイブ**：旧画像セットは同梱されません。`npm run import -- "<dir>"` で新しいフォルダを取り込みます。パイプラインは過去の 1,086 枚（2021-03 → 2025）で検証済み
- オリジナル JPG の単体ダウンロードと、複数選択の ZIP 一括ダウンロード
- 1 つのコードベースから 2 つの成果物：ローカル用 **admin** とファン向け読み取り専用 **public**
- ローカルファースト：注釈はブラウザの `localStorage` に保存され、JSON で入出力できます
- バックエンド・データベース・アカウント不要。GitHub Pages に置ける静的ファイルを出力
- UI は中国語。1280 / 1440 / 1024 を優先し、ライト / ダークテーマに対応

---

## クイックスタート

```bat
:: Windows ワンクリック起動（初回は依存関係のインストール、インデックス生成、ブラウザ起動）
start.cmd
```

手動の場合：

```bash
npm install
npm run dev          # インデックスを増分生成して http://localhost:5173/ を起動
npm run build:admin  # ローカル管理版 -> dist/
npm run build:public # ファン向け公開版 -> dist/
npm run preview      # 直近のビルドをプレビュー
```

Node.js 18+ が必要です。

`images/original/` が空でも両方のビルドは成功し、サイトには「还没有图片」の空状態と取り込みコマンドが表示されます。レビューと注釈はデータセット版に紐づき、新しいデータセットを取り込むと古い注釈は自動的に無効になります。

### npm scripts

| コマンド | 内容 |
| --- | --- |
| `npm run data` | 原本を走査し、サムネイル・大画像・`index.json`・シードを増分生成 |
| `npm run data:force` | キャッシュを無視して全再生成 |
| `npm run import -- "<dir>"` | 新しい画像フォルダをインポート（ハッシュ重複排除・命名・統合） |
| `npm run ocr` | 任意：Windows 専用の軽量 OCR で日付候補を事前入力 |
| `npm run dev` | `data` を実行して Vite 開発サーバーを起動（admin モード） |
| `npm run build:admin` | 管理版：`data` + 型チェック + `vite build --mode admin` |
| `npm run build:public` | 公開版：`data --mode=public` + 型チェック + `vite build --mode public` |
| `npm run purge` | `images/_trash/` の原本を完全削除 |
| `npm run preview` | `dist/` をプレビュー |
| `npm run deploy` | `build:public` 後に `gh-pages` ブランチへ push |

---

## 2 つのビルド、1 つのコードベース

`vite build` は `--mode admin|public` を受け取り、モードはコンパイル時定数 `__APP_MODE__` として注入されます。

| | `build:admin` | `build:public` |
| --- | --- | --- |
| 用途 | ローカル管理用 | ファン向け（GitHub Pages） |
| レビュー・日付の手入力 | あり | なし |
| タグ / 人物の編集 | あり | なし |
| 翻訳の編集 | あり | 読み取り専用 |
| ストーリーの編集 | あり | 読み取り専用 |
| コレクション・入出力・除外エリア・一括操作 | あり | なし |
| 削除 / ゴミ箱 / パージ | あり | 関連パスやエンドポイント自体が存在しない |
| 未確認の日付 | レビュー用に推測として表示 | 「未标注」または非表示 |

管理用ビューはコンパイル時の条件で遅延読み込みされるため、公開版には管理ルート・フォーム・削除エンドポイント・入出力コードが含まれません。非表示は CSS ではなくコンポーネント単位で行います。

### 公開サイトへのデータ公開

公開版はブラウザのデータを読まず、リポジトリのシード `data/public.json` を読みます。

1. 管理版の **数据与设置 → 发布数据** で **导出发布数据 public.json** をクリック。
2. ダウンロードしたファイルを `data/public.json` に置いてコミット。
3. `build:public` を実行 / push（GitHub Actions が `main` で自動実行）。

書き出しには手動確認済みの日付、公開ストーリー、翻訳、タグ、人物エンティティのみが残り、私的なメモ・お気に入り・非絵日記・削除済み画像は除外されます。ローカルデータが最後の書き出しより新しい場合、管理画面に **有未发布的修改** と表示されます。

---

## ディレクトリ構成

```
namori-diary/
├─ images/
│  ├─ original/             # 画像アーカイブ（リセット後は空、npm run import で填充）
│  └─ _trash/               # 削除待ちの原本（gitignore）
├─ data/
│  ├─ public.json           # 公開版が読むシード（コミット対象）
│  ├─ userdata.example.json # 管理版シードの schema 例
│  └─ ocr.json              # 任意の OCR 結果（コミット対象、管理版のみ）
├─ public/
│  ├─ images/thumb/         # 480px WebP サムネイル（生成物、gitignore）
│  ├─ images/large/         # 1400px WebP 大画像（生成物、gitignore）
│  ├─ images/original/      # ダウンロード用原本コピー（生成物、gitignore）
│  └─ data/index.json       # 作品インデックス（生成物、gitignore）
├─ scripts/
│  ├─ build-index.mjs       # データパイプライン
│  ├─ import-images.mjs     # 新規画像の増分インポート
│  ├─ ocr-dates.mjs         # 任意の日付 OCR（Windows のみ）
│  ├─ ocr-windows.ps1       # PowerShell WinRT OCR ヘルパー
│  └─ purge-trash.mjs       # images/_trash を完全削除
├─ src/
│  ├─ components/           # Layout / ItemCard / TagPicker / DateEditor / StickerEditor ...
│  ├─ lib/                  # ルーター、日付、フィルター、保存、公開、ゴミ箱、canvas
│  ├─ state/store.tsx       # グローバル状態と localStorage
│  ├─ views/                # ホーム、カレンダー、ギャラリー、詳細、レビュー、日付検索、
│  │                        # 人物、ストーリー、翻訳パネル、ステッカー、統計、データ
│  ├─ styles.css
│  └─ styles-views.css
├─ start.cmd
├─ vite.config.ts
└─ .github/workflows/deploy.yml
```

---

## 原本の取得元と命名

`scripts/build-index.mjs` は次の順で原本ディレクトリを探します。

1. CLI 引数：`--src="D:\path\to\images"`
2. 環境変数：`NAMORI_SRC`
3. リポジトリ内：`images/original/`（空なら自動作成）

古い隣接フォルダへの自動フォールバックはありません。リセット後は新しい取り込みまで空のままです。

ファイル名は追跡可能である必要があります。

```
YYYY-MM-DD-<11文字の shortcode>[-n].jpg
unknown-<元のファイル名>.jpg
```

日付プレフィックスは Instagram の**投稿日**（`publishedAt`）です。複数枚投稿は `-0 / -1 / …` の接尾辞を使い、`postCount` と安定した `id` を計算します。

### 日付ルール

- 投稿日はファイル名から取得します。
- 絵の中に手書きされた日記日付は**人が確認**します。無言で推測しません。
- ビルド時の OCR は最大 3 つの候補と信頼度を出し、年は投稿日に最も近いものを推定します。OCR はあくまでヒントです。
- OCR 結果がない場合、レビュー画面は**投稿日 − 1 日**を事前入力し、**推测**と明示します。
- `data/public.json` に書き出されるのは確認済みの日付のみです。公開サイトは推測を日付として表示しません。

---

## データ構造

### 1. 作品インデックス `public/data/index.json`

生成物で、フロントエンドは読み取り専用（`version: 6`）：

```jsonc
{
  "version": 6,
  "generatedAt": "2026-11-17T00:00:00.000Z",
  "datasetId": "1f2e3d4c5b6a",
  "count": 1086,
  "years": { "2021": 242, "2022": 325, "2023": 154, "2024": 308, "2025": 1 },
  "items": [
    {
      "id": "2021-06-01-CPlLQUStuZq",
      "shortcode": "CPlLQUStuZq",
      "file": "2021-06-01-CPlLQUStuZq.jpg",
      "postIndex": 0,
      "postCount": 1,
      "publishedAt": "2021-06-01",
      "dateKnown": true,
      "inferredMonth": 5,
      "inferredDay": 31,
      "inferredYear": 2021,
      "thumb": "images/thumb/2021-06-01-CPlLQUStuZq.webp",
      "large": "images/large/2021-06-01-CPlLQUStuZq.webp",
      "original": "images/original/2021-06-01-CPlLQUStuZq.jpg",
      "bytes": 138118,
      "w": 1080,
      "h": 1350,
      "palette": ["#f2e9df", "#c9a227", "..."],
      "color": "#e8dccb",
      "ocr": { "rawText": "5月31日", "candidates": [] },
      "suggestedDiaryDate": { "year": 2021, "month": 5, "day": 31 }
    }
  ]
}
```

公開モードでは `inferred*`、`ocr`、`suggestedDiaryDate` は削除されます。

### 2. ユーザーデータ v2 — `localStorage` / 入出力

保存キー：`namori.diary.userdata.v2`。型は [`src/types.ts`](src/types.ts)。

```jsonc
{
  "version": 2,
  "updatedAt": "2026-11-17T00:00:00.000Z",
  "datasetId": "1f2e3d4c5b6a",
  "dimensions": [{ "id": "character", "name": "人物/角色", "order": 0, "builtIn": true }],
  "tags": [{ "id": "t_xxx", "name": "小魔女", "dimensionId": "character", "color": "#c96f4a", "createdAt": "..." }],
  "characters": [{
    "id": "t_xxx",
    "avatarItemId": "2021-06-01-CPlLQUStuZq",
    "avatarCrop": { "cx": 0.5, "cy": 0.5, "size": 1, "tolerance": 18, "transparent": true },
    "note": "",
    "createdAt": "..."
  }],
  "collections": [{
    "id": "c_xxx",
    "name": "表情包素材",
    "description": "",
    "coverItemId": "2021-06-01-CPlLQUStuZq",
    "itemIds": ["2021-06-01-CPlLQUStuZq"],
    "createdAt": "...",
    "updatedAt": "..."
  }],
  "storylines": [{
    "id": "story_xxx",
    "title": "夏日的一周",
    "description": "",
    "coverItemId": "2021-06-01-CPlLQUStuZq",
    "blocks": [
      { "id": "block_1", "type": "image", "itemId": "2021-06-01-CPlLQUStuZq" },
      { "id": "block_2", "type": "note", "text": "第二章：雨天" }
    ],
    "tags": ["夏天"],
    "published": true,
    "createdAt": "...",
    "updatedAt": "..."
  }],
  "items": {
    "2021-06-01-CPlLQUStuZq": {
      "tags": ["t_xxx"],
      "favorite": true,
      "reviewed": true,
      "excluded": false,
      "deleted": false,
      "note": "自由メモ",
      "date": { "year": 2021, "month": 5, "day": 31, "confirmed": true, "source": "manual" },
      "translation": {
        "source": "今日はいい天気ですね",
        "sourceDraft": "今日はいい天気ですね",
        "slots": [{ "lang": "zh", "label": "中文", "text": "今天天气真好" }],
        "updatedAt": "..."
      },
      "study": { "composition": "", "palette": "", "linework": "", "expression": "", "memo": "" },
      "crop": { "cx": 0.5, "cy": 0.45, "size": 0.8, "tolerance": 18, "transparent": true },
      "updatedAt": "..."
    }
  }
}
```

- レビュー状態は `reviewed` と `excluded` の組み合わせ：`false/false` 未確認、`true/false` 絵日記、`true/true` 非絵日記。
- `deleted` はすべてのビューと公開シードから除外します。原本は先に `images/_trash/` へ移動します。
- `date.source`：`inferred` / `published` / `manual`。公開サイトに日付が出るのは `confirmed: true` のみです。
- `crop` と `avatarCrop` は正規化比率なので、サイズ変更後も再計算不要です。

### データセット版とリセット

`index.json` の `datasetId` はソート済みファイル名とバイトサイズから生成され、ローカル注釈も同じ id を保存します。

- インデックス id が変わると（再取り込み・画像削除）、アプリは以前の注釈を破棄して初期化します。存在しないファイルを指す記録は残りません。
- **数据与设置 → 清空本地标注** でいつでも手動リセットでき、現在のデータセット版を表示します。
- 公開シードに `datasetId` は含まれず、公開版が読み込み後に公開インデックスへ紐づけます。
- アーカイブ全体をリセットするには、`images/original/` を空にし、生成ディレクトリを削除して `npm run data` を実行し、削除をコミットします。履歴の書き換えは不要です。

---

## 機能一覧

| モジュール | 説明 |
| --- | --- |
| ホーム | 総数、対象年、タグ数、未確認数、最新更新。今日の一枚 / ランダム。年分布とよく使うタグ |
| カレンダー | 月グリッドにサムネイル。年月ジャンプ、絞り込み、印刷。日をクリックすると日付検索へ |
| ギャラリー | 遅延読み込みのメイソンリー、月別グループ。有効な日記日付順。お気に入り / 未確認 / 翻訳状態で絞り込み。複数選択の一括操作と原本 ZIP |
| 絵日記レビュー | 未確認 / 絵日記 / 非絵日記 / すべて。大画像で確認。OCR 候補と切り抜きプレビュー。`Enter` で確認して次へ、`N` で非絵日記、`←`/`→` でページ移動。進捗と残数表示 |
| 除外エリア | 確認済みの非絵日記を一覧、復元、TXT 書き出し |
| 詳細 | 大画像、前後移動、キーボード操作。投稿日と日記日付を分離。サイズ、ファイル名、shortcode、元投稿リンク。原本ダウンロード。タグ、メモ、お気に入り、共有 |
| 日付検索 | 検索欄に `20261117`、`2026-11-17`、`11-17`、`11/17` を入力、またはカレンダーの日をクリック。年ごとに降順でグループ化し件数を表示。推測日付の含否を切り替え。タグ絞り込み。複数選択でストーリー追加や一括タグ付け。hash で共有可能 |
| 検索・絞り込み | キーワード（タグ / メモ）、日付範囲、年 / 月、コレクション、お気に入り、翻訳状態。次元内 AND / OR、次元間 AND |
| タグ | 5 つの組み込み次元 + カスタム次元。作成・編集・削除、色、使用数、一括タグ付け |
| 人物図鑑 | 「人物/角色」次元を管理可能なエンティティに：名前、色、画像から切り抜くかアップロードしたアバター。詳細で登場人物を表示。図鑑は人物ごとに集約 |
| 翻訳パネル | 日本語原文 + 多言語スロット（既定は中国語・英語、追加削除可）。OCR 草稿を校正用に保持。未翻訳 / 翻訳済みで絞り込み。CSV / JSON の書き出しと読み戻し |
| ストーリー | 独立したトップタブ。表紙、タイトル、紹介、画像数、日付範囲、最終編集をカード表示。ギャラリーの複数選択や現在の絞り込み結果から作成、空のストーリーも作成可。ドラッグ並べ替え、削除、章メモ挿入、表紙設定、名前・紹介・タグ編集。連続スクロールまたはスライド閲覧、キーボードページ移動、hash 共有、JSON / HTML 書き出し。同じ画像を複数のストーリーに所属可能 |
| 削除とゴミ箱 | 詳細とギャラリー複数選択の「削除」、二次確認。全ビューから即時消え、原本は `images/_trash/` へ。短時間の取り消し toast。管理画面の「待清理」で復元・完全削除 |
| ステッカー工房 | 被写体を選択、白背景を透過（許容値調整可）、240 / 512 正方形を PNG / WebP で書き出し。単体または ZIP |
| コレクション | 名前付きコレクション、複数選択で追加、ドラッグ並べ替え、表紙、個別閲覧、md / json / csv 書き出し |
| 模写参考 | 構図 / 配色 / 線 / 表情のメモ、自動パレット、タグ + パレット類似度による推薦 |
| 絵日記めくり | 日記日付順の全画面閲覧。UI 自動非表示、Fullscreen API 対応 |
| 統計 | 総数、描いた日数、最長連続、確認進捗。月別棒グラフ、年別概要、タグと主要色の分布 |
| データと設定 | 完全 JSON 入出力、レビュー JSON、翻訳 CSV / JSON、公開データ書き出しと未公開通知、待清理リスト、シード統合、リセット、schema とショートカット |

### キーボードショートカット

| キー | 動作 |
| --- | --- |
| `←` / `→` | 詳細・閲覧・めくりで前 / 次 |
| `Esc` | 詳細やモーダルを閉じる |
| `/` | グローバル検索にフォーカス |
| `R` | ランダムに 1 枚 |
| `F` | 現在の作品をお気に入り |
| `Enter` | レビューで確認して次へ |
| `N` | レビューで非絵日記に設定 |
| `1` / `2` / `3` | 詳細タブ：情報 / 分解 / ステッカー |
| `?` | ショートカット一覧 |

---

## 増分ビルド

- キャッシュ：`.cache/images.json`。キーは `ファイル名:サイズ:mtime`。
- `npm run data` の再実行では未変更画像を再利用し、通常 1 秒ほどで完了します。
- 強制再生成は `npm run data:force`。
- インデックスはファイルの存在を検証するため、削除済みキャッシュが `index.json` に入ることはありません。
- レビューや注釈は画像アーカイブを変更しません。原本の追加・削除時だけインデックスが変わります。

---

## 新しい画像を追加する

```bash
npm run import -- "C:\path\to\new\images"
```

通常の画像フォルダと **Instagram 保存ページのディレクトリ**（`scontent-*.cdninstagram.com/*.jpg`、`_DataURI/*.txt`、`www.instagram.com/**/*.html|json`）の両方に対応します。

1. `.jpg` / `.jpeg` を再帰走査し、ページの PNG / WebP UI 素材は無視。
2. ページ JSON、GraphQL 応答、base64 `_DataURI` から `shortcode`、`taken_at`、画像 URL を解析。対応できた画像は投稿時間順に `YYYY-MM-DD-<shortcode>[-n].jpg` と命名。
3. ファイル内容の SHA-256 で重複排除。既存または同一バッチ内の重複はスキップ。
4. `--name-map` の `hash → ファイル名` マッピングが最優先。
5. 日付が取れない画像は `unknown-<shortcode>.jpg` または `unknown-<元の名前>.jpg` として手動入力を待ちます。
6. ファイルをコピーするだけで、元ディレクトリは変更しません。
7. 追加 / スキップ報告を `.cache/import-report.json` に保存。マニフェストは `.cache/import-manifest.json`。
8. その後 `npm run data`（またはビルド）で派生画像とインデックスを更新。

同じフォルダを再実行しても重複エントリは作られません。

### 衝突と重複

- 内容が同じで名前が違う → 重複としてスキップし、先に入った名前を保持。
- shortcode が同じで内容が違う → 両方保持し、`id` に `-n` を付与。
- 日付が取れない → `unknown-*` としてレビュー待ち。人が入力するまで未確認のまま。

---

## 絵日記の日付レビュー（原本は変更しない）

1. 管理版で **绘日记审核**（`#/diary-review`）を開く。
2. OCR 結果があれば候補と切り抜きプレビュー付きで事前入力。なければ**投稿日 − 1 日**を **推测** と明示して入力。
3. `Enter` で確認して次へ、`N` で非絵日記、`←` / `→` でページ移動。
4. 進捗行に確認済み / 総数と残数を表示。
5. レビュー JSON を書き出してバックアップ・復元可能。読み込みはレビュー状態と確認済み日付だけを更新。

この流れで原本を切り抜く・改名する・上書きする・削除することはありません。修正はインデックスとユーザーデータにのみ保存されます。

---

## 無関係な画像の削除

1. 管理版の詳細ページまたはギャラリー複数選択で **削除**。
2. 二次確認モーダル（原本が削除され、パージ後は復元できない旨を表示）。
3. 項目はすべてのビューと公開シードから即座に消え、原本は `images/_trash/` へ移動。
4. 下部の toast から短時間 **取り消し** 可能。
5. **数据与设置 → 待清理原图** で個別 **復元**、または **执行清理** で完全削除。

パージは `npm run dev`（admin モード）でのみ登録されるローカル開発サーバー経由で実行されます。使えない場合は次を実行：

```bash
npm run purge
```

公開ビルドには削除エンドポイントや削除コードパスが一切含まれません。ローカル実行が必要な操作は UI に明示されます。

---

## GitHub Pages へのデプロイ

リポジトリ：<https://github.com/PayayaKamo/namoridane.git>

`vite.config.ts` は `base: './'` なので、`https://<user>.github.io/<repo>/` のサブパスでもそのまま動きます。

### 方法 A：GitHub Actions（推奨）

`.github/workflows/deploy.yml` は `main` への push ごとに `npm run build:public` を実行し、`dist/` を公開します。

1. リポジトリの **Settings → Pages → Build and deployment → Source** で **GitHub Actions** を選択。
2. `main` を push してワークフロー完了を待つ。
3. `https://payayakamo.github.io/namoridane/` を開く。

push 前に `data/public.json` がコミットされていることを確認してください。ないと公開ビルドは失敗します。

### 方法 B：`gh-pages` ブランチ

```bash
npm run deploy
```

その後 **Settings → Pages** で `gh-pages` ブランチと `/ (root)` を選択。

### ローカルでサブパス確認

```bash
npm run build:public
npx serve dist
```

---

## 注意と制限

- OCR は任意で Windows 専用（PowerShell WinRT、追加依存なし）。レビュー補助であり、日付は必ず人が確認します。
- 確認済みの日付だけが公開されます。推測が事実として公開サイトに出ることはありません。
- 配布物には原本と WebP 派生画像が含まれ、約 260 MB になります。軽くしたい場合は `scripts/build-index.mjs` で大画像サイズを下げるか原本公開を外してください（ダウンロード機能に影響します）。
- 前回の 1,086 枚データセットでの任意 OCR 統計：79 枚が日付候補を認識（約 7%）。手書き文字のため精度は限られ、結果は提案のみです。

---

## 著作権

イラストの著作権は Namori さんに帰属します。本リポジトリは個人の閲覧・学習・模写参考のためのもので、商用利用や原本の再配布は行わないでください。
