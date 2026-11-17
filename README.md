# Namori Diary · Browse & Curate

[中文](README.zh-CN.md) · [日本語](README.ja.md)

A fully static, front-end-only site for browsing and curating the daily sketches ("絵日記") of **Namori** ([@namori__](https://www.instagram.com/namori__/) on Instagram).

- **Empty archive by default**: the repository no longer ships the old image set. Import a fresh folder with `npm run import -- "<dir>"`; the pipeline was built and tested against the full 1,086-image archive (2021-03 → 2025)
- Download single originals or pack a multi-selection into a ZIP
- Two builds from one codebase: a full local **admin** app and a read-only **public** site
- Local-first data: annotations live in `localStorage` and can be exported / imported as JSON
- No backend, no database, no account; the build output is plain static files for GitHub Pages
- Chinese UI; PC-first layout for 1280 / 1440 / 1024 with light and dark themes

---

## Quick start

```bat
:: Windows one-click launcher (installs deps, builds the index, opens the browser on first run)
start.cmd
```

Or manually:

```bash
npm install
npm run dev          # build index incrementally, then serve http://localhost:5173/
npm run build:admin  # full local admin app -> dist/
npm run build:public # read-only public site  -> dist/
npm run preview      # preview the last build
```

Requires Node.js 18+.

With an empty `images/original/`, both builds still succeed and the site shows a clear "还没有图片" empty state with the import command. Review and annotation data is bound to the dataset version, so importing a new dataset automatically invalidates annotations that point at older files.

### npm scripts

| Command | Purpose |
| --- | --- |
| `npm run data` | Scan originals; incrementally generate thumbnails, large images, `index.json` and seed data; sync original publish copies |
| `npm run data:force` | Rebuild every derivative, ignoring the cache |
| `npm run import -- "<dir>"` | Import a new image folder: hash dedupe, traceable naming, merged into `images/original/` |
| `npm run ocr` | Optional: Windows-only lightweight OCR to pre-fill date hints for the review page |
| `npm run dev` | Run `data` then start the Vite dev server (admin mode) |
| `npm run build:admin` | Local admin build: `data` + type check + `vite build --mode admin` |
| `npm run build:public` | Public build: `data --mode=public` + type check + `vite build --mode public` |
| `npm run purge` | Permanently delete files waiting in `images/_trash/` |
| `npm run preview` | Preview `dist/` |
| `npm run deploy` | `build:public` then push `dist/` to the `gh-pages` branch |

---

## Two builds, one codebase

`vite build` receives `--mode admin|public`; the mode is exposed as the compile-time constant `__APP_MODE__`.

| | `build:admin` | `build:public` |
| --- | --- | --- |
| Audience | You, locally | Fans, on GitHub Pages |
| Review & manual dates | Yes | No |
| Tag / character editing | Yes | No |
| Translation editing | Yes | Read-only display |
| Storyline editing | Yes | Read-only reading |
| Collections, import/export, excluded area, batch ops | Yes | No |
| Delete / trash / purge | Yes | No paths or endpoints at all |
| Unconfirmed dates | Shown as guesses for review | Shown as "未标注" / omitted |

Admin-only views are lazy-loaded behind a compile-time guard, so the public bundle contains no admin routes, forms, delete endpoints or import/export code. Hiding is done at the component level, not with CSS.

### Publishing data to the public site

The public build does not read your browser data. It reads the committed seed `data/public.json`.

1. In the admin app (**数据与设置 → 发布数据**), click **导出发布数据 public.json**.
2. Put the downloaded file at `data/public.json` and commit it.
3. Run / push `build:public` (GitHub Actions does this on `main`).

The export keeps only manually confirmed dates, published storylines, translations, tags and character entities. It drops private notes, favorites, non-diary items and deleted images. The admin page shows **有未发布的修改** whenever local data is newer than the last export.

---

## Project layout

```
namori-diary/
├─ images/
│  ├─ original/             # image archive (empty after reset, filled by npm run import)
│  └─ _trash/               # deleted originals waiting for purge (gitignored)
├─ data/
│  ├─ public.json           # published seed used by build:public (committed)
│  ├─ userdata.example.json # empty schema example for the admin seed
│  └─ ocr.json              # optional OCR output (committed, admin only)
├─ public/
│  ├─ images/thumb/         # 480px WebP thumbnails (generated, gitignored)
│  ├─ images/large/         # 1400px WebP large images (generated, gitignored)
│  ├─ images/original/      # originals copied for download (generated, gitignored)
│  └─ data/index.json       # item index (generated, gitignored)
├─ scripts/
│  ├─ build-index.mjs       # data pipeline: originals → derivatives → index → seed
│  ├─ import-images.mjs     # incremental import for new image batches
│  ├─ ocr-dates.mjs         # optional date OCR (Windows only)
│  ├─ ocr-windows.ps1       # PowerShell WinRT OCR helper
│  └─ purge-trash.mjs       # permanently empty images/_trash
├─ src/
│  ├─ components/           # Layout / ItemCard / TagPicker / DateEditor / StickerEditor ...
│  ├─ lib/                  # router, dates, filters, storage, publish, trash, canvas
│  ├─ state/store.tsx       # global state + localStorage persistence
│  ├─ views/                # home, calendar, gallery, detail, review, date-find, characters,
│  │                        # storylines, translations panel, stickers, stats, data
│  ├─ styles.css
│  └─ styles-views.css
├─ start.cmd
├─ vite.config.ts
└─ .github/workflows/deploy.yml
```

---

## Image source and naming

`scripts/build-index.mjs` resolves the source directory in this order:

1. CLI argument: `--src="D:\path\to\images"`
2. Environment variable: `NAMORI_SRC`
3. Repository archive: `images/original/` (created automatically when empty)

There is no automatic fallback to an old sibling folder, so a reset archive stays empty until you import new files.

File names must be traceable:

```
YYYY-MM-DD-<11-char shortcode>[-n].jpg
unknown-<original-filename>.jpg
```

The date prefix is the Instagram **publish date** (`publishedAt`). Multi-image posts use a `-0 / -1 / …` suffix; the pipeline computes `postCount` and a stable `id`.

### Date rules

- The publish date comes from the file name.
- The hand-written diary date on the page is **confirmed by a human**, never guessed silently.
- The build-only OCR step can suggest up to three candidates with confidence, with the year inferred nearest to the publish date. OCR output is a hint, not a fact.
- If OCR has no result, the review page pre-fills **publish date − 1 day** and labels it clearly as **推测**.
- Only confirmed dates are exported to `data/public.json`. The public site never presents a guess as a date.

---

## Data schema

### 1. Item index — `public/data/index.json`

Generated, read-only for the front end (`version: 6`):

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

In public mode, `inferred*`, `ocr` and `suggestedDiaryDate` are stripped.

### 2. User data v2 — `localStorage` / import-export

Storage key: `namori.diary.userdata.v2`. Full types: [`src/types.ts`](src/types.ts).

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
      "note": "自由备注",
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

- Review state is `reviewed` + `excluded`: `false/false` pending, `true/false` confirmed diary, `true/true` confirmed non-diary.
- `deleted` removes an item from every view and from the published seed. The original file is moved to `images/_trash/` first.
- `date.source`: `inferred`, `published` or `manual`. `confirmed` must be true for a date to appear on the public site.
- `crop` and `avatarCrop` are normalized ratios, so exports do not need recomputation.

### Dataset version and reset

`index.json` carries a `datasetId` derived from the sorted file list and byte sizes. Every local annotation file stores the same id.

- When the index id changes (new import, removed image), the app discards the previous annotation store and starts clean. Records pointing at files that no longer exist can never survive.
- A manual **数据与设置 → 清空本地标注** entry resets annotations at any time and shows the current dataset version.
- The public seed contains no `datasetId`; the public app binds it to the public index after loading.
- To reset the archive itself, empty `images/original/`, clear generated folders, run `npm run data`, and commit the deletions. No history rewrite is needed.

---

## Features

| Module | Description |
| --- | --- |
| Home | Totals, coverage years, tagged count, pending count, latest updates; daily pick / random; year distribution and top tags |
| Calendar | Month grid with thumbnails; jump to year/month; filters; print; clicking a day opens the date lookup |
| Gallery | Lazy masonry grouped by month; effective-date ordering; favorites/pending filters; translation filter; multi-select batch actions; ZIP of originals |
| Diary review | Pending / diary / non-diary / all queues; large-image review; OCR candidates and crop preview; one-key confirm; `N` marks non-diary; `←`/`→` paging; progress and remaining count |
| Excluded area | Review confirmed non-diary items, restore them, export a TXT list |
| Detail | Large image, previous/next, keyboard navigation; publish date and diary date separated; dimensions, size, file, shortcode, original post link; download; tags, note, favorite, share |
| Date lookup | Type `20261117`, `2026-11-17`, `11-17` or `11/17` in search, or click a calendar day; results grouped by year descending with counts; toggle inferred dates; tag filters; multi-select into storylines or batch tags; shareable hash |
| Search & filter | Keyword (tags / notes), date range, year/month, collection, favorites, translation status; per-dimension AND/OR |
| Tags | Five built-in dimensions plus custom ones; create/edit/delete, colors, usage counts, batch tagging |
| Characters | Manageable entities in the character dimension: name, color, avatar cropped from an image or uploaded; cast shown on details; gallery grouped by character |
| Translations | Japanese source text plus multi-language slots (Chinese and English by default, add/remove more); OCR draft kept for proofreading; translated/untranslated filters; CSV/JSON export and import |
| Storylines | Dedicated top-level tab; cards with cover, title, description, image count, date range and last edit; create from gallery selection or as an empty storyline; drag reorder, remove, chapter notes, cover, tags; continuous or slide reader, keyboard paging, share hash, JSON/HTML export; images may belong to multiple storylines |
| Delete & trash | Detail and gallery multi-select delete with a second confirmation; item disappears from every view immediately; original moved to `images/_trash/`; short undo toast; admin pending-cleanup list with restore and purge |
| Sticker studio | Crop the subject, white-to-transparent with tolerance, export 240/512 squares as PNG/WebP; single or ZIP |
| Collections | Named collections, multi-select add, drag reorder, cover, browse, export as md/json/csv |
| Study mode | Composition / palette / linework / expression notes, automatic palette, similar-image recommendations |
| Diary flip-through | Full-screen sequential reading with UI auto-hide and the Fullscreen API |
| Stats | Totals, drawing days, longest streak, review progress; monthly bars, yearly overview, tag and color distribution |
| Data & settings | Full JSON export/import, review JSON, translation CSV/JSON, public seed export with unpublished-changes banner, pending-cleanup list, seed merge, reset, schema and shortcuts |

### Keyboard shortcuts

| Key | Action |
| --- | --- |
| `←` / `→` | Previous / next item in detail, reader and flip-through |
| `Esc` | Close detail or modal |
| `/` | Focus the global search |
| `R` | Random item |
| `F` | Favorite the current item |
| `Enter` | Confirm and advance in the review page |
| `N` | Mark non-diary in the review page |
| `1` / `2` / `3` | Detail tabs: info / study / sticker |
| `?` | Shortcut panel |

---

## Incremental builds

- Cache: `.cache/images.json`; keys are `file:target-size:mtime`.
- Re-running `npm run data` reuses unchanged images and usually finishes in about a second.
- Force a rebuild with `npm run data:force`.
- The index re-checks file existence, so deleted cache entries never enter `index.json`.
- Reviewing and annotating never touches the image archive; only adding or removing source files changes the index.

---

## Adding a new batch of images

```bash
npm run import -- "C:\path\to\new\images"
```

The script accepts both a plain image folder and an **Instagram saved-page directory** (the structure containing `scontent-*.cdninstagram.com/*.jpg`, `_DataURI/*.txt` and `www.instagram.com/**/*.html|json`).

1. Recursively scans `.jpg` / `.jpeg`; page assets and PNG/WebP UI images are ignored.
2. Parses embedded page JSON, GraphQL responses and base64 `_DataURI` payloads for `shortcode`, `taken_at` and image URLs. Known images are named `YYYY-MM-DD-<shortcode>[-n].jpg` in publish-time order.
3. Dedupe uses the file content SHA-256. Files already present or duplicated within the batch are skipped.
4. `--name-map` can supply an explicit `hash → filename` mapping and takes precedence.
5. Images without a recoverable date become `unknown-<shortcode>.jpg` or `unknown-<original>.jpg` and stay pending for manual date entry.
6. It only copies files; the source directory is never modified.
7. A report is printed and stored at `.cache/import-report.json`; the manifest is `.cache/import-manifest.json`.
8. Then run `npm run data` (or a build) to produce derivatives and update the index.

Re-running the same folder is idempotent and creates no duplicate entries.

### Conflicts and duplicates

- Same content, different name → skipped as a duplicate; the first name wins.
- Same shortcode, different content → both are kept; ids get `-n` suffixes.
- Unknown date → `unknown-*`, listed as pending in review; the date stays unconfirmed until a human enters it.

---

## Reviewing diary dates (originals are never modified)

1. Open **绘日记审核** (`#/diary-review`) in the admin app.
2. The page pre-fills an OCR suggestion when available, with candidates and a crop preview; otherwise it pre-fills **publish date − 1 day** labelled **推测**.
3. Press `Enter` to confirm and jump to the next item; press `N` if the image is not a diary page; use `←` / `→` to page.
4. The progress line shows confirmed / total and the remaining count.
5. Export a review JSON for backup or restore; importing it updates only review state and confirmed dates.

Nothing in this flow crops, renames, overwrites or deletes originals. All corrections live in the index and user data.

---

## Deleting unrelated images

1. In the admin app, use **删除** on a detail page or in the gallery multi-selection.
2. Confirm the modal (it explains that the original will be removed and cannot be restored after purge).
3. The item disappears immediately from all views and from the public seed; the original moves to `images/_trash/`.
4. Use the toast **撤销** to restore it within a short window.
5. In **数据与设置 → 待清理原图**, either **恢复** individual items or **执行清理** to remove them permanently.

Purge works through a local dev-server middleware available only in `npm run dev` (admin mode). If the server is unavailable, run:

```bash
npm run purge
```

The public build contains no delete endpoint or delete code path. If cleanup must happen locally, the UI says so explicitly.

---

## Deploying to GitHub Pages

Repository: <https://github.com/PayayaKamo/namoridane.git>

`vite.config.ts` uses `base: './'`, so the site works under `https://<user>.github.io/<repo>/` without changes.

### Option A: GitHub Actions (recommended)

`.github/workflows/deploy.yml` builds on every push to `main` with `npm run build:public` and publishes `dist/`.

1. Repository **Settings → Pages → Build and deployment → Source** → **GitHub Actions**.
2. Push `main` and wait for the workflow.
3. Open `https://payayakamo.github.io/namoridane/`.

Make sure `data/public.json` is committed before pushing; the public build fails without it.

### Option B: `gh-pages` branch

```bash
npm run deploy
```

Then choose the `gh-pages` branch and `/ (root)` in **Settings → Pages**.

### Local sub-path check

```bash
npm run build:public
npx serve dist
```

---

## Notes and limitations

- OCR is optional and Windows-only (PowerShell WinRT, no extra dependencies). It is a review aid; the date is always confirmed by a human.
- A date is only published after confirmation. Guesses never appear as facts on the public site.
- The deploy output includes originals plus WebP derivatives (roughly 260 MB). Reduce the large-image size or drop originals in `scripts/build-index.mjs` if you want a lighter deploy, at the cost of download features.
- The optional OCR statistics from the previous 1,086-image set: 79 pages produced a date candidate (about 7%), skewed by handwritten dates. Treat OCR results as suggestions only.

---

## Copyright

All illustrations belong to Namori. This repository is for personal browsing, study and drawing reference only. Do not use it commercially or redistribute the originals.
