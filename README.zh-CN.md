# Namori 绘日记 · 浏览与整理

[English](README.md) · [日本語](README.ja.md)

纯前端静态站点，用来浏览、搜索、整理 Namori 老师（Instagram [@namori__](https://www.instagram.com/namori__/)）的「绘日记」插画。

- **仓库内置 1,086 张完整归档**：2021-03 → 2025，从 1,171 个源文件 hash 去重而来；其中 1,031 张带有 Instagram 发布日期，55 张为 `unknown-*`，等待人工录入日期
- **可随时清空重来**：删除归档后用 `npm run import -- "<目录>"` 重新导入；即使 0 张图，两套构建也能通过并显示导入提示
- 支持原始 JPG 单张下载与多选 ZIP 打包
- 同一套代码产出两个版本：本地自用的 **admin** 管理端与粉丝只读的 **public** 公开站
- 本地优先：标注保存在浏览器 `localStorage`，可导出 / 导入 JSON
- 无后端、无数据库、无账号，构建产物是可直接部署到 GitHub Pages 的静态文件
- 中文界面，PC 优先，适配 1280 / 1440 / 1024，支持亮色 / 暗色主题

---

## 快速开始

```bat
:: Windows 一键启动（首次自动安装依赖、生成索引并打开浏览器）
start.cmd
```

或手动执行：

```bash
npm install
npm run dev          # 增量生成索引后启动 http://localhost:5173/
npm run build:admin  # 本地管理端完整版 -> dist/
npm run build:public # 粉丝只读公开站   -> dist/
npm run preview      # 预览最近一次构建
```

要求 Node.js 18+。

`images/original/` 已内置 1,086 张去重后的原始 JPG，两套构建开箱即得完整站点。若清空该目录（例如重置归档），两套构建仍可通过，站点会显示「还没有图片」的空状态与导入命令。审核与标注数据绑定数据集版本，导入新数据集后旧标注会自动作废。

### npm scripts

| 命令 | 作用 |
| --- | --- |
| `npm run data` | 扫描原图，增量生成缩略图、大图、`index.json` 与种子标注，并同步原图发布副本 |
| `npm run data:force` | 忽略缓存，全量重新生成衍生图 |
| `npm run import -- "<目录>"` | 导入新图片目录：hash 去重、可追溯命名并并入 `images/original/` |
| `npm run ocr` | 可选：仅 Windows 的轻量 OCR，为审核页预填日期提示 |
| `npm run dev` | 先跑 `data`，再启动 Vite 开发服务器（admin 模式） |
| `npm run build:admin` | 管理端构建：`data` + 类型检查 + `vite build --mode admin` |
| `npm run build:public` | 公开站构建：`data --mode=public` + 类型检查 + `vite build --mode public` |
| `npm run purge` | 彻底删除 `images/_trash/` 中等待清理的原图 |
| `npm run preview` | 预览 `dist/` |
| `npm run deploy` | `build:public` 后用 `gh-pages` 推送 `dist/` 到 `gh-pages` 分支 |

---

## 一套代码，两个产物

`vite build` 接收 `--mode admin|public`，模式以编译期常量 `__APP_MODE__` 注入。

| | `build:admin` | `build:public` |
| --- | --- | --- |
| 使用场景 | 本地自用 | 粉丝站（GitHub Pages） |
| 审核与人工录入日期 | 有 | 无 |
| 标签 / 人物编辑 | 有 | 无 |
| 翻译编辑 | 有 | 只读展示 |
| 故事线编辑 | 有 | 只读阅读 |
| 合集、导入导出、排除区、批量操作 | 有 | 无 |
| 删除 / 回收站 / 清理 | 有 | 完全不存在相关路径或接口 |
| 未确认日期 | 作为猜测展示以供审核 | 显示为「未标注」或不显示 |

管理端视图通过编译期判断懒加载，公开产物里不会包含管理路由、表单、删除接口或导入导出代码。隐藏发生在组件层，而不是仅靠 CSS。

### 发布数据到公开站

公开站不读取你的浏览器数据，只读取仓库里的种子 `data/public.json`。

1. 管理端打开 **数据与设置 → 发布数据**，点击 **导出发布数据 public.json**。
2. 把下载的文件放到 `data/public.json` 并提交。
3. 运行 / 推送 `build:public`（GitHub Actions 会在 `main` 上自动执行）。

导出只保留人工确认的日期、已公开的故事线、翻译、标签与人物实体，去掉私密备注、收藏、非绘日记和已删除图片。当本地数据比最近一次导出更新时，管理端会提示 **有未发布的修改**。

---

## 目录结构

```
namori-diary/
├─ images/
│  ├─ original/             # 原图归档（已入库 1,086 张，由 npm run import 替换）
│  └─ _trash/               # 待清理的已删除原图（gitignore）
├─ data/
│  ├─ public.json           # 公开站种子，build:public 读取（入库）
│  ├─ userdata.example.json # 管理端种子 schema 示例
│  └─ ocr.json              # 可选 OCR 结果（入库，仅管理端使用）
├─ public/
│  ├─ characters/           # 23 位预置角色的 512×512 占位头像（入库）
│  ├─ images/thumb/         # 480px WebP 缩略图（构建生成，gitignore）
│  ├─ images/large/         # 1400px WebP 大图（构建生成，gitignore）
│  ├─ images/original/      # 供下载的原图副本（构建同步，gitignore）
│  └─ data/index.json       # 作品索引（构建生成，gitignore）
├─ scripts/
│  ├─ build-index.mjs       # 数据管线：原图 → 衍生图 → 索引 → 种子
│  ├─ import-images.mjs     # 新图片批次增量导入
│  ├─ ocr-dates.mjs         # 可选日期 OCR（仅 Windows）
│  ├─ ocr-windows.ps1       # PowerShell WinRT OCR 辅助脚本
│  └─ purge-trash.mjs       # 彻底清空 images/_trash
├─ src/
│  ├─ components/           # Layout / ItemCard / TagPicker / DateEditor / StickerEditor ...
│  ├─ lib/                  # 路由、日期、筛选、存储、发布、回收站、canvas
│  ├─ state/store.tsx       # 全局状态与 localStorage 持久化
│  ├─ views/                # 首页、日历、图库、详情、审核、日期查询、人物、故事线、
│  │                        # 翻译面板、表情包、统计、数据
│  ├─ styles.css
│  └─ styles-views.css
├─ start.cmd
├─ vite.config.ts
└─ .github/workflows/deploy.yml
```

---

## 原图来源与命名

`scripts/build-index.mjs` 按以下优先级寻找原图目录：

1. 命令行参数：`--src="D:\path\to\images"`
2. 环境变量：`NAMORI_SRC`
3. 仓库内归档：`images/original/`（为空时自动创建）

不会自动回退到仓库外的旧目录，清空后会保持空归档，直到重新导入。

仓库内归档共 1,086 张：2021 年 242 张、2022 年 326 张、2023 年 154 张、2024 年 308 张、2025 年 1 张，另有 55 张早期图片无法还原发布日期。这 55 张会一直留在审核队列里，直到人工补上日期。

文件名必须可追溯：

```
YYYY-MM-DD-<11位 shortcode>[-n].jpg
unknown-<原始文件名>.jpg
```

日期前缀是 Instagram **发布日期**（`publishedAt`）。同帖多图用 `-0 / -1 / …` 后缀，脚本会计算 `postCount` 与稳定 `id`。

### 日期规则

- 发布日期来自文件名。
- 画面手写的日记日期由**人工确认**，不会静默猜测。
- 构建期 OCR 最多给出 3 个带置信度的候选，年份按发布日期就近推断。OCR 只是提示，不是事实。
- OCR 无结果时，审核页预填 **发布日 − 1 天**，并明确标注为 **推测**。
- 只有人工确认的日期才会导出到 `data/public.json`，公开站不会把猜测当日期展示。

---

## 数据结构

### 1. 作品索引 `public/data/index.json`

由脚本生成，前端只读（`version: 7`）：

```jsonc
{
  "version": 7,
  "generatedAt": "2026-11-17T00:00:00.000Z",
  "datasetId": "2fa1e39768d2",
  "count": 1086,
  "years": { "2021": 242, "2022": 326, "2023": 154, "2024": 308, "2025": 1 },
  "items": [
    {
      "id": "2021-06-01-CPlLQUStuZq",
      "shortcode": "CPlLQUStuZq",
      "file": "2021-06-01-CPlLQUStuZq.jpg",
      "sourceFile": "624731284_18111775369652284_6650922443708114316_n.jpg",
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

公开模式下会剥离 `inferred*`、`ocr` 与 `suggestedDiaryDate`。`sourceFile` 保留导入时的 Instagram CDN 原始文件名（含 `_n` 后缀）；`postIndex` / `postCount` 保留同帖多图的顺序。详情页与审核页会同时显示原始文件名与导入后文件名。

### 2. 用户标注 v2 — `localStorage` / 导入导出

存储键：`namori.diary.userdata.v2`。完整类型见 [`src/types.ts`](src/types.ts)。

```jsonc
{
  "version": 2,
  "updatedAt": "2026-11-17T00:00:00.000Z",
  "datasetId": "2fa1e39768d2",
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

- 审核状态由 `reviewed` 与 `excluded` 组合：`false/false` 待确认，`true/false` 已确认绘日记，`true/true` 已确认非绘日记。
- `deleted` 会把条目从所有视图与发布种子里移除；原图先移到 `images/_trash/`。
- `date.source`：`inferred` / `published` / `manual`。只有 `confirmed: true` 的日期才会出现在公开站。
- `crop` 与 `avatarCrop` 都是归一化比例，换尺寸导出无需重算。

### 数据集版本与重置

`index.json` 里的 `datasetId` 由排序后的文件名与字节数生成，本地标注保存同一 id。

- 索引 id 变化（重新导入、删除图片）时，App 会丢弃上一份标注并重新开始，指向不存在文件的记录不会残留。
- **数据与设置 → 清空本地标注** 可随时手动重置，并显示当前数据集版本。
- 公开种子不含 `datasetId`，公开站加载后自动绑定公开索引。
- 要重置整个归档：清空 `images/original/`、删除生成目录、运行 `npm run data`、提交删除即可，无需改写历史。

---

## 功能一览

| 模块 | 说明 |
| --- | --- |
| 首页 | 总张数、覆盖年份、已打标签、待确认、最近更新；每日一图 / 随机抽卡；年份分布与常用标签 |
| 日历 | 月历格内缩略图；跳年 / 月；筛选；打印；点击某天直接打开日期查询 |
| 图库 | 等比瀑布流 + 懒加载，按月份分组；按有效日记日期排序；收藏 / 待校对 / 翻译状态筛选；多选批量操作与原始 JPG ZIP |
| 绘日记审核 | 待确认 / 是绘日记 / 非绘日记 / 全部队列；大图审核；OCR 候选与裁切预览；一键确认；`N` 标非绘日记；`←`/`→` 翻页；显示进度与剩余数量 |
| 排除区 | 集中查看已确认非绘日记，支持恢复与导出 TXT 名单 |
| 详情 | 大图、上一张 / 下一张、键盘方向键；发布日与日记日分开展示；尺寸、大小、文件名、shortcode、原帖链接；原图下载；标签、备注、收藏、分享 |
| 日期查询 | 搜索框输入 `20261117`、`2026-11-17`、`11-17`、`11/17`，或点击日历某天；结果按年份倒序分组并标条数；可切换是否包含推测日期；叠加标签筛选；多选加入故事线或批量打标签；hash 可分享 |
| 搜索筛选 | 关键词（标签 / 备注）、日期区间、年 / 月、合集、收藏、翻译状态；维度内 AND / OR，跨维度 AND |
| 标签系统 | 五组内置维度 + 自定义维度；标签增删改、颜色、使用计数、批量打标签 |
| 人物图鉴 | 「人物/角色」维度升级为可管理实体：名称、颜色、从图中裁切或上传头像；详情页展示登场人物；图鉴按角色聚合 |
| 翻译面板 | 日文原文 + 多语言槽位（默认中文、英文，可增删）；保留 OCR 草稿供校对；按未翻译 / 已翻译筛选；CSV / JSON 导出与导入回填 |
| 故事线 | 独立顶部 tab；卡片展示封面、标题、简介、图片数、日期范围与最后编辑；可从图库多选或当前筛选结果创建，也可先建空故事线；拖动排序、移除、插入章节备注、设置封面、起名、写简介、打标签；连续滚动或幻灯片阅读、键盘翻页、分享 hash、导出 JSON / HTML；同一张图可属于多条故事线 |
| 删除与回收站 | 详情页与图库多选「删除」，二次确认；条目立即从所有视图移除；原图移入 `images/_trash/`；toast 可短时间撤销；管理端「待清理」支持恢复与执行清理 |
| 表情包工坊 | 框选主体、白底转透明（可调容差）、240 / 512 方形导出 PNG / WebP；单张或 ZIP 批量 |
| 合集 | 多个命名合集、多选批量加入、拖拽排序、封面、单独浏览、导出 md / json / csv |
| 模仿参考 | 构图 / 配色 / 线条 / 表情神态笔记、自动色板、按标签 + 色板相似度推荐 |
| 日记翻阅 | 按日记日期顺序全屏翻书，自动隐藏界面，支持全屏 API |
| 统计 | 总量、有画天数、最长连续记录、确认进度；月度柱状图、年度概览、标签与主色分布 |
| 数据与设置 | 完整 JSON 导出 / 导入、审核 JSON、翻译 CSV / JSON、发布数据导出与未发布提示、待清理列表、合并种子、清空本地标注、schema 与快捷键速查 |

### 快捷键

| 按键 | 作用 |
| --- | --- |
| `←` / `→` | 详情、阅读与翻阅模式下上一张 / 下一张 |
| `Esc` | 关闭详情 / 弹窗 |
| `/` | 聚焦全局搜索 |
| `R` | 随机抽一张 |
| `F` | 收藏 / 取消收藏（详情页） |
| `Enter` | 审核页确认并跳到下一张 |
| `N` | 审核页标记非绘日记 |
| `1` / `2` / `3` | 详情页切换「信息 / 拆解 / 表情包」 |
| `?` | 打开快捷键说明 |

---

## 增量构建

- 缓存文件：`.cache/images.json`，缓存键为 `文件名:目标尺寸:修改时间`。
- 重复执行 `npm run data` 时，未变化的图直接复用，通常 1 秒内完成。
- 需要强制重建：`npm run data:force`。
- 索引会校验文件存在性，不会把缓存里已删除的图写进 `index.json`。
- 审核与标注不需要运行数据脚本，也不会改动图片归档；只有主动增删源文件时，索引才会变化。

---

## 新增一批图片

```bash
npm run import -- "C:\path\to\new\images"
```

脚本同时支持普通图片目录和 **Instagram 保存页目录**（包含 `scontent-*.cdninstagram.com/*.jpg`、`_DataURI/*.txt`、`www.instagram.com/**/*.html|json` 的结构）。

1. 递归扫描 `.jpg` / `.jpeg`，忽略页面里的 PNG / WebP 界面资源。
2. 解析页面 JSON、GraphQL 响应和 base64 `_DataURI` 中的 `shortcode`、`taken_at` 与图片 URL；能对应上的图片按发布时间命名为 `YYYY-MM-DD-<shortcode>[-n].jpg`。
3. 以文件内容 SHA-256 去重：已入库或同批重复的文件会跳过。每个文件都会把原始 CDN 文件名记入 `sourceFile`；重跑导入可补齐旧条目，不会新增重复项。
4. `--name-map` 可提供显式 `hash → 文件名` 映射，优先级最高。
5. 拿不到日期的图片落到 `unknown-<shortcode>.jpg` 或 `unknown-<原始文件名>.jpg`，等待人工录入日期。
6. 只复制文件，不改动源目录。
7. 输出新增 / 跳过报告，并记录到 `.cache/import-report.json`；清单在 `.cache/import-manifest.json`。每次导入都会重新生成并提交 `data/source-names.json` 映射。
8. 之后运行 `npm run data`（或直接构建）生成衍生图并更新索引。

重复执行同一批不会产生重复条目。

### 冲突与重复

- 内容相同、文件名不同 → 视为重复跳过，保留先入库的名字。
- shortcode 相同、内容不同 → 都保留，`id` 自动加 `-n` 后缀。
- 拿不到日期 → `unknown-*`，在审核页作为待确认处理，人工录入前日期保持未确认。

---

## 审核绘日记日期（绝不修改原图）

1. 管理端打开 **绘日记审核**（`#/diary-review`）。
2. 有 OCR 结果时预填建议值并展示候选与裁切预览；没有时预填 **发布日 − 1 天** 并标注 **推测**。页面同时显示原始 CDN 文件名、导入后文件名与同帖多图顺序。
3. `Enter` 确认并跳到下一张；`N` 标记非绘日记；`←` / `→` 翻页。
4. 顶部显示已确认 / 总数与剩余数量。
5. 可导出审核 JSON 备份或恢复；导入只更新审核状态与已确认日期。

整个流程不会裁剪、重命名、覆盖或删除原图，所有修正只写入索引和用户数据。

---

## 删除无关图片

1. 管理端在详情页或图库多选里点 **删除**。
2. 二次确认弹窗会说明原图会被移除、清理后不可恢复。
3. 条目立即从所有视图与发布种子中消失，原图移到 `images/_trash/`。
4. 底部 toast 提供短时间 **撤销**。
5. 在 **数据与设置 → 待清理原图** 里可以逐张 **恢复**，或 **执行清理** 彻底删除。

清理通过仅在 `npm run dev`（admin 模式）注册的本地开发服务器接口完成；接口不可用时运行：

```bash
npm run purge
```

公开构建不包含任何删除接口或删除代码路径。必须本地执行的动作，界面会明确提示。

---

## 角色占位头像

`public/characters/<角色id>.webp` 为 23 位预置角色（《摇曳百合》阵容）各存了一张 512×512 占位头像。角色数据里用 `avatar` 记录路径，用 `avatarSource` 记录来源。

- 上传或裁切过的头像始终优先；没有设置头像时才显示占位图。
- 替换时直接用 512×512 的 WebP 覆盖同名文件即可，不需要改代码或数据；只有需要绕过浏览器缓存时才改文件名。
- 占位图取自 [AniList](https://anilist.co/) 的第三方参考图，仅作临时示意，不进入原图下载或 ZIP 打包。
- 找不到的角色保留首字 / 封面兜底，不用无关图片凑数。

---

## 部署到 GitHub Pages

仓库：<https://github.com/PayayaKamo/namoridane.git>

`vite.config.ts` 使用 `base: './'`，因此部署在 `https://<user>.github.io/<repo>/` 子路径下也能正常加载。

### 方式 A：GitHub Actions（推荐）

`.github/workflows/deploy.yml` 会在每次推送到 `main` 时执行 `npm run build:public` 并发布 `dist/`。

1. 仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
2. 推送 `main`，等待 Actions 完成。
3. 打开 `https://payayakamo.github.io/namoridane/`。

推送前请确认 `data/public.json` 已提交，否则公开构建会失败。

### 方式 B：`gh-pages` 分支

```bash
npm run deploy
```

然后在 **Settings → Pages** 中选择 `gh-pages` 分支与 `/ (root)`。

### 本地验证子路径

```bash
npm run build:public
npx serve dist
```

---

## 说明与限制

- OCR 是可选项，仅 Windows 可用（PowerShell WinRT，不新增依赖）。它是审核辅助，日期始终由人工确认。
- 只有确认后的日期才会发布，公开站不会把猜测当作事实。
- 部署产物包含原图与 WebP 衍生图（约 260 MB）。如需更轻量，可在 `scripts/build-index.mjs` 调整大图尺寸或移除原图发布，但会影响下载功能。

---

## 版权说明

插画版权归 Namori 老师所有。本仓库仅用于个人浏览、学习与临摹参考，请勿用于商业用途或二次分发原图。
