/**
 * 公开构建的后处理：为每张作品和主要页面生成独立的静态 HTML。
 *
 * GitHub Pages 没有服务端 rewrite，深链直接打开或刷新需要真实文件；
 * 同时把 title / description / canonical / OG / JSON-LD 写进 HTML，
 * 让不执行 JavaScript 的抓取器也能读到每张作品的信息。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const DIST = path.join(ROOT, 'dist')
const SITE_URL = 'https://payayakamo.github.io/namoridane/'
const COVER = `${SITE_URL}og-cover.jpg`

const ROUTES = [
  {
    dir: 'gallery',
    title: '图库 · 水母绘日记 Namori Diary',
    description: '按年份与月份浏览 Namori 的全部手绘水母绘日记，可按标签、角色与翻译状态筛选。',
  },
  {
    dir: 'calendar',
    title: '日历 · 水母绘日记 Namori Diary',
    description: '用日历方式翻阅 Namori 的水母绘日记，看看每一天画了什么。',
  },
  {
    dir: 'reader',
    title: '翻阅 · 水母绘日记 Namori Diary',
    description: '沉浸式逐页翻阅 Namori 的手绘绘日记，支持键盘切换与连续阅读。',
  },
  {
    dir: 'search',
    title: '搜索与筛选 · 水母绘日记 Namori Diary',
    description: '按关键词、日期、标签、角色与翻译状态搜索 Namori 的水母绘日记插画。',
  },
  {
    dir: 'characters',
    title: '角色图鉴 · 水母绘日记 Namori Diary',
    description: '按角色聚合 Namori 绘日记中的全部出场，查看每个角色的作品与头像。',
  },
  {
    dir: 'stats',
    title: '统计 · 水母绘日记 Namori Diary',
    description: '查看水母绘日记的收录数量、年份分布、标签与角色出场统计。',
  },
  {
    dir: 'storylines',
    title: '故事线 · 水母绘日记 Namori Diary',
    description: '把绘日记按主题串成故事线，按顺序重读 Namori 的手绘日常。',
  },
  {
    dir: 'about',
    title: '关于 · 水母绘日记 Namori Diary',
    description: '水母绘日记的联系方式与站点信息：GitHub、小红书、微信公众号，以及版本号、构建时间与数据规模。',
  },
]

const META_RE = (kind, key) => new RegExp(`<meta\\s+${kind}="${escapeRegExp(key)}"[\\s\\S]*?/>`, 'i')

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeXml(value) {
  return escapeHtml(value).replace(/'/g, '&apos;')
}

function replaceMeta(html, kind, key, value) {
  const tag = `<meta ${kind}="${key}" content="${escapeHtml(value)}" />`
  const re = META_RE(kind, key)
  if (re.test(html)) return html.replace(re, tag)
  return html.replace('</head>', `    ${tag}\n  </head>`)
}

function replaceHead(html, { title, description, url, image, imageAlt, imageWidth, imageHeight, type }) {
  let next = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`)
  next = replaceMeta(next, 'name', 'description', description)
  next = replaceMeta(next, 'property', 'og:type', type)
  next = replaceMeta(next, 'property', 'og:title', title)
  next = replaceMeta(next, 'property', 'og:description', description)
  next = replaceMeta(next, 'property', 'og:url', url)
  next = replaceMeta(next, 'property', 'og:image', image)
  next = replaceMeta(next, 'property', 'og:image:width', String(imageWidth))
  next = replaceMeta(next, 'property', 'og:image:height', String(imageHeight))
  next = replaceMeta(next, 'property', 'og:image:alt', imageAlt)
  next = replaceMeta(next, 'name', 'twitter:title', title)
  next = replaceMeta(next, 'name', 'twitter:description', description)
  next = replaceMeta(next, 'name', 'twitter:image', image)
  next = replaceMeta(next, 'name', 'twitter:image:alt', imageAlt)
  next = next.replace(
    /<link rel="canonical" href="[^"]*"\s*\/?>/i,
    `<link rel="canonical" href="${escapeHtml(url)}" />`,
  )
  return next
}

function replaceNoscript(html, content) {
  const re = /<noscript>[\s\S]*?<\/noscript>/i
  if (re.test(html)) return html.replace(re, `<noscript>${content}</noscript>`)
  return html.replace('<div id="root"></div>', `<div id="root"></div>\n    <noscript>${content}</noscript>`)
}

function insertJsonLd(html, payload) {
  const script = `<script type="application/ld+json" id="page-seo-jsonld">${JSON.stringify(payload)}</script>`
  return html.replace('</head>', `    ${script}\n  </head>`)
}

function normalizeDate(annotation, item) {
  if (annotation?.date?.confirmed) {
    const { year, month, day } = annotation.date
    return {
      iso: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      label: `${year} 年 ${month} 月 ${day} 日`,
    }
  }
  if (item.publishedAt) {
    const [year, month, day] = item.publishedAt.split('-')
    return { iso: item.publishedAt, label: `${year} 年 ${month} 月 ${day} 日发布` }
  }
  return { iso: '', label: '日期待定' }
}

function captionSnippet(caption) {
  if (!caption) return ''
  const text = String(caption).replace(/\s+/g, ' ').trim()
  return text.length > 110 ? `${text.slice(0, 110)}…` : text
}

function writeFile(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content)
}

function main() {
  const templatePath = path.join(DIST, 'index.html')
  const indexPath = path.join(DIST, 'data', 'index.json')
  if (!fs.existsSync(templatePath) || !fs.existsSync(indexPath)) {
    throw new Error('找不到 dist/index.html 或 dist/data/index.json，请先执行公开构建')
  }

  const template = fs.readFileSync(templatePath, 'utf8')
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'))
  const seedPath = path.join(DIST, 'data', 'userdata.seed.json')
  const seed = fs.existsSync(seedPath) ? JSON.parse(fs.readFileSync(seedPath, 'utf8')) : { items: {}, tags: [] }
  const tags = new Map((seed.tags ?? []).map((tag) => [tag.id, tag.name]))
  const annotations = seed.items ?? {}

  const items = Array.isArray(index.items) ? index.items : []
  const generatedAt = new Date().toISOString().slice(0, 10)

  // 主要页面
  for (const route of ROUTES) {
    const url = `${SITE_URL}${route.dir}/`
    let page = replaceHead(template, {
      title: route.title,
      description: route.description,
      url,
      image: COVER,
      imageAlt: '三张 Namori 水母绘日记手绘插画拼贴',
      imageWidth: 1200,
      imageHeight: 630,
      type: 'website',
    })
    page = replaceNoscript(
      page,
      `<h1>${escapeHtml(route.title)}</h1><p>${escapeHtml(route.description)}</p><p>本站浏览需要启用 JavaScript。</p>`,
    )
    writeFile(path.join(DIST, route.dir, 'index.html'), page)
  }

  // 每张作品的独立页面
  for (const item of items) {
    const url = `${SITE_URL}item/${encodeURIComponent(item.id)}/`
    const annotation = annotations[item.id]
    const date = normalizeDate(annotation, item)
    const tagNames = (annotation?.tags ?? []).flatMap((id) => (tags.has(id) ? [tags.get(id)] : []))
    const title = date.iso ? `Namori 绘日记 ${date.iso} · 水母绘日记` : 'Namori 绘日记 · 水母绘日记'
    const image = `${SITE_URL}${item.original}`
    const thumb = `${SITE_URL}${item.thumb}`
    const snippet = captionSnippet(item.caption)
    const description = `Namori 的手绘绘日记（${date.label}）。${
      tagNames.length ? `出场：${tagNames.slice(0, 4).join('、')}。` : ''
    }${snippet || '可查看大图、原文案与临摹拆解。'}`

    let page = replaceHead(template, {
      title,
      description,
      url,
      image,
      imageAlt: `Namori 水母绘日记 ${date.iso} 手绘插画`,
      imageWidth: item.w,
      imageHeight: item.h,
      type: 'article',
    })
    page = replaceNoscript(
      page,
      `<h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p>` +
        `<p><img src="${escapeHtml(thumb)}" alt="${escapeHtml(`Namori 水母绘日记 ${date.iso} 手绘插画`)}" /></p>` +
        `<p>收录于 <a href="${SITE_URL}">水母绘日记 · Namori Diary</a>` +
        (item.permalink ? ` · <a href="${escapeHtml(item.permalink)}">Instagram 原帖</a>` : '') +
        '</p><p>本站浏览需要启用 JavaScript。</p>',
    )
    page = insertJsonLd(page, {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'ImageObject',
          '@id': `${url}#image`,
          url,
          contentUrl: image,
          thumbnailUrl: thumb,
          name: title,
          caption: description,
          datePublished: item.publishedAt || undefined,
          creator: { '@type': 'Person', name: 'Namori', sameAs: 'https://www.instagram.com/namoridane' },
          isPartOf: { '@id': `${SITE_URL}#website` },
          width: item.w,
          height: item.h,
          encodingFormat: 'image/jpeg',
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: '水母绘日记 · Namori Diary', item: SITE_URL },
            { '@type': 'ListItem', position: 2, name: title, item: url },
          ],
        },
      ],
    })
    writeFile(path.join(DIST, 'item', item.id, 'index.html'), page)
  }

  // sitemap：首页 + 主要页面 + 每张作品
  const urls = [
    `<url><loc>${SITE_URL}</loc><lastmod>${generatedAt}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority>` +
      `<image:image><image:loc>${COVER}</image:loc><image:title>Namori 水母绘日记插画集</image:title></image:image></url>`,
    ...ROUTES.map(
      (route) =>
        `<url><loc>${SITE_URL}${route.dir}/</loc><lastmod>${generatedAt}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`,
    ),
    ...items.map((item) => {
      const annotation = annotations[item.id]
      const date = normalizeDate(annotation, item)
      const title = date.iso ? `Namori 绘日记 ${date.iso}` : 'Namori 绘日记'
      return (
        `<url><loc>${SITE_URL}item/${encodeURIComponent(item.id)}/</loc><lastmod>${generatedAt}</lastmod><changefreq>monthly</changefreq><priority>0.6</priority>` +
        `<image:image><image:loc>${SITE_URL}${item.large}</image:loc>` +
        `<image:title>${escapeXml(title)}</image:title><image:caption>Namori 水母绘日记手绘插画</image:caption></image:image></url>`
      )
    }),
  ]
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
>
${urls.join('\n')}
</urlset>
`
  writeFile(path.join(DIST, 'sitemap.xml'), sitemap)

  // GitHub Pages 的未知路径回退：返回应用外壳，由客户端路由接管
  fs.copyFileSync(templatePath, path.join(DIST, '404.html'))

  console.log(`[pages] ${items.length} 个作品页、${ROUTES.length} 个栏目页、sitemap 与 404.html 已生成`)
}

main()
