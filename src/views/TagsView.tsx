import { useMemo, useState } from 'react'
import { useStore } from '../state/store'
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
      notify('该维度下已有同名标签', 'error')
      return
    }
    addTag(value, dimId, color)
    setName('')
    notify(`已创建标签「${value}」`, 'success')
  }

  return (
    <div className="tags-view">
      <div className="page-head">
        <div>
          <div className="page-eyebrow">Tags & Dimensions</div>
          <h2 className="page-title">标签体系</h2>
          <div className="page-sub">
            {dimensions.length} 个维度 · {tags.length} 个标签 · 已使用{' '}
            {Object.values(tagUsage).reduce((a, b) => a + b, 0)} 次
          </div>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => navigate('/search')}>
            <Icon name="filter" size={14} />
            组合筛选
          </button>
        </div>
      </div>

      <div className="tags-layout">
        <div className="tags-main">
          <section className="panel">
            <div className="panel-head">
              <h3>新建标签</h3>
            </div>
            <div className="tag-create-row">
              <input
                className="input"
                placeholder="例如：通勤、疲惫、咖啡、线稿"
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
                    aria-label={c}
                  />
                ))}
              </div>
              <button className="btn btn-primary" onClick={create} disabled={!name.trim()}>
                <Icon name="plus" size={14} />
                创建
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
                      保存
                    </button>
                    <button className="btn btn-sm btn-ghost" onClick={() => setDimEditing(null)}>
                      取消
                    </button>
                  </div>
                ) : (
                  <>
                    <h3>
                      {dim.name}
                      <span className="group-count num">{dimTags.length} 个标签</span>
                    </h3>
                    <div className="row" style={{ gap: 2 }}>
                      <button
                        className="icon-btn"
                        title="重命名维度"
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
                          title="删除维度（标签会移入「其他」）"
                          onClick={() => {
                            deleteDimension(dim.id)
                            notify('维度已删除，标签移入「其他」')
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
                        title="修改颜色"
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
                            保存
                          </button>
                        </>
                      ) : (
                        <button className="tag-name" onClick={() => navigate(`/gallery?tag=${tag.id}`)}>
                          {tag.name}
                        </button>
                      )}
                      <span className="tag-usage num">{tagUsage[tag.id] ?? 0} 张</span>
                      <select
                        className="select select-mini"
                        value={tag.dimensionId}
                        onChange={(e) => updateTag(tag.id, { dimensionId: e.target.value })}
                        title="移动维度"
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
                        title="重命名"
                      >
                        <Icon name="edit" size={13} />
                      </button>
                      <button className="icon-btn" onClick={() => setConfirmTag(tag.id)} title="删除">
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
                  这个维度还没有标签。
                </p>
              )}
            </section>
          ))}
        </div>

        <aside className="tags-side">
          <section className="panel">
            <div className="panel-head">
              <h3>标签云</h3>
              <span className="faint">{cloud.length} 个已使用</span>
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
                      title={`${tag.name} · ${usage} 张`}
                    >
                      {tag.name}
                      <span className="num">{usage}</span>
                    </button>
                  )
                })}
              </div>
            ) : (
              <p className="faint">
                还没有使用标签。到图库里多选作品，点「打标签」即可批量归类。
              </p>
            )}
          </section>

          <section className="panel">
            <div className="panel-head">
              <h3>自定义维度</h3>
            </div>
            <div className="row">
              <input
                className="input"
                placeholder="例如：季节、配色、用途"
                value={newDim}
                onChange={(e) => setNewDim(e.target.value)}
              />
              <button
                className="btn btn-primary"
                disabled={!newDim.trim()}
                onClick={() => {
                  addDimension(newDim.trim())
                  setNewDim('')
                  notify('已新增维度', 'success')
                }}
              >
                添加
              </button>
            </div>
            <p className="faint" style={{ marginTop: 8, fontSize: 11.5 }}>
              维度用于跨维度组合筛选，例如「人物=小狐狸」+「场景=通勤」。
            </p>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h3>使用建议</h3>
            </div>
            <ul className="hint-list">
              <li>人物/角色：用来生成角色图鉴与表情包分组。</li>
              <li>使用场景：通勤、睡前、午后，方便按用途找图。</li>
              <li>情绪：疲惫、开心、放空，适合做表情包检索。</li>
              <li>画面元素：猫、咖啡、窗、雨，用于临摹素材。</li>
              <li>技法：线稿、平涂、配色、留白等拆解标签。</li>
            </ul>
          </section>
        </aside>
      </div>

      {confirmTag && (
        <Modal
          title="删除标签"
          onClose={() => setConfirmTag(null)}
          footer={
            <>
              <button className="btn" onClick={() => setConfirmTag(null)}>
                取消
              </button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  deleteTag(confirmTag)
                  setConfirmTag(null)
                  notify('标签已删除，并从未校对/已标作品上移除', 'success')
                }}
              >
                确认删除
              </button>
            </>
          }
        >
          <p>
            标签「{tags.find((t) => t.id === confirmTag)?.name}」会从所有作品上移除，此操作不可撤销。
          </p>
        </Modal>
      )}
    </div>
  )
}
