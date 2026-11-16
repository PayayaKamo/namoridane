import { useMemo, useState } from 'react'
import type { Route } from '../lib/router'
import { navigate } from '../lib/router'
import { useStore } from '../state/store'
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
    return detail.itemIds.map((id) => itemMap.get(id)).filter((x): x is NonNullable<typeof x> => Boolean(x))
  }, [detail, itemMap])

  const coverFor = (col: Collection) => {
    const id = col.coverItemId ?? col.itemIds[0]
    return id ? itemMap.get(id) : undefined
  }

  const exportList = (col: Collection, format: 'md' | 'csv' | 'json') => {
    const rows = col.itemIds
      .map((id) => itemMap.get(id))
      .filter((x): x is NonNullable<typeof x> => Boolean(x))
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
      const head = '序号,日记日期,发布日期,标签,备注,文件名'
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
        '| # | 日记日期 | 发布日 | 标签 | 备注 |',
        '| --- | --- | --- | --- | --- |',
        ...rows.map((r) => `| ${r.index} | ${r.diaryDate} | ${r.publishedAt} | ${r.tags} | ${r.note.replace(/\|/g, '/')} |`),
      ].join('\n')
      mime = 'text/markdown;charset=utf-8'
      ext = 'md'
    }
    downloadBlob(new Blob([content], { type: mime }), `${col.name}-清单.${ext}`)
    notify('清单已导出', 'success')
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
          title="找不到这个合集"
          hint="可能已被删除。"
          action={<button className="btn btn-sm" onClick={() => navigate('/collections')}>返回合集列表</button>}
        />
      )
    }
    return (
      <div className="collection-detail">
        <div className="page-head">
          <div>
            <div className="page-eyebrow">Collection</div>
            <h2 className="page-title">{detail.name}</h2>
            <div className="page-sub">
              {detail.itemIds.length} 张 · {detail.description || '拖动缩略图可调整顺序'}
            </div>
          </div>
          <div className="page-actions">
            <button className="btn btn-ghost" onClick={() => navigate('/collections')}>
              <Icon name="left" size={14} />
              返回
            </button>
            <button className="btn" onClick={() => setEditing(detail)}>
              <Icon name="edit" size={14} />
              编辑信息
            </button>
            <button className="btn" onClick={() => exportList(detail, 'md')}>
              <Icon name="download" size={14} />
              导出清单
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
                        title="设为封面"
                        onClick={() => {
                          updateCollection(detail.id, { coverItemId: item.id })
                          notify('已设为封面', 'success')
                        }}
                      >
                        <Icon name="heart" size={12} />
                      </button>
                      <button
                        className="icon-btn"
                        title="移出合集"
                        onClick={() => removeFromCollection(detail.id, [item.id])}
                      >
                        <Icon name="close" size={12} />
                      </button>
                    </div>
                  </div>
                  <span className="drag-hint">
                    <Icon name="grip" size={14} />
                  </span>
                  {detail.coverItemId === item.id && <span className="cover-tag">封面</span>}
                </div>
              )
            })}
          </div>
        ) : (
          <Empty
            icon="folder"
            title="合集还是空的"
            hint="去图库多选作品后点「加入合集」，或者在这里慢慢添加。"
            action={
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/gallery')}>
                去图库挑选
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
          <div className="page-eyebrow">Collections</div>
          <h2 className="page-title">合集</h2>
          <div className="page-sub">{collections.length} 个命名合集，可交叉收录同一张作品</div>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => navigate('/gallery')}>
            <Icon name="gallery" size={14} />
            去图库挑选
          </button>
        </div>
      </div>

      <div className="panel create-collection">
        <div className="row" style={{ gap: 8 }}>
          <input
            className="input"
            placeholder="合集名称，如「表情包素材」「模仿参考」"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="input"
            placeholder="一句话描述（可选）"
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
              notify('合集已创建', 'success')
            }}
          >
            <Icon name="plus" size={14} />
            新建合集
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
                        title="编辑"
                        onClick={() => {
                          setEditing(col)
                          setEditName(col.name)
                          setEditDesc(col.description)
                        }}
                      >
                        <Icon name="edit" size={13} />
                      </button>
                      <button className="icon-btn" title="删除" onClick={() => setConfirmDelete(col)}>
                        <Icon name="trash" size={13} />
                      </button>
                    </div>
                  </div>
                  <p className="faint collection-desc">{col.description || '还没有描述'}</p>
                  <div className="row" style={{ gap: 6, marginTop: 10 }}>
                    <button className="btn btn-sm" onClick={() => navigate(`/collection/${col.id}`)}>
                      打开
                    </button>
                    <button className="btn btn-sm btn-ghost" onClick={() => exportList(col, 'md')}>
                      导出清单
                    </button>
                    <button className="btn btn-sm btn-ghost" onClick={() => navigate(`/gallery?collection=${col.id}`)}>
                      在图库筛选
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
          title="还没有合集"
          hint="合集像一本小册子：把表情包素材、临摹参考、最喜欢的作品分别收进去，可重叠收录。"
        />
      )}

      {editing && (
        <Modal
          title="编辑合集"
          onClose={() => setEditing(null)}
          footer={
            <>
              <button className="btn" onClick={() => setEditing(null)}>
                取消
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  updateCollection(editing.id, { name: editName.trim() || editing.name, description: editDesc })
                  setEditing(null)
                  notify('已保存', 'success')
                }}
              >
                保存
              </button>
            </>
          }
        >
          <div className="field" style={{ marginBottom: 12 }}>
            <div className="field-label">名称</div>
            <input className="input" value={editName} onChange={(e) => setEditName(e.target.value)} />
          </div>
          <div className="field">
            <div className="field-label">描述</div>
            <textarea className="textarea" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <Modal
          title="删除合集"
          onClose={() => setConfirmDelete(null)}
          footer={
            <>
              <button className="btn" onClick={() => setConfirmDelete(null)}>
                取消
              </button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  deleteCollection(confirmDelete.id)
                  setConfirmDelete(null)
                  notify('合集已删除', 'success')
                }}
              >
                删除
              </button>
            </>
          }
        >
          <p>只会删除合集本身，作品与标签数据不受影响。</p>
        </Modal>
      )}
    </div>
  )
}
