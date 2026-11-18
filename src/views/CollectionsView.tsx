import { useMemo, useState } from 'react'
import type { Route } from '../lib/router'
import { navigate } from '../lib/router'
import { useStore } from '../state/store'
import { useI18n } from '../i18n'
import { Icon } from '../components/Icon'
import { Empty, Modal } from '../components/Modal'
import { effectiveDate } from '../lib/dates'
import { downloadBlob } from '../lib/image'
import type { Collection } from '../types'
import { openItem } from '../lib/router'

const BASE = import.meta.env.BASE_URL

export function CollectionsView({ route }: { route: Route }) {
  const {
    collections,
    itemMap,
    annotations,
    tags,
    addCollection,
    updateCollection,
    deleteCollection,
    reorderCollection,
    removeFromCollection,
    notify,
  } = useStore()
  const { t } = useI18n()

  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [editing, setEditing] = useState<Collection | null>(null)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<Collection | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  const detail = route.name === 'collection' ? collections.find((c) => c.id === route.param) : undefined

  const detailItems = useMemo(() => {
    if (!detail) return []
    return detail.itemIds
      .filter((id) => !annotations[id]?.excluded)
      .map((id) => itemMap.get(id))
      .filter((x): x is NonNullable<typeof x> => Boolean(x))
  }, [detail, itemMap, annotations])

  const coverFor = (col: Collection) => {
    const ids = col.coverItemId ? [col.coverItemId, ...col.itemIds] : col.itemIds
    const id = ids.find((itemId) => !annotations[itemId]?.excluded)
    return id ? itemMap.get(id) : undefined
  }

  const exportList = (col: Collection, format: 'md' | 'csv' | 'json') => {
    const rows = col.itemIds
      .map((id) => itemMap.get(id))
      .filter((x): x is NonNullable<typeof x> => x !== undefined && !annotations[x.id]?.excluded)
      .map((item, idx) => {
        const d = effectiveDate(item, annotations[item.id])
        const tagNames = (annotations[item.id]?.tags ?? []).map((tid) => tags.find((t) => t.id === tid)?.name ?? '')
        return {
          index: idx + 1,
          id: item.id,
          diaryDate: d.iso,
          publishedAt: item.publishedAt,
          tags: tagNames.join(' / '),
          note: annotations[item.id]?.note ?? '',
          file: item.file,
          large: `${BASE}${item.large}`,
        }
      })
    let content = ''
    let mime = 'text/plain'
    let ext = 'txt'
    if (format === 'json') {
      content = JSON.stringify({ name: col.name, description: col.description, items: rows }, null, 2)
      mime = 'application/json'
      ext = 'json'
    } else if (format === 'csv') {
      const head = t('adminOrg.collections.export.csvHead')
      const body = rows
        .map((r) =>
          [r.index, r.diaryDate, r.publishedAt, r.tags, r.note, r.file]
            .map((v) => `"${String(v).replace(/"/g, '""')}"`)
            .join(','),
        )
        .join('\n')
      content = `\uFEFF${head}\n${body}`
      mime = 'text/csv;charset=utf-8'
      ext = 'csv'
    } else {
      content = [
        `# ${col.name}`,
        col.description ? `> ${col.description}` : '',
        '',
        t('adminOrg.collections.export.markdownHead'),
        '| --- | --- | --- | --- | --- |',
        ...rows.map((r) => `| ${r.index} | ${r.diaryDate} | ${r.publishedAt} | ${r.tags} | ${r.note.replace(/\|/g, '/')} |`),
      ].join('\n')
      mime = 'text/markdown;charset=utf-8'
      ext = 'md'
    }
    downloadBlob(
      new Blob([content], { type: mime }),
      `${col.name}-${t('adminOrg.collections.fileSuffix')}.${ext}`,
    )
    notify(t('adminOrg.collections.listExported'), 'success')
  }

  const onDrop = (target: number) => {
    if (!detail || dragIndex === null || dragIndex === target) return
    const ids = [...detail.itemIds]
    const [moved] = ids.splice(dragIndex, 1)
    ids.splice(target, 0, moved)
    reorderCollection(detail.id, ids)
    setDragIndex(null)
  }

  if (route.name === 'collection') {
    if (!detail) {
      return (
        <Empty
          icon="folder"
          title={t('adminOrg.collections.detail.notFoundTitle')}
          hint={t('adminOrg.collections.detail.notFoundHint')}
          action={
            <button className="btn btn-sm" onClick={() => navigate('/collections')}>
              {t('adminOrg.collections.detail.backToList')}
            </button>
          }
        />
      )
    }
    return (
      <div className="collection-detail">
        <div className="page-head">
          <div>
            <div className="page-eyebrow">{t('adminOrg.collections.detail.eyebrow')}</div>
            <h2 className="page-title">{detail.name}</h2>
            <div className="page-sub">
              {t('adminOrg.collections.detail.subtitle', {
                count: detail.itemIds.length,
                note: detail.description || t('adminOrg.collections.detail.dragHint'),
              })}
            </div>
          </div>
          <div className="page-actions">
            <button className="btn btn-ghost" onClick={() => navigate('/collections')}>
              <Icon name="left" size={14} />
              {t('common.back')}
            </button>
            <button className="btn" onClick={() => setEditing(detail)}>
              <Icon name="edit" size={14} />
              {t('adminOrg.collections.detail.editInfo')}
            </button>
            <button className="btn" onClick={() => exportList(detail, 'md')}>
              <Icon name="download" size={14} />
              {t('adminOrg.collections.exportList')}
            </button>
            <button className="btn btn-ghost" onClick={() => exportList(detail, 'json')}>
              JSON
            </button>
            <button className="btn btn-ghost" onClick={() => exportList(detail, 'csv')}>
              CSV
            </button>
          </div>
        </div>

        {detailItems.length ? (
          <div className="collection-item-grid">
            {detailItems.map((item, idx) => {
              const d = effectiveDate(item, annotations[item.id])
              return (
                <div
                  key={item.id}
                  className={`collection-item${detail.coverItemId === item.id ? ' is-cover' : ''}`}
                  draggable
                  onDragStart={() => setDragIndex(idx)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => onDrop(idx)}
                >
                  <button className="collection-thumb" onClick={() => openItem(item.id)}>
                    <img src={`${BASE}${item.thumb}`} alt="" loading="lazy" />
                  </button>
                  <div className="collection-item-foot">
                    <span className="hand">
                      {d.month}/{d.day}
                    </span>
                    <div className="row" style={{ gap: 2 }}>
                      <button
                        className="icon-btn"
                        title={t('adminOrg.collections.detail.setCover')}
                        onClick={() => {
                          updateCollection(detail.id, { coverItemId: item.id })
                          notify(t('adminOrg.collections.detail.coverSet'), 'success')
                        }}
                      >
                        <Icon name="heart" size={12} />
                      </button>
                      <button
                        className="icon-btn"
                        title={t('adminOrg.collections.detail.remove')}
                        onClick={() => removeFromCollection(detail.id, [item.id])}
                      >
                        <Icon name="close" size={12} />
                      </button>
                    </div>
                  </div>
                  <span className="drag-hint">
                    <Icon name="grip" size={14} />
                  </span>
                  {detail.coverItemId === item.id && (
                    <span className="cover-tag">{t('adminOrg.collections.detail.cover')}</span>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <Empty
            icon="folder"
            title={t('adminOrg.collections.detail.emptyTitle')}
            hint={t('adminOrg.collections.detail.emptyHint')}
            action={
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/gallery')}>
                {t('adminOrg.collections.detail.goGallery')}
              </button>
            }
          />
        )}
      </div>
    )
  }

  return (
    <div className="collections-view">
      <div className="page-head">
        <div>
          <div className="page-eyebrow">{t('adminOrg.collections.eyebrow')}</div>
          <h2 className="page-title">{t('adminOrg.collections.title')}</h2>
          <div className="page-sub">
            {t('adminOrg.collections.summary', { count: collections.length })}
          </div>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => navigate('/gallery')}>
            <Icon name="gallery" size={14} />
            {t('adminOrg.collections.goGallery')}
          </button>
        </div>
      </div>

      <div className="panel create-collection">
        <div className="row" style={{ gap: 8 }}>
          <input
            className="input"
            placeholder={t('adminOrg.collections.createNamePlaceholder')}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="input"
            placeholder={t('adminOrg.collections.createDescPlaceholder')}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
          <button
            className="btn btn-primary"
            disabled={!name.trim()}
            onClick={() => {
              addCollection(name.trim(), desc.trim())
              setName('')
              setDesc('')
              notify(t('adminOrg.collections.created'), 'success')
            }}
          >
            <Icon name="plus" size={14} />
            {t('adminOrg.collections.create')}
          </button>
        </div>
      </div>

      {collections.length ? (
        <div className="collection-grid">
          {collections.map((col) => {
            const cover = coverFor(col)
            return (
              <div key={col.id} className="collection-card">
                <button className="collection-cover" onClick={() => navigate(`/collection/${col.id}`)}>
                  {cover ? (
                    <img src={`${BASE}${cover.thumb}`} alt="" loading="lazy" />
                  ) : (
                    <span className="collection-empty">
                      <Icon name="folder" size={26} />
                    </span>
                  )}
                  <span className="collection-count num">{col.itemIds.length}</span>
                </button>
                <div className="collection-card-body">
                  <div className="collection-card-head">
                    <h3>{col.name}</h3>
                    <div className="row" style={{ gap: 2 }}>
                      <button
                        className="icon-btn"
                        title={t('common.edit')}
                        onClick={() => {
                          setEditing(col)
                          setEditName(col.name)
                          setEditDesc(col.description)
                        }}
                      >
                        <Icon name="edit" size={13} />
                      </button>
                      <button
                        className="icon-btn"
                        title={t('common.delete')}
                        onClick={() => setConfirmDelete(col)}
                      >
                        <Icon name="trash" size={13} />
                      </button>
                    </div>
                  </div>
                  <p className="faint collection-desc">
                    {col.description || t('adminOrg.collections.noDescription')}
                  </p>
                  <div className="row" style={{ gap: 6, marginTop: 10 }}>
                    <button className="btn btn-sm" onClick={() => navigate(`/collection/${col.id}`)}>
                      {t('adminOrg.collections.open')}
                    </button>
                    <button className="btn btn-sm btn-ghost" onClick={() => exportList(col, 'md')}>
                      {t('adminOrg.collections.exportList')}
                    </button>
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={() => navigate(`/gallery?collection=${col.id}`)}
                    >
                      {t('adminOrg.collections.filterInGallery')}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <Empty
          icon="folder"
          title={t('adminOrg.collections.emptyTitle')}
          hint={t('adminOrg.collections.emptyHint')}
        />
      )}

      {editing && (
        <Modal
          title={t('adminOrg.collections.editTitle')}
          onClose={() => setEditing(null)}
          footer={
            <>
              <button className="btn" onClick={() => setEditing(null)}>
                {t('common.cancel')}
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  updateCollection(editing.id, { name: editName.trim() || editing.name, description: editDesc })
                  setEditing(null)
                  notify(t('adminOrg.collections.saved'), 'success')
                }}
              >
                {t('common.save')}
              </button>
            </>
          }
        >
          <div className="field" style={{ marginBottom: 12 }}>
            <div className="field-label">{t('adminOrg.collections.field.name')}</div>
            <input className="input" value={editName} onChange={(e) => setEditName(e.target.value)} />
          </div>
          <div className="field">
            <div className="field-label">{t('adminOrg.collections.field.description')}</div>
            <textarea className="textarea" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <Modal
          title={t('adminOrg.collections.deleteTitle')}
          onClose={() => setConfirmDelete(null)}
          footer={
            <>
              <button className="btn" onClick={() => setConfirmDelete(null)}>
                {t('common.cancel')}
              </button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  deleteCollection(confirmDelete.id)
                  setConfirmDelete(null)
                  notify(t('adminOrg.collections.deleted'), 'success')
                }}
              >
                {t('common.delete')}
              </button>
            </>
          }
        >
          <p>{t('adminOrg.collections.deleteBody')}</p>
        </Modal>
      )}
    </div>
  )
}
