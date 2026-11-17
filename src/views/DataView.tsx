import { useMemo, useRef, useState } from 'react'
import { useStore } from '../state/store'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { downloadJson } from '../lib/storage'
import { downloadBlob } from '../lib/image'
import { relativeTime } from '../lib/dates'
import { downloadReviewJson, parseReviewExport } from '../lib/review'
import { buildPublicData } from '../lib/publish'
import { IS_PUBLIC } from '../lib/appMode'
import { purgeTrashFiles, restoreFilesFromTrash } from '../lib/trash'
import type { DiaryItem, TranslationSlot } from '../types'

const PUBLIC_STAMP_KEY = 'namori.diary.publishedAt'
// 仅本地 dev 管理端提供写盘按钮；正式构建里会被静态折叠掉
const CAN_WRITE_LOCAL = import.meta.env.DEV && !IS_PUBLIC
const TRANSLATION_META_COLUMNS = new Set(['id', 'file', 'publishedAt', 'source', 'sourcedraft', 'updatedAt'])

interface TranslationRow {
  id: string
  source: string
  sourceDraft?: string
  slots: TranslationSlot[]
}

export function DataView() {
  const {
    data,
    items,
    allItems,
    itemMap,
    index,
    excludedItems,
    deletedItems,
    confirmedDiaryItems,
    pendingReviewItems,
    annotations,
    importData,
    importReview,
    importTranslations,
    restoreDeleted,
    clearDeletedRecords,
    loadSeed,
    resetData,
    notify,
    theme,
    toggleTheme,
  } = useStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const translationFileRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<'merge' | 'replace'>('merge')
  const [confirmReset, setConfirmReset] = useState(false)
  const [importing, setImporting] = useState(false)
  const [purging, setPurging] = useState(false)
  const [writingLocal, setWritingLocal] = useState<'public' | 'review' | null>(null)
  const [translationImporting, setTranslationImporting] = useState(false)
  const [publishedAt, setPublishedAt] = useState(() => localStorage.getItem(PUBLIC_STAMP_KEY) ?? '')

  const sizeKb = Math.round(new Blob([JSON.stringify(data)]).size / 1024)
  const annotated = Object.keys(annotations).length
  const hasUnpublished = !publishedAt || data.updatedAt > publishedAt

  const translationSlots = useMemo(() => {
    const langs = new Set(['zh', 'en'])
    for (const ann of Object.values(annotations)) {
      for (const slot of ann.translation?.slots ?? []) langs.add(slot.lang)
    }
    return [...langs]
  }, [annotations])

  const translationCount = useMemo(
    () =>
      Object.values(annotations).filter((ann) => {
        const t = ann.translation
        return Boolean(t && (t.source.trim() || t.slots.some((s) => s.text.trim())))
      }).length,
    [annotations],
  )

  const handleFile = async (file: File) => {
    setImporting(true)
    try {
      const text = await file.text()
      const json = JSON.parse(text)
      if (json?.type === 'namori-diary-review') {
        const review = parseReviewExport(json)
        if (!review) throw new Error('审核 JSON 格式不完整')
        const count = importReview(review)
        notify(`已导入 ${count} 条审核结果，其他标注保持不变`, 'success')
      } else {
        importData(json, mode)
        notify(mode === 'merge' ? '已合并导入的标注' : '已替换为导入的标注', 'success')
      }
    } catch (err) {
      console.error(err)
      notify('导入失败：不是有效的 JSON', 'error')
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const exportAll = () => {
    const filename = `namori-diary-${new Date().toISOString().slice(0, 10)}.json`
    downloadJson(data, filename)
    notify('导出成功', 'success')
  }

  const exportPublic = () => {
    downloadJson(buildPublicData(data), 'public.json')
    localStorage.setItem(PUBLIC_STAMP_KEY, data.updatedAt)
    setPublishedAt(data.updatedAt)
    notify('已导出发布数据，请把 public.json 放到 data/public.json 后提交', 'success')
  }

  const writeToRepo = async (target: 'public' | 'review') => {
    const isPublic = target === 'public'
    const message = isPublic
      ? '确认把当前数据裁剪成公开内容并写入仓库 data/public.json？旧文件会先备份。'
      : '确认把完整审核数据写入仓库 data/userdata.json？其中包含备注等私有内容，该文件已被 gitignore。旧文件会先备份。'
    if (!window.confirm(message)) return
    setWritingLocal(target)
    try {
      const payload = isPublic ? buildPublicData(data) : data
      const res = await fetch(`/__admin/write-data?target=${target}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string; path?: string; backup?: string | null; writtenAt?: string; items?: number }
        | null
      if (!res.ok || !json?.ok) throw new Error(json?.error || `写入失败（HTTP ${res.status}）`)
      if (isPublic) {
        localStorage.setItem(PUBLIC_STAMP_KEY, data.updatedAt)
        setPublishedAt(data.updatedAt)
      }
      const time = json.writtenAt ? new Date(json.writtenAt).toLocaleTimeString() : ''
      const backup = json.backup ? `，备份 ${json.backup}` : ''
      notify(`已写入 ${json.path}（${json.items ?? 0} 条）${backup}，${time}`, 'success')
    } catch (error) {
      notify(`写入失败：${(error as Error).message}`, 'error')
    } finally {
      setWritingLocal(null)
    }
  }

  const exportReview = () => {
    downloadReviewJson(allItems, annotations)
    notify('已导出审核状态与日记日期，原始图片不受影响', 'success')
  }

  const exportExcluded = () => {
    const text = excludedItems.map((item) => item.file).join('\r\n')
    downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), 'namori-excluded-files.txt')
    notify(`已导出 ${excludedItems.length} 个非绘日记文件名`, 'success')
  }

  const exportTranslations = (format: 'csv' | 'json') => {
    if (format === 'json') {
      const rows = items.map((item) => serializeTranslationRow(item))
      downloadJson({ type: 'namori-diary-translations', version: 1, rows }, 'namori-translations.json')
      notify(`已导出 ${rows.length} 条翻译数据`, 'success')
      return
    }
    const header = ['id', 'file', 'publishedAt', 'source', 'sourceDraft', ...translationSlots]
    const lines = [header.map(csvCell).join(',')]
    for (const item of items) {
      const row = serializeTranslationRow(item)
      const slotMap = new Map(row.slots.map((slot) => [slot.lang, slot.text]))
      lines.push(
        [
          row.id,
          item.file,
          item.publishedAt,
          row.source,
          row.sourceDraft ?? '',
          ...translationSlots.map((lang) => slotMap.get(lang) ?? ''),
        ]
          .map(csvCell)
          .join(','),
      )
    }
    downloadBlob(new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), 'namori-translations.csv')
    notify(`已导出 ${items.length} 条翻译对照`, 'success')
  }

  const serializeTranslationRow = (item: DiaryItem): TranslationRow => {
    const translation = annotations[item.id]?.translation
    return {
      id: item.id,
      source: translation?.source ?? '',
      sourceDraft: translation?.sourceDraft,
      slots: translation?.slots.map((slot) => ({ ...slot })) ?? [],
    }
  }

  const handleTranslationFile = async (file: File) => {
    setTranslationImporting(true)
    try {
      const text = await file.text()
      const rows = file.name.toLowerCase().endsWith('.csv')
        ? parseTranslationCsv(text, itemMap)
        : parseTranslationJson(text, itemMap)
      if (!rows.length) throw new Error('empty')
      const count = importTranslations(rows)
      notify(`已回填 ${count} 条翻译，标签与日期保持不变`, 'success')
    } catch (err) {
      console.error(err)
      notify('翻译导入失败：请使用本页导出的 CSV 或 JSON 模板', 'error')
    } finally {
      setTranslationImporting(false)
      if (translationFileRef.current) translationFileRef.current.value = ''
    }
  }

  const restoreItem = async (item: DiaryItem) => {
    const ok = await restoreFilesFromTrash([item.file])
    restoreDeleted([item.id])
    notify(
      ok ? '已恢复原图与记录' : '已恢复记录；原图恢复需在本地管理端执行，请检查 images/_trash',
      ok ? 'success' : 'default',
    )
  }

  const purgeAll = async () => {
    if (!deletedItems.length) return
    setPurging(true)
    try {
      const removed = await purgeTrashFiles()
      if (removed === null) {
        notify('原图清理需在本地管理端执行：运行 npm run purge', 'error')
        return
      }
      clearDeletedRecords(deletedItems.map((item) => item.id))
      notify(`已彻底删除 ${removed} 个原图，请运行 npm run data 同步索引`, 'success')
    } finally {
      setPurging(false)
    }
  }

  return (
    <div className="data-view">
      <div className="page-head">
        <div>
          <div className="page-eyebrow">Data & Settings</div>
          <h2 className="page-title">数据与设置</h2>
          <div className="page-sub">审核状态、日期、标签、收藏、备注、翻译和裁切参数都保存在浏览器本地，可随时导出 JSON 备份</div>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={toggleTheme}>
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={14} />
            {theme === 'dark' ? '切换亮色' : '切换暗色'}
          </button>
        </div>
      </div>

      {hasUnpublished && (
        <div className="excluded-banner">
          <div>
            <strong>有未发布的修改</strong>
            <span>
              本地数据比最近一次发布更新。公开站只读取 <code>data/public.json</code>，导出并提交后才会生效。
            </span>
          </div>
          <button className="btn btn-sm" onClick={exportPublic}>
            <Icon name="upload" size={14} />导出发布数据
          </button>
        </div>
      )}

      <div className="data-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>当前数据</h3>
            <span className="faint">更新于 {relativeTime(data.updatedAt)}</span>
          </div>
          <div className="meta-list">
            <div className="meta-row"><span>数据集版本</span><span className="num">{index?.datasetId ?? '未生成'}</span></div>
            <div className="meta-row"><span>本地标注绑定版本</span><span className="num">{data.datasetId ?? '未绑定'}</span></div>
            <div className="meta-row"><span>当前显示 / 原始归档</span><span className="num">{items.length} / {allItems.length}</span></div>
            <div className="meta-row"><span>已确认绘日记</span><span className="num">{confirmedDiaryItems.length}</span></div>
            <div className="meta-row"><span>待确认 / 非绘日记</span><span className="num">{pendingReviewItems.length} / {excludedItems.length}</span></div>
            <div className="meta-row"><span>待清理（已删除）</span><span className="num">{deletedItems.length}</span></div>
            <div className="meta-row"><span>已标注作品</span><span className="num">{annotated}</span></div>
            <div className="meta-row"><span>翻译条数</span><span className="num">{translationCount}</span></div>
            <div className="meta-row"><span>标签 / 人物 / 维度</span><span className="num">{data.tags.length} / {data.characters.length} / {data.dimensions.length}</span></div>
            <div className="meta-row"><span>合集 / 故事线</span><span className="num">{data.collections.length} / {data.storylines.length}</span></div>
            <div className="meta-row"><span>本地存储占用</span><span className="num">{sizeKb} KB</span></div>
          </div>
          <div className="row row-wrap" style={{ gap: 8, marginTop: 16 }}>
            <button className="btn btn-primary" onClick={exportAll}>
              <Icon name="download" size={14} />
              导出全部 JSON
            </button>
            <button className="btn" onClick={() => fileRef.current?.click()} disabled={importing}>
              <Icon name="upload" size={14} />
              {importing ? '导入中…' : '导入 JSON'}
            </button>
            <button className="btn" onClick={exportReview}>
              <Icon name="check" size={14} />导出审核 JSON
            </button>
            <button className="btn" onClick={exportExcluded} disabled={!excludedItems.length}>
              <Icon name="download" size={14} />导出非绘日记名单
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              tabIndex={-1}
              aria-label="导入 JSON 文件"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFile(file)
              }}
            />
          </div>
          <div className="row row-wrap" style={{ gap: 8, marginTop: 12 }}>
            <span className="field-label" style={{ margin: 0 }}>导入方式</span>
            <div className="segmented">
              <button className={mode === 'merge' ? 'active' : ''} onClick={() => setMode('merge')}>
                合并
              </button>
              <button className={mode === 'replace' ? 'active' : ''} onClick={() => setMode('replace')}>
                覆盖
              </button>
            </div>
            <span className="faint" style={{ fontSize: 11.5 }}>
              合并会保留现有标签与合集；覆盖会完全使用文件内的数据。审核 JSON 始终只更新审核状态和已确认日期，保留其他标注。
            </span>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>发布数据</h3>
            <span className={`badge${hasUnpublished ? ' warn' : ''}`}>
              {hasUnpublished ? '有未发布的修改' : '已发布'}
            </span>
          </div>
          <p className="muted" style={{ fontSize: 12.5 }}>
            导出会得到裁剪过的 <code>public.json</code>：只保留人工确认的日期、公开故事线、翻译与人物标签，
            去掉私密备注、非绘日记和已删除图片。把它放到 <code>data/public.json</code> 并提交，公开站构建会读取它。
          </p>
          <p className="muted" style={{ fontSize: 12.5 }}>
            公开站使用 <code>npm run build:public</code>，只含浏览、检索与故事线阅读；管理入口不会被打包。
          </p>
          <div className="row row-wrap" style={{ gap: 8, marginTop: 12 }}>
            <button className="btn btn-primary" onClick={exportPublic}>
              <Icon name="upload" size={14} />导出发布数据 public.json
            </button>
            <button className="btn" onClick={loadSeed}>
              <Icon name="database" size={14} />
              合并仓库种子标注
            </button>
          </div>
          {CAN_WRITE_LOCAL && (
            <>
              <div className="divider" />
              <p className="muted" style={{ fontSize: 12.5 }}>
                本地开发写盘（仅 dev 管理端可用）：直接写入仓库文件，写入前自动备份到{' '}
                <code>.cache/data-backups/</code>。公开写回会再次裁剪私有字段。
              </p>
              <div className="row row-wrap" style={{ gap: 8, marginTop: 12 }}>
                <button
                  className="btn"
                  onClick={() => void writeToRepo('public')}
                  disabled={writingLocal !== null}
                >
                  <Icon name="database" size={14} />
                  {writingLocal === 'public' ? '写入中…' : '写入 data/public.json'}
                </button>
                <button
                  className="btn"
                  onClick={() => void writeToRepo('review')}
                  disabled={writingLocal !== null}
                >
                  <Icon name="check" size={14} />
                  {writingLocal === 'review' ? '写入中…' : '写入审核数据'}
                </button>
              </div>
            </>
          )}
          <div className="divider" />
          <div className="panel-head">
            <h3>危险操作</h3>
          </div>
          <button className="btn btn-danger" onClick={() => setConfirmReset(true)}>
            <Icon name="trash" size={14} />
            清空本地标注
          </button>
          <p className="faint" style={{ fontSize: 11.5, marginTop: 8 }}>
            清空后标签、合集、笔记、裁切参数都会消失，图片索引不受影响。建议先导出备份。
          </p>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h3>待清理原图</h3>
          <span className="faint">{deletedItems.length} 张</span>
        </div>
        <p className="muted" style={{ fontSize: 12.5 }}>
          删除时原图会先移到 <code>images/_trash/</code>，这里可以恢复或彻底清理。
          彻底清理属于本地管理端动作：在 dev server 下可直接执行，否则请运行 <code>npm run purge</code>。
        </p>
        {deletedItems.length ? (
          <>
            <div className="trash-list">
              {deletedItems.map((item) => (
                <div key={item.id} className="trash-row">
                  <img src={`${import.meta.env.BASE_URL}${item.thumb}`} alt="" loading="lazy" />
                  <div className="trash-info">
                    <span className="num">{item.file}</span>
                    <span className="faint">
                      {annotations[item.id]?.deletedAt
                        ? `删除于 ${relativeTime(annotations[item.id]!.deletedAt!)}`
                        : '已标记删除'}
                    </span>
                  </div>
                  <button className="btn btn-sm" onClick={() => restoreItem(item)}>
                    <Icon name="refresh" size={13} />恢复
                  </button>
                </div>
              ))}
            </div>
            <div className="row" style={{ gap: 8, marginTop: 12 }}>
              <button className="btn btn-danger" onClick={purgeAll} disabled={purging}>
                <Icon name="trash" size={14} />
                {purging ? '清理中…' : '执行清理'}
              </button>
              <span className="faint" style={{ fontSize: 11.5 }}>
                原图清理需在本地管理端执行；清理后请运行 <code>npm run data</code> 同步索引与衍生图。
              </span>
            </div>
          </>
        ) : (
          <p className="faint" style={{ fontSize: 12 }}>没有待清理的图片。</p>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h3>翻译导入导出</h3>
          <span className="faint">{translationCount} 条已填写</span>
        </div>
        <p className="muted" style={{ fontSize: 12.5 }}>
          CSV 列固定为 <code>id, file, publishedAt, source, sourceDraft</code>，之后是语言槽位列（默认 <code>zh, en</code>）。
          JSON 是同样字段的数组，可用外部翻译工具处理后原样导回；导入只更新翻译字段，标签、日期和审核状态保持不变。
        </p>
        <div className="row row-wrap" style={{ gap: 8, marginTop: 12 }}>
          <button className="btn" onClick={() => exportTranslations('csv')}>
            <Icon name="download" size={14} />导出 CSV 对照
          </button>
          <button className="btn" onClick={() => exportTranslations('json')}>
            <Icon name="download" size={14} />导出 JSON
          </button>
          <button
            className="btn"
            onClick={() => translationFileRef.current?.click()}
            disabled={translationImporting}
          >
            <Icon name="upload" size={14} />
            {translationImporting ? '导入中…' : '导入翻译回填'}
          </button>
          <input
            ref={translationFileRef}
            type="file"
            accept=".csv,.json,text/csv,application/json"
            className="sr-only"
            tabIndex={-1}
            aria-label="导入翻译 CSV 或 JSON"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleTranslationFile(file)
            }}
          />
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h3>数据结构速查</h3>
          <span className="faint">v{data.version}</span>
        </div>
        <pre className="schema-pre">{`{
  version: 2,
  dimensions: [{ id, name, order, builtIn }],
  tags:       [{ id, name, dimensionId, color, createdAt }],
  characters: [{ id, avatarItemId?, avatarDataUrl?, avatarCrop?, note?, createdAt }],
  collections:[{ id, name, description, coverItemId, itemIds[], createdAt, updatedAt }],
  storylines: [{ id, title, description, coverItemId, blocks[], tags[], published, createdAt, updatedAt }],
  items: {
    [itemId]: {
      tags: string[],
      favorite: boolean,
      reviewed: boolean,
      excluded: boolean,
      deleted: boolean,
      deletedAt?: string,
      note: string,
      date?:     { year, month, day, confirmed, source },
      translation?: { source, sourceDraft?, slots: [{ lang, label, text }], updatedAt },
      study?:    { composition, palette, linework, expression, memo },
      crop?:     { cx, cy, size, tolerance, transparent },
      updatedAt: string
    }
  }
}`}</pre>
        <p className="faint" style={{ fontSize: 11.5 }}>
          数据全部通过 localStorage（键名 <code>namori.diary.userdata.v2</code>）持久化，不使用任何后端或账号。
        </p>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h3>快捷键</h3>
        </div>
        <div className="shortcut-list">
          {[
            ['← / →', '详情与翻阅中切换作品'],
            ['Esc', '关闭详情'],
            ['/', '聚焦顶部搜索'],
            ['R', '随机抽一张'],
            ['F', '收藏当前作品'],
            ['1 / 2', '详情切换到信息 / 拆解'],
            ['?', '快捷键面板'],
          ].map(([key, desc]) => (
            <div key={key} className="shortcut-row">
              <kbd>{key}</kbd>
              <span>{desc}</span>
            </div>
          ))}
        </div>
      </section>

      {confirmReset && (
        <Modal
          title="清空本地标注"
          onClose={() => setConfirmReset(false)}
          footer={
            <>
              <button className="btn" onClick={() => setConfirmReset(false)}>
                取消
              </button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  resetData()
                  setConfirmReset(false)
                }}
              >
                确认清空
              </button>
            </>
          }
        >
          <p>此操作不可撤销，除非你事先导出了 JSON。确定继续吗？</p>
        </Modal>
      )}
    </div>
  )
}

function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          quoted = false
        }
      } else {
        field += ch
      }
    } else if (ch === '"') {
      quoted = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (ch !== '\r') {
      field += ch
    }
  }
  if (field.length || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((cells) => cells.some((cell) => cell.trim()))
}

function parseTranslationCsv(text: string, itemMap: Map<string, DiaryItem>): TranslationRow[] {
  const [headerRow, ...body] = parseCsv(text)
  if (!headerRow) return []
  const header = headerRow.map((cell) => cell.trim())
  const idIndex = header.indexOf('id')
  const fileIndex = header.indexOf('file')
  const sourceIndex = header.indexOf('source')
  const draftIndex = header.findIndex((cell) => cell.toLowerCase() === 'sourcedraft')
  const langColumns = header
    .map((cell, index) => ({ cell, index }))
    .filter(({ cell }) => cell && !TRANSLATION_META_COLUMNS.has(cell.toLowerCase()) && !cell.startsWith('__'))

  const rows: TranslationRow[] = []
  for (const cells of body) {
    const id = resolveRowId(cells, idIndex, fileIndex, itemMap)
    if (!id) continue
    const slots: TranslationSlot[] = []
    for (const { cell, index } of langColumns) {
      const value = cells[index] ?? ''
      slots.push({ lang: cell, label: cell, text: value })
    }
    rows.push({
      id,
      source: sourceIndex >= 0 ? cells[sourceIndex] ?? '' : '',
      sourceDraft: draftIndex >= 0 ? cells[draftIndex] ?? '' : undefined,
      slots,
    })
  }
  return rows
}

function parseTranslationJson(text: string, itemMap: Map<string, DiaryItem>): TranslationRow[] {
  const json = JSON.parse(text)
  const list: unknown[] = Array.isArray(json) ? json : Array.isArray(json?.rows) ? json.rows : []
  const rows: TranslationRow[] = []
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue
    const value = entry as Record<string, unknown>
    const id = typeof value.id === 'string' ? value.id : ''
    const file = typeof value.file === 'string' ? value.file : ''
    const targetId = id && itemMap.has(id) ? id : file ? [...itemMap.values()].find((item) => item.file === file)?.id : undefined
    if (!targetId || !itemMap.has(targetId)) continue
    const slots = Array.isArray(value.slots)
      ? value.slots
          .filter((slot): slot is Record<string, unknown> => Boolean(slot) && typeof slot === 'object')
          .map((slot) => ({
            lang: typeof slot.lang === 'string' ? slot.lang : '',
            label: typeof slot.label === 'string' ? slot.label : typeof slot.lang === 'string' ? slot.lang : '',
            text: typeof slot.text === 'string' ? slot.text : '',
          }))
          .filter((slot) => slot.lang)
      : []
    rows.push({
      id: targetId,
      source: typeof value.source === 'string' ? value.source : '',
      sourceDraft: typeof value.sourceDraft === 'string' ? value.sourceDraft : undefined,
      slots,
    })
  }
  return rows
}

function resolveRowId(
  cells: string[],
  idIndex: number,
  fileIndex: number,
  itemMap: Map<string, DiaryItem>,
): string | null {
  const id = idIndex >= 0 ? cells[idIndex]?.trim() : ''
  if (id && itemMap.has(id)) return id
  const file = fileIndex >= 0 ? cells[fileIndex]?.trim() : ''
  if (file) {
    const byFile = [...itemMap.values()].find((item) => item.file === file)
    if (byFile) return byFile.id
  }
  return null
}
