# Namori 绘日记 · 浏览与整理站

纯前端静态站点，用来浏览、搜索、整理 Namori 老师（Instagram [@namori__](https://www.instagram.com/namori__/)）的「绘日记」插画。

- 1072 张作品，覆盖 2021-03 至 2025-09
- 无后端、无数据库，标注数据保存在浏览器 `localStorage`，可导出 / 导入 JSON
- 构建产物为纯静态文件，可直接部署到 GitHub Pages（支持子路径）
- 中文界面，PC 优先，适配 1280 / 1440 / 1024，支持亮色 / 暗色主题

---

## 快速开始

```bat
:: Windows 一键启动（首次会自动安装依赖、生成索引，再打开浏览器）
start.cmd
```

或手动执行：

```bash
npm install
npm run dev        # 生成索引（增量）后启动 http://localhost:5173/
npm run build      # 生成索引 + 类型检查 + 打包到 dist/
npm run preview    # 本地预览构建产物
```

要求 Node.js 18+（开发时使用 Node 26 / npm 11 验证）。

### npm scripts

| 命令 | 作用 |
| --- | --- |
| `npm run data` | 扫描原图，增量生成缩略图、大图、`index.json` 与种子标注 |
| `npm run data:force` | 忽略缓存，全量重新生成衍生图 |
| `npm run dev` | 先跑 `data`，再启动 Vite 开发服务器 |
| `npm run build` | `data` + `tsc -b` + `vite build`，输出 `dist/` |
| `npm run preview` | 预览 `dist/` |
| `npm run deploy` | 构建后用 `gh-pages` 推送到 `gh-pages` 分支 |

---

## 目录结构

```
namori-diary/
├─ images/
│  └─ original/              # 原图归档（1072 张 jpg，文件名保持不变，不进入 dist）
├─ data/
│  ├─ userdata.json          # 可选：种子标注（存在时优先于 example）
│  └─ userdata.example.json  # 空 schema 示例
├─ public/
│  ├─ images/thumb/          # 480px WebP 缩略图（构建生成，已 gitignore）
│  ├─ images/large/          # 1400px WebP 大图（构建生成，已 gitignore）
│  └─ data/index.json        # 作品索引（构建生成，已 gitignore）
├─ scripts/
│  └─ build-index.mjs        # 数据管线：扫描原图 → 衍生图 → 索引
├─ src/
│  ├─ components/            # Layout / ItemCard / TagPicker / DateEditor / StickerEditor ...
│  ├─ lib/                   # 路由、日期、筛选、颜色、存储、canvas 工具
│  ├─ state/store.tsx        # 全局状态与 localStorage 持久化
│  ├─ views/                 # 首页 / 日历 / 图库 / 详情 / 校对 / 标签 / 合集 / 表情包 / 翻阅 / 角色 / 统计 / 数据
│  ├─ styles.css             # 设计变量、布局、通用组件
│  └─ styles-views.css       # 各视图样式、响应式与打印样式
├─ start.cmd                 # Windows 一键启动
├─ vite.config.ts            # base: './'，保证子路径部署可用
└─ .github/workflows/deploy.yml  # GitHub Pages 自动部署（Actions）
```

> 站点源码位于仓库根目录；`images/original/` 是图片归档，构建时只读取它，不会把原图复制进 `dist/`。

---

## 原图从哪来

数据脚本按以下优先级寻找原图目录：

1. 命令行参数：`node scripts/build-index.mjs --src="D:\path\to\images"`
2. 环境变量：`NAMORI_SRC=...`
3. 仓库内归档：`images/original/`
4. 本地相邻目录：`../namoridane/`（即 `c:\Users\zhouy\Desktop\namori-project\namoridane\`）

因此仓库内路径和本地旧路径都能直接跑。文件名必须满足：

```
YYYY-MM-DD-<11位 shortcode>[-序号].jpg
例如：2021-06-01-CPlLQUStuZq.jpg
      2021-03-30-CNCMS_qrxZJ-0.jpg
```

同一帖多图用 `-0 / -1 / ...` 后缀，脚本会自动计算 `postCount`，并生成稳定 id。

### 日期规则

- 文件名前缀是**发布日期**，索引中存为 `publishedAt`。
- 画面手写的日记只有「月 / 日」。脚本默认推断日记日期 = **发布日 − 1 天**，年份取发布年，记为 `inferredMonth / inferredDay / inferredYear`。
- 若推断结果跨月 / 跨年，会写入 `rollover: 'month' | 'year'`，进入「待校对」重点队列。
- 站点里可以手动改为图上的月 / 日，或一键「沿用发布日 / 沿用推断 / 恢复推断」，确认状态单独记录。

---

## 数据结构

### 1. 作品索引 `public/data/index.json`

由脚本生成，前端只读：

```jsonc
{
  "version": 1,
  "generatedAt": "2026-11-17T00:00:00.000Z",
  "count": 1072,
  "years": { "2021": 180, "2022": 260 },
  "items": [
    {
      "id": "2021-06-01-CPlLQUStuZq",
      "shortcode": "CPlLQUStuZq",
      "file": "2021-06-01-CPlLQUStuZq.jpg",
      "postIndex": 0,
      "postCount": 1,
      "publishedAt": "2021-06-01",
      "inferredMonth": 5,
      "inferredDay": 31,
      "inferredYear": 2021,
      "rollover": "",
      "thumb": "images/thumb/2021-06-01-CPlLQUStuZq.webp",
      "large": "images/large/2021-06-01-CPlLQUStuZq.webp",
      "w": 1080,
      "h": 1350,
      "palette": ["#f2e9df", "#c9a227", "..."],
      "color": "#e8dccb"
    }
  ]
}
```

### 2. 用户标注 v2（localStorage / 导入导出）

存储键：`namori.diary.userdata.v2`。完整类型见 [`src/types.ts`](src/types.ts)。

```jsonc
{
  "version": 2,
  "updatedAt": "2026-11-17T00:00:00.000Z",
  "dimensions": [
    { "id": "character", "name": "人物/角色", "order": 0, "builtIn": true },
    { "id": "scene", "name": "使用场景", "order": 1, "builtIn": true },
    { "id": "mood", "name": "情绪", "order": 2, "builtIn": true },
    { "id": "element", "name": "画面元素", "order": 3, "builtIn": true },
    { "id": "technique", "name": "技法", "order": 4, "builtIn": true }
  ],
  "tags": [
    { "id": "t_xxx", "name": "小魔女", "dimensionId": "character", "color": "#c96f4a", "createdAt": "..." }
  ],
  "collections": [
    {
      "id": "c_xxx",
      "name": "表情包素材",
      "description": "",
      "coverItemId": "2021-06-01-CPlLQUStuZq",
      "itemIds": ["2021-06-01-CPlLQUStuZq"],
      "createdAt": "...",
      "updatedAt": "..."
    }
  ],
  "items": {
    "2021-06-01-CPlLQUStuZq": {
      "tags": ["t_xxx"],
      "favorite": true,
      "note": "自由备注",
      "date": { "year": 2021, "month": 5, "day": 31, "confirmed": true, "source": "manual" },
      "study": {
        "composition": "构图拆解",
        "palette": "配色思路",
        "linework": "线条",
        "expression": "表情/神态",
        "memo": "自由备注"
      },
      "crop": { "cx": 0.5, "cy": 0.45, "size": 0.8, "tolerance": 18, "transparent": true },
      "updatedAt": "..."
    }
  }
}
```

- `date.source`：`inferred`（默认推断）/ `published`（沿用发布日）/ `manual`（手动改）。
- `crop` 为归一化比例，换尺寸导出时无需重算。
- 种子标注：把整理好的 JSON 放到 `data/userdata.json`，`npm run data` 会复制为 `public/data/userdata.seed.json`；首次访问（本地无数据时）自动载入。也可以随时在「数据管理」页手动「合并种子」。

---

## 功能一览

| 模块 | 说明 |
| --- | --- |
| 首页概览 | 总张数、覆盖年份、已打标签、未校对数量、最近更新；每日一图 / 随机抽卡；年份分布与常用标签入口 |
| 日历视图 | 按月翻页，格内缩略图；跳年 / 月、今天；筛选有图 / 缺图 / 收藏 / 待校对；打印月历 |
| 图库 | 等比瀑布流 + 懒加载，按月份分组；排序、只看收藏、只看未校对；多选批量操作 |
| 详情 | 大图、上一张 / 下一张、键盘方向键、Esc；发布日与日记日分开展示；标签、备注、收藏、分享链接 |
| 搜索筛选 | 关键词（标签 / 备注）、日期区间、年 / 月、合集、收藏；按维度标签组合，维度内 AND / OR，跨维度 AND |
| 标签系统 | 五组内置维度 + 自定义维度；标签增删改、颜色、使用计数、标签云、批量打标签 |
| 日期校对 | 待校对队列，输入月 / 日快速确认；一键沿用发布日 / 推断日；跨月跨年重点提示 |
| 表情包工坊 | 框选主体、白底转透明（可调容差）、240 / 512 方形导出 PNG / WebP；单张或 ZIP 批量；裁切参数自动保存 |
| 合集 | 多个命名合集、多选批量加入、拖拽排序、封面、单独浏览、导出清单（md / json / csv） |
| 模仿参考 | 拆解笔记（构图 / 配色 / 线条 / 表情神态 + 备注）、自动色板与色值、按标签 + 色板相似度推荐 |
| 日记翻阅 | 按日记日期顺序全屏翻书，自动隐藏界面，支持全屏 API |
| 角色图鉴 | 按「人物/角色」维度聚合，取代表图作封面 |
| 统计 | 总量、有画天数、最长连续记录、确认进度；月度柱状图、年度概览、标签分布、主色分布 |
| 数据管理 | 导出 / 导入 JSON、合并种子、清空本地标注、schema 与快捷键速查 |

### 快捷键

| 按键 | 作用 |
| --- | --- |
| `←` / `→` | 详情或翻阅模式下上一张 / 下一张 |
| `Esc` | 关闭详情 / 弹窗 |
| `/` | 聚焦全局搜索 |
| `R` | 随机抽一张 |
| `F` | 收藏 / 取消收藏（详情页） |
| `1` / `2` / `3` | 详情页切换「信息 / 拆解 / 表情包」 |
| `?` | 打开快捷键说明 |

---

## 增量构建说明

- 缓存文件：`.cache/images.json`，缓存键为 `文件名:目标尺寸:修改时间`。
- 重复执行 `npm run data` 时，未变化的图直接复用，通常 1 秒内完成。
- 需要强制重建：`npm run data:force`。
- 索引会校验文件存在性，不会把缓存里已删除的图写进 `index.json`。

---

## 新增一批图片

1. 把新 jpg 按 `YYYY-MM-DD-<shortcode>[-N].jpg` 命名，放进 `images/original/`。
2. 执行 `npm run data`（或直接 `npm run dev` / `npm run build`，都会自动跑）。
3. 打开站点确认新图数量；如日记日期与文件名不一致，在「校对」页处理。
4. 标注数据在浏览器本地，记得在「数据管理」导出 JSON 备份；如果要作为种子发布，放到 `data/userdata.json` 后重新构建。
5. 提交并推送，Pages 会按部署方式自动或手动更新。

> 原图体积较大，但只存在仓库归档目录，不进入 `dist/`；部署包只包含 WebP 衍生图（当前约 129MB，其中大图约 108MB）。如果只想轻量部署，可在 `scripts/build-index.mjs` 中调整大图尺寸或质量后重新生成。

---

## 部署到 GitHub Pages

仓库：<https://github.com/PayayaKamo/namoridane.git>

`vite.config.ts` 已设置 `base: './'`，因此部署在 `https://<user>.github.io/<repo>/` 子路径下也能正常加载资源与图片，无需改配置。

### 方式 A：GitHub Actions（推荐）

仓库已包含 `.github/workflows/deploy.yml`，推送到 `main` 后自动构建并发布：

1. 仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
2. 推送 `main`，等待 Actions 完成。
3. 打开 `https://payayakamo.github.io/namoridane/`。

> Actions 会执行 `npm ci && npm run build`，从仓库内 `images/original/` 读取原图并生成衍生图，再上传 `dist/`。

### 方式 B：`gh-pages` 分支

```bash
npm run deploy
```

该命令会构建并把 `dist/` 推到 `gh-pages` 分支。然后在 **Settings → Pages** 中选择 `gh-pages` 分支、`/ (root)` 目录。

### 本地验证子路径

```bash
npm run build
npx serve dist      # 或 npm run preview
```

---

## 已实现与后续计划

已实现：P0 全部功能、P1（翻阅、每日一图 / 随机、分享链接、角色图鉴）、P2 的临摹辅助（网格 / 灰度 / 镜像 / 并排对比）、月度年度统计、月历打印、快捷键面板。

后续可选（未实现，避免影响首屏与构建稳定性）：

- 素材板 moodboard：拖拽拼贴并导出图片
- PWA 离线安装（Service Worker 缓存衍生图）
- 更细的色板相似度算法与按色检索
- 多设备同步（需后端或第三方存储，当前坚持纯前端）

---

## 版权说明

插画版权归 Namori 老师所有。本仓库仅用于个人浏览、学习与临摹参考，请勿用于商业用途或二次分发原图。
