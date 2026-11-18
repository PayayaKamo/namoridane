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
import { useI18n } from '../i18n'
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
  const { t } = useI18n()
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
        if (!review) throw new Error(t('adminData.import.invalidReview'))
        const count = importReview(review)
        notify(t('adminData.import.reviewDone', { count }), 'success')
      } else {
        importData(json, mode)
        notify(
          mode === 'merge' ? t('adminData.import.mergeDone') : t('adminData.import.replaceDone'),
          'success',
        )
      }
    } catch (err) {
      console.error(err)
      notify(t('adminData.import.failed'), 'error')
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const exportAll = () => {
    const filename = `namori-diary-${new Date().toISOString().slice(0, 10)}.json`
    downloadJson(data, filename)
    notify(t('adminData.export.success'), 'success')
  }

  const exportPublic = () => {
    downloadJson(buildPublicData(data), 'public.json')
    localStorage.setItem(PUBLIC_STAMP_KEY, data.updatedAt)
    setPublishedAt(data.updatedAt)
    notify(t('adminData.export.publishDone'), 'success')
  }

  const writeToRepo = async (target: 'public' | 'review') => {
    const isPublic = target === 'public'
    const message = t(
      isPublic ? 'adminData.write.confirmPublic' : 'adminData.write.confirmReview',
    )
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
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || t('adminData.write.httpFailed', { status: res.status }))
      }
      if (isPublic) {
        localStorage.setItem(PUBLIC_STAMP_KEY, data.updatedAt)
        setPublishedAt(data.updatedAt)
      }
      const time = json.writtenAt ? new Date(json.writtenAt).toLocaleTimeString() : ''
      const params = { path: json.path ?? '', count: json.items ?? 0, time }
      notify(
        json.backup
          ? t('adminData.write.doneBackup', { ...params, backup: json.backup })
          : t('adminData.write.done', params),
        'success',
      )
    } catch (error) {
      notify(t('adminData.write.failed', { message: (error as Error).message }), 'error')
    } finally {
      setWritingLocal(null)
    }
  }

  const exportReview = () => {
    downloadReviewJson(allItems, annotations)
    notify(t('adminData.export.reviewDone'), 'success')
  }

  const exportExcluded = () => {
    const text = excludedItems.map((item) => item.file).join('\r\n')
    downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), 'namori-excluded-files.txt')
    notify(t('adminData.export.excludedDone', { count: excludedItems.length }), 'success')
  }

  const exportTranslations = (format: 'csv' | 'json') => {
    if (format === 'json') {
      const rows = items.map((item) => serializeTranslationRow(item))
      downloadJson({ type: 'namori-diary-translations', version: 1, rows }, 'namori-translations.json')
      notify(t('adminData.settings.translations.exportJsonDone', { count: rows.length }), 'success')
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
    notify(t('adminData.settings.translations.exportCsvDone', { count: items.length }), 'success')
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
      notify(t('adminData.settings.translations.importDone', { count }), 'success')
    } catch (err) {
      console.error(err)
      notify(t('adminData.settings.translations.importFailed'), 'error')
    } finally {
      setTranslationImporting(false)
      if (translationFileRef.current) translationFileRef.current.value = ''
    }
  }

  const restoreItem = async (item: DiaryItem) => {
    const ok = await restoreFilesFromTrash([item.file])
    restoreDeleted([item.id])
    notify(
      ok
        ? t('adminData.settings.trash.restored')
        : t('adminData.settings.trash.restoredLocalOnly'),
      ok ? 'success' : 'default',
    )
  }

  const purgeAll = async () => {
    if (!deletedItems.length) return
    setPurging(true)
    try {
      const removed = await purgeTrashFiles()
      if (removed === null) {
        notify(t('adminData.settings.trash.purgeNeedLocal'), 'error')
        return
      }
      clearDeletedRecords(deletedItems.map((item) => item.id))
      notify(t('adminData.settings.trash.purgeDone', { count: removed }), 'success')
    } finally {
      setPurging(false)
    }
  }

  return (
    <div className="data-view">
      <div className="page-head">
        <div>
          <div className="page-eyebrow">{t('shell.page.data.eyebrow')}</div>
          <h2 className="page-title">{t('shell.page.data.title')}</h2>
          <div className="page-sub">{t('adminData.page.subtitle')}</div>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={toggleTheme}>
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={14} />
            {theme === 'dark' ? t('shell.theme.switchToLight') : t('shell.theme.switchToDark')}
          </button>
        </div>
      </div>

      {hasUnpublished && (
        <div className="excluded-banner">
          <div>
            <strong>{t('adminData.settings.publish.unpublished')}</strong>
            <span>
              {t('adminData.settings.publish.unpublishedHintBefore')}<code>data/public.json</code>{t('adminData.settings.publish.unpublishedHintAfter')}
            </span>
          </div>
          <button className="btn btn-sm" onClick={exportPublic}>
            <Icon name="upload" size={14} />{t('adminData.export.publish')}
          </button>
        </div>
      )}

      <div className="data-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>{t('adminData.settings.current.title')}</h3>
            <span className="faint">
              {t('adminData.settings.current.updatedAt', { time: relativeTime(data.updatedAt) })}
            </span>
          </div>
          <div className="meta-list">
            <div className="meta-row"><span>{t('adminData.settings.current.datasetVersion')}</span><span className="num">{index?.datasetId ?? t('adminData.settings.current.notGenerated')}</span></div>
            <div className="meta-row"><span>{t('adminData.settings.current.localBinding')}</span><span className="num">{data.datasetId ?? t('adminData.settings.current.notBound')}</span></div>
            <div className="meta-row"><span>{t('adminData.settings.current.displayVsArchive')}</span><span className="num">{items.length} / {allItems.length}</span></div>
            <div className="meta-row"><span>{t('adminData.settings.current.confirmedDiary')}</span><span className="num">{confirmedDiaryItems.length}</span></div>
            <div className="meta-row"><span>{t('adminData.settings.current.pendingVsExcluded')}</span><span className="num">{pendingReviewItems.length} / {excludedItems.length}</span></div>
            <div className="meta-row"><span>{t('adminData.settings.current.deletedPending')}</span><span className="num">{deletedItems.length}</span></div>
            <div className="meta-row"><span>{t('adminData.settings.current.annotated')}</span><span className="num">{annotated}</span></div>
            <div className="meta-row"><span>{t('adminData.settings.current.translations')}</span><span className="num">{translationCount}</span></div>
            <div className="meta-row"><span>{t('adminData.settings.current.taxonomy')}</span><span className="num">{data.tags.length} / {data.characters.length} / {data.dimensions.length}</span></div>
            <div className="meta-row"><span>{t('adminData.settings.current.collections')}</span><span className="num">{data.collections.length} / {data.storylines.length}</span></div>
            <div className="meta-row"><span>{t('adminData.settings.current.storage')}</span><span className="num">{sizeKb} KB</span></div>
          </div>
          <div className="row row-wrap" style={{ gap: 8, marginTop: 16 }}>
            <button className="btn btn-primary" onClick={exportAll}>
              <Icon name="download" size={14} />
              {t('adminData.export.all')}
            </button>
            <button className="btn" onClick={() => fileRef.current?.click()} disabled={importing}>
              <Icon name="upload" size={14} />
              {importing ? t('adminData.import.importing') : t('adminData.import.json')}
            </button>
            <button className="btn" onClick={exportReview}>
              <Icon name="check" size={14} />{t('adminData.export.review')}
            </button>
            <button className="btn" onClick={exportExcluded} disabled={!excludedItems.length}>
              <Icon name="download" size={14} />{t('adminData.export.excluded')}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              tabIndex={-1}
              aria-label={t('adminData.import.aria')}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFile(file)
              }}
            />
          </div>
          <div className="row row-wrap" style={{ gap: 8, marginTop: 12 }}>
            <span className="field-label" style={{ margin: 0 }}>{t('adminData.import.label')}</span>
            <div className="segmented">
              <button className={mode === 'merge' ? 'active' : ''} onClick={() => setMode('merge')}>
                {t('adminData.import.merge')}
              </button>
              <button className={mode === 'replace' ? 'active' : ''} onClick={() => setMode('replace')}>
                {t('adminData.import.replace')}
              </button>
            </div>
            <span className="faint" style={{ fontSize: 11.5 }}>
              {t('adminData.import.mergeHint')}
            </span>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>{t('adminData.settings.publish.title')}</h3>
            <span className={`badge${hasUnpublished ? ' warn' : ''}`}>
              {hasUnpublished
                ? t('adminData.settings.publish.unpublished')
                : t('adminData.settings.publish.published')}
            </span>
          </div>
          <p className="muted" style={{ fontSize: 12.5 }}>
            {t('adminData.settings.publish.descriptionBefore')}<code>public.json</code>{t('adminData.settings.publish.descriptionBetween')}<code>data/public.json</code>{t('adminData.settings.publish.descriptionAfter')}
          </p>
          <p className="muted" style={{ fontSize: 12.5 }}>
            {t('adminData.settings.publish.buildHintBefore')}<code>npm run build:public</code>{t('adminData.settings.publish.buildHintAfter')}
          </p>
          <div className="row row-wrap" style={{ gap: 8, marginTop: 12 }}>
            <button className="btn btn-primary" onClick={exportPublic}>
              <Icon name="upload" size={14} />{t('adminData.export.publishFile')}
            </button>
            <button className="btn" onClick={loadSeed}>
              <Icon name="database" size={14} />
              {t('adminData.settings.publish.loadSeed')}
            </button>
          </div>
          {CAN_WRITE_LOCAL && (
            <>
              <div className="divider" />
              <p className="muted" style={{ fontSize: 12.5 }}>
                {t('adminData.settings.publish.writeHintBefore')}<code>.cache/data-backups/</code>{t('adminData.settings.publish.writeHintAfter')}
              </p>
              <div className="row row-wrap" style={{ gap: 8, marginTop: 12 }}>
                <button
                  className="btn"
                  onClick={() => void writeToRepo('public')}
                  disabled={writingLocal !== null}
                >
                  <Icon name="database" size={14} />
                  {writingLocal === 'public'
                    ? t('adminData.settings.publish.writing')
                    : t('adminData.settings.publish.writePublic')}
                </button>
                <button
                  className="btn"
                  onClick={() => void writeToRepo('review')}
                  disabled={writingLocal !== null}
                >
                  <Icon name="check" size={14} />
                  {writingLocal === 'review'
                    ? t('adminData.settings.publish.writing')
                    : t('adminData.settings.publish.writeReview')}
                </button>
              </div>
            </>
          )}
          <div className="divider" />
          <div className="panel-head">
            <h3>{t('adminData.settings.danger.title')}</h3>
          </div>
          <button className="btn btn-danger" onClick={() => setConfirmReset(true)}>
            <Icon name="trash" size={14} />
            {t('adminData.settings.danger.clear')}
          </button>
          <p className="faint" style={{ fontSize: 11.5, marginTop: 8 }}>
            {t('adminData.settings.danger.hint')}
          </p>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h3>{t('adminData.settings.trash.title')}</h3>
          <span className="faint">{t('common.itemCount', { count: deletedItems.length })}</span>
        </div>
        <p className="muted" style={{ fontSize: 12.5 }}>
          {t('adminData.settings.trash.descriptionBefore')}<code>images/_trash/</code>{t('adminData.settings.trash.descriptionBetween')}<code>npm run purge</code>{t('adminData.settings.trash.descriptionAfter')}
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
                        ? t('adminData.settings.trash.deletedAt', {
                            time: relativeTime(annotations[item.id]!.deletedAt!),
                          })
                        : t('adminData.settings.trash.markedDeleted')}
                    </span>
                  </div>
                  <button className="btn btn-sm" onClick={() => restoreItem(item)}>
                    <Icon name="refresh" size={13} />{t('adminData.settings.trash.restore')}
                  </button>
                </div>
              ))}
            </div>
            <div className="row" style={{ gap: 8, marginTop: 12 }}>
              <button className="btn btn-danger" onClick={purgeAll} disabled={purging}>
                <Icon name="trash" size={14} />
                {purging ? t('adminData.settings.trash.purging') : t('adminData.settings.trash.purge')}
              </button>
              <span className="faint" style={{ fontSize: 11.5 }}>
                {t('adminData.settings.trash.purgeHintBefore')}<code>npm run data</code>{t('adminData.settings.trash.purgeHintAfter')}
              </span>
            </div>
          </>
        ) : (
          <p className="faint" style={{ fontSize: 12 }}>{t('adminData.settings.trash.empty')}</p>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h3>{t('adminData.settings.translations.title')}</h3>
          <span className="faint">
            {t('adminData.settings.translations.filled', { count: translationCount })}
          </span>
        </div>
        <p className="muted" style={{ fontSize: 12.5 }}>
          {t('adminData.settings.translations.descriptionBefore')}<code>id, file, publishedAt, source, sourceDraft</code>{t('adminData.settings.translations.descriptionBetween')}<code>zh, en</code>{t('adminData.settings.translations.descriptionAfter')}
        </p>
        <div className="row row-wrap" style={{ gap: 8, marginTop: 12 }}>
          <button className="btn" onClick={() => exportTranslations('csv')}>
            <Icon name="download" size={14} />{t('adminData.settings.translations.exportCsv')}
          </button>
          <button className="btn" onClick={() => exportTranslations('json')}>
            <Icon name="download" size={14} />{t('adminData.settings.translations.exportJson')}
          </button>
          <button
            className="btn"
            onClick={() => translationFileRef.current?.click()}
            disabled={translationImporting}
          >
            <Icon name="upload" size={14} />
            {translationImporting
              ? t('adminData.settings.translations.importing')
              : t('adminData.settings.translations.import')}
          </button>
          <input
            ref={translationFileRef}
            type="file"
            accept=".csv,.json,text/csv,application/json"
            className="sr-only"
            tabIndex={-1}
            aria-label={t('adminData.settings.translations.importAria')}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleTranslationFile(file)
            }}
          />
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h3>{t('adminData.settings.schema.title')}</h3>
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
          {t('adminData.settings.schema.noteBefore')}<code>namori.diary.userdata.v2</code>{t('adminData.settings.schema.noteAfter')}
        </p>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h3>{t('adminData.settings.shortcuts.title')}</h3>
        </div>
        <div className="shortcut-list">
          {[
            ['← / →', t('adminData.settings.shortcuts.browse')],
            ['Esc', t('adminData.settings.shortcuts.close')],
            ['/', t('adminData.settings.shortcuts.search')],
            ['R', t('adminData.settings.shortcuts.random')],
            ['F', t('adminData.settings.shortcuts.favorite')],
            ['1 / 2', t('adminData.settings.shortcuts.tabs')],
            ['?', t('adminData.settings.shortcuts.panel')],
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
          title={t('adminData.settings.danger.confirmTitle')}
          onClose={() => setConfirmReset(false)}
          footer={
            <>
              <button className="btn" onClick={() => setConfirmReset(false)}>
                {t('common.cancel')}
              </button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  resetData()
                  setConfirmReset(false)
                }}
              >
                {t('adminData.settings.danger.confirmAction')}
              </button>
            </>
          }
        >
          <p>{t('adminData.settings.danger.confirmBody')}</p>
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
