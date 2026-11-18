import { useMemo, useState } from 'react'
import { useStore } from '../state/store'
import { useI18n } from '../i18n'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { TAG_COLORS } from '../lib/constants'
import { navigate } from '../lib/router'

export function TagsView() {
  const {
    tags,
    dimensions,
    tagUsage,
    addTag,
    updateTag,
    deleteTag,
    addDimension,
    renameDimension,
    deleteDimension,
    notify,
  } = useStore()
  const { t } = useI18n()

  const [name, setName] = useState('')
  const [dimId, setDimId] = useState(dimensions[0]?.id ?? 'custom')
  const [color, setColor] = useState(TAG_COLORS[0])
  const [editing, setEditing] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [colorFor, setColorFor] = useState<string | null>(null)
  const [newDim, setNewDim] = useState('')
  const [dimEditing, setDimEditing] = useState<string | null>(null)
  const [dimName, setDimName] = useState('')
  const [confirmTag, setConfirmTag] = useState<string | null>(null)

  const grouped = useMemo(
    () =>
      dimensions.map((dim) => ({
        dim,
        tags: tags
          .filter((t) => t.dimensionId === dim.id)
          .sort((a, b) => (tagUsage[b.id] ?? 0) - (tagUsage[a.id] ?? 0) || a.name.localeCompare(b.name)),
      })),
    [dimensions, tags, tagUsage],
  )

  const cloud = useMemo(
    () =>
      [...tags]
        .filter((t) => (tagUsage[t.id] ?? 0) > 0)
        .sort((a, b) => (tagUsage[b.id] ?? 0) - (tagUsage[a.id] ?? 0)),
    [tags, tagUsage],
  )
  const maxUsage = Math.max(1, ...cloud.map((t) => tagUsage[t.id] ?? 0))

  const create = () => {
    const value = name.trim()
    if (!value) return
    if (tags.some((t) => t.name === value && t.dimensionId === dimId)) {
      notify(t('shell.tagPicker.duplicate'), 'error')
      return
    }
    addTag(value, dimId, color)
    setName('')
    notify(t('shell.tagPicker.created', { name: value }), 'success')
  }

  return (
    <div className="tags-view">
      <div className="page-head">
        <div>
          <div className="page-eyebrow">{t('adminOrg.tags.eyebrow')}</div>
          <h2 className="page-title">{t('adminOrg.tags.title')}</h2>
          <div className="page-sub">
            {t('adminOrg.tags.summary', {
              dimensions: dimensions.length,
              tags: tags.length,
              used: Object.values(tagUsage).reduce((a, b) => a + b, 0),
            })}
          </div>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => navigate('/search')}>
            <Icon name="filter" size={14} />
            {t('adminOrg.tags.combineFilter')}
          </button>
        </div>
      </div>

      <div className="tags-layout">
        <div className="tags-main">
          <section className="panel">
            <div className="panel-head">
              <h3>{t('adminOrg.tags.createTitle')}</h3>
            </div>
            <div className="tag-create-row">
              <input
                className="input"
                placeholder={t('adminOrg.tags.createPlaceholder')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && create()}
              />
              <select className="select" value={dimId} onChange={(e) => setDimId(e.target.value)}>
                {dimensions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <div className="color-row">
                {TAG_COLORS.map((c) => (
                  <button
                    key={c}
                    className={`color-dot${color === c ? ' active' : ''}`}
                    style={{ background: c }}
                    onClick={() => setColor(c)}
                    aria-label={t('shell.tagPicker.colorLabel', { color: c })}
                  />
                ))}
              </div>
              <button className="btn btn-primary" onClick={create} disabled={!name.trim()}>
                <Icon name="plus" size={14} />
                {t('adminOrg.tags.create')}
              </button>
            </div>
          </section>

          {grouped.map(({ dim, tags: dimTags }) => (
            <section key={dim.id} className="panel dimension-panel">
              <div className="dim-head">
                {dimEditing === dim.id ? (
                  <div className="row">
                    <input className="input" value={dimName} onChange={(e) => setDimName(e.target.value)} />
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => {
                        renameDimension(dim.id, dimName.trim() || dim.name)
                        setDimEditing(null)
                      }}
                    >
                      {t('common.save')}
                    </button>
                    <button className="btn btn-sm btn-ghost" onClick={() => setDimEditing(null)}>
                      {t('common.cancel')}
                    </button>
                  </div>
                ) : (
                  <>
                    <h3>
                      {dim.name}
                      <span className="group-count num">{t('adminOrg.tags.tagCount', { count: dimTags.length })}</span>
                    </h3>
                    <div className="row" style={{ gap: 2 }}>
                      <button
                        className="icon-btn"
                        title={t('adminOrg.tags.renameDimension')}
                        onClick={() => {
                          setDimEditing(dim.id)
                          setDimName(dim.name)
                        }}
                      >
                        <Icon name="edit" size={14} />
                      </button>
                      {dim.id !== 'custom' && (
                        <button
                          className="icon-btn"
                          title={t('adminOrg.tags.deleteDimension')}
                          onClick={() => {
                            deleteDimension(dim.id)
                            notify(t('adminOrg.tags.dimensionDeleted'))
                          }}
                        >
                          <Icon name="trash" size={14} />
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>

              {dimTags.length ? (
                <div className="tag-table">
                  {dimTags.map((tag) => (
                    <div key={tag.id} className="tag-row">
                      <button
                        className="color-dot"
                        style={{ background: tag.color }}
                        onClick={() => setColorFor(colorFor === tag.id ? null : tag.id)}
                        title={t('adminOrg.tags.changeColor')}
                      />
                      {editing === tag.id ? (
                        <>
                          <input
                            className="input"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                updateTag(tag.id, { name: editName.trim() || tag.name })
                                setEditing(null)
                              }
                            }}
                            autoFocus
                          />
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => {
                              updateTag(tag.id, { name: editName.trim() || tag.name })
                              setEditing(null)
                            }}
                          >
                            {t('common.save')}
                          </button>
                        </>
                      ) : (
                        <button className="tag-name" onClick={() => navigate(`/gallery?tag=${tag.id}`)}>
                          {tag.name}
                        </button>
                      )}
                      <span className="tag-usage num">
                        {t('common.itemCount', { count: tagUsage[tag.id] ?? 0 })}
                      </span>
                      <select
                        className="select select-mini"
                        value={tag.dimensionId}
                        onChange={(e) => updateTag(tag.id, { dimensionId: e.target.value })}
                        title={t('adminOrg.tags.moveDimension')}
                      >
                        {dimensions.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                      <button
                        className="icon-btn"
                        onClick={() => {
                          setEditing(tag.id)
                          setEditName(tag.name)
                        }}
                        title={t('adminOrg.tags.rename')}
                      >
                        <Icon name="edit" size={13} />
                      </button>
                      <button
                        className="icon-btn"
                        onClick={() => setConfirmTag(tag.id)}
                        title={t('common.delete')}
                      >
                        <Icon name="trash" size={13} />
                      </button>
                      {colorFor === tag.id && (
                        <div className="color-pop">
                          {TAG_COLORS.map((c) => (
                            <button
                              key={c}
                              className="color-dot"
                              style={{ background: c }}
                              onClick={() => {
                                updateTag(tag.id, { color: c })
                                setColorFor(null)
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="faint" style={{ padding: '8px 2px' }}>
                  {t('adminOrg.tags.emptyDimension')}
                </p>
              )}
            </section>
          ))}
        </div>

        <aside className="tags-side">
          <section className="panel">
            <div className="panel-head">
              <h3>{t('adminOrg.tags.cloudTitle')}</h3>
              <span className="faint">{t('adminOrg.tags.cloudCount', { count: cloud.length })}</span>
            </div>
            {cloud.length ? (
              <div className="tag-cloud">
                {cloud.map((tag) => {
                  const usage = tagUsage[tag.id] ?? 0
                  const scale = 0.9 + (usage / maxUsage) * 0.9
                  return (
                    <button
                      key={tag.id}
                      className="cloud-tag"
                      style={{
                        color: tag.color,
                        fontSize: `${scale}em`,
                        background: `color-mix(in srgb, ${tag.color} 12%, transparent)`,
                      }}
                      onClick={() => navigate(`/gallery?tag=${tag.id}`)}
                      title={t('adminOrg.tags.cloudTagTitle', { name: tag.name, count: usage })}
                    >
                      {tag.name}
                      <span className="num">{usage}</span>
                    </button>
                  )
                })}
              </div>
            ) : (
              <p className="faint">
                {t('adminOrg.tags.cloudEmpty')}
              </p>
            )}
          </section>

          <section className="panel">
            <div className="panel-head">
              <h3>{t('adminOrg.tags.customTitle')}</h3>
            </div>
            <div className="row">
              <input
                className="input"
                placeholder={t('adminOrg.tags.customPlaceholder')}
                value={newDim}
                onChange={(e) => setNewDim(e.target.value)}
              />
              <button
                className="btn btn-primary"
                disabled={!newDim.trim()}
                onClick={() => {
                  addDimension(newDim.trim())
                  setNewDim('')
                  notify(t('adminOrg.tags.dimensionAdded'), 'success')
                }}
              >
                {t('common.add')}
              </button>
            </div>
            <p className="faint" style={{ marginTop: 8, fontSize: 11.5 }}>
              {t('adminOrg.tags.customHint')}
            </p>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h3>{t('adminOrg.tags.tipsTitle')}</h3>
            </div>
            <ul className="hint-list">
              <li>{t('adminOrg.tags.tips.character')}</li>
              <li>{t('adminOrg.tags.tips.scene')}</li>
              <li>{t('adminOrg.tags.tips.mood')}</li>
              <li>{t('adminOrg.tags.tips.element')}</li>
              <li>{t('adminOrg.tags.tips.technique')}</li>
            </ul>
          </section>
        </aside>
      </div>

      {confirmTag && (
        <Modal
          title={t('adminOrg.tags.deleteTitle')}
          onClose={() => setConfirmTag(null)}
          footer={
            <>
              <button className="btn" onClick={() => setConfirmTag(null)}>
                {t('common.cancel')}
              </button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  deleteTag(confirmTag)
                  setConfirmTag(null)
                  notify(t('adminOrg.tags.deleted'), 'success')
                }}
              >
                {t('adminOrg.tags.deleteConfirm')}
              </button>
            </>
          }
        >
          <p>
            {t('adminOrg.tags.deleteBody', { name: tags.find((t) => t.id === confirmTag)?.name ?? '' })}
          </p>
        </Modal>
      )}
    </div>
  )
}
