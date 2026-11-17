import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../components/Icon'
import { Empty } from '../components/Modal'
import { effectiveDate, formatShortDate } from '../lib/dates'
import { downloadBlob } from '../lib/image'
import { IS_PUBLIC } from '../lib/appMode'
import { navigate, useRoute } from '../lib/router'
import { downloadJson } from '../lib/storage'
import { useStore } from '../state/store'
import type { DiaryItem, Storyline, StorylineBlock } from '../types'

const BASE = import.meta.env.BASE_URL

export function StorylineView() {
  const route = useRoute()
  return route.name === 'storyline' && route.param ? <StorylineDetail id={route.param} readMode={route.query.get('read') === '1'} /> : <StorylineList />
}

function StorylineList() {
  const { storylines, allItems, addStoryline, notify } = useStore()
  const itemMap = useMemo(() => new Map(allItems.map((item) => [item.id, item])), [allItems])
  const [title, setTitle] = useState('')

  const cards = useMemo(() => {
    return [...storylines]
      .map((story) => {
        const images = story.blocks
          .filter((b): b is StorylineBlock & { itemId: string } => b.type === 'image' && Boolean(b.itemId))
          .map((b) => itemMap.get(b.itemId))
          .filter((x): x is DiaryItem => Boolean(x))
        const cover = (story.coverItemId && itemMap.get(story.coverItemId)) || images[0]
        return { story, count: images.length, cover, images }
      })
      .sort((a, b) => b.story.updatedAt.localeCompare(a.story.updatedAt))
  }, [storylines, itemMap])

  const create = (itemIds: string[] = []) => {
    const story = addStoryline(title.trim() || '未命名故事线', itemIds)
    setTitle('')
    notify('故事线已创建', 'success')
    navigate(`/storyline/${story.id}`)
  }

  return (
    <div className="storyline-view">
      <div className="page-head">
        <div>
          <div className="page-eyebrow">Storyline</div>
          <h2 className="page-title">故事线</h2>
          <div className="page-sub">把零散的画串成连续的故事。同一张图可以属于多条故事线，删除故事线不会影响图片本身。</div>
        </div>
        <div className="page-actions">
          {!IS_PUBLIC && (
            <>
              <input
                className="input"
                style={{ width: 200 }}
                placeholder="新故事线标题"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') create()
                }}
              />
              <button className="btn btn-primary" onClick={() => create()}>
                <Icon name="plus" size={14} />新建空故事线
              </button>
            </>
          )}
        </div>
      </div>

      {cards.length ? (
        <div className="storyline-grid">
          {cards.map(({ story, count, cover }) => {
            const range = storylineDateRange(story, itemMap)
            return (
              <button key={story.id} className="storyline-card" onClick={() => navigate(`/storyline/${story.id}`)}>
                <div className="storyline-cover">
                  {cover ? (
                    <img src={`${BASE}${cover.thumb}`} alt="" loading="lazy" />
                  ) : (
                    <span className="character-placeholder">
                      <Icon name="book" size={26} />
                    </span>
                  )}
                  <span className="storyline-count num">{count} 张</span>
                </div>
                <div className="storyline-body">
                  <div className="storyline-title">{story.title}</div>
                  <div className="faint storyline-desc">{story.description || '还没有简介'}</div>
                  <div className="faint storyline-meta">
                    {range || '暂无日期'} · 更新于 {formatShortDate(story.updatedAt.slice(0, 10))}
                  </div>
                  {story.tags.length > 0 && (
                    <div className="row row-wrap" style={{ gap: 4, marginTop: 6 }}>
                      {story.tags.map((tag) => (
                        <span key={tag} className="mini-chip">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      ) : (
        <Empty
          icon="book"
          title="还没有故事线"
          hint="在图库多选图片，点「加入故事线」即可开始；也可以先建一条空故事线，再往里加图和章节备注。"
          action={
            <button className="btn btn-primary btn-sm" style={{ marginTop: 16 }} onClick={() => navigate('/gallery')}>
              去图库选图
            </button>
          }
        />
      )}
    </div>
  )
}

function storylineDateRange(story: Storyline, itemMap: Map<string, DiaryItem>): string {
  const dates = story.blocks
    .filter((b) => b.type === 'image' && b.itemId)
    .map((b) => itemMap.get(b.itemId as string))
    .filter((x): x is DiaryItem => Boolean(x))
    .map((item) => item.publishedAt.slice(0, 7))
    .filter(Boolean)
    .sort()
  if (!dates.length) return ''
  const first = dates[0]
  const last = dates[dates.length - 1]
  return first === last ? first : `${first} → ${last}`
}

function StorylineDetail({ id, readMode }: { id: string; readMode: boolean }) {
  const {
    storylines,
    allItems,
    annotations,
    updateStoryline,
    deleteStoryline,
    removeStorylineBlock,
    reorderStorylineBlocks,
    addStorylineNote,
    notify,
  } = useStore()
  const story = storylines.find((s) => s.id === id)
  const itemMap = useMemo(() => new Map(allItems.map((item) => [item.id, item])), [allItems])
  const [dragging, setDragging] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [page, setPage] = useState(0)

  const blocks = story?.blocks ?? []
  const images = blocks.filter((b): b is StorylineBlock & { itemId: string } => b.type === 'image' && Boolean(b.itemId))

  useEffect(() => {
    if (!readMode) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault()
        setPage((p) => Math.min(blocks.length - 1, p + 1))
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setPage((p) => Math.max(0, p - 1))
      } else if (e.key === 'Escape') {
        navigate(`/storyline/${id}`)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [readMode, blocks.length, id])

  if (!story) {
    return (
      <Empty
        icon="book"
        title="故事线不存在"
        hint="它可能已被删除，或链接里的 id 不正确。"
        action={
          <button className="btn btn-sm" style={{ marginTop: 16 }} onClick={() => navigate('/storylines')}>
            返回故事线列表
          </button>
        }
      />
    )
  }

  if (readMode) {
    const block = blocks[Math.min(page, blocks.length - 1)]
    return (
      <div className="storyline-reader">
        <div className="storyline-reader-head">
          <div>
            <div className="page-eyebrow">Storyline · Reading</div>
            <h2 className="page-title">{story.title}</h2>
            {story.description && <div className="faint">{story.description}</div>}
          </div>
          <div className="row" style={{ gap: 8 }}>
            <span className="faint num">{blocks.length ? page + 1 : 0} / {blocks.length}</span>
            <button className="btn btn-sm" onClick={() => navigate(`/storyline/${story.id}`)}>
              <Icon name="close" size={13} />退出阅读
            </button>
          </div>
        </div>
        <div className="storyline-reader-stage">
          {block?.type === 'image' && block.itemId ? (
            (() => {
              const item = itemMap.get(block.itemId)
              if (!item) return <div className="faint">图片不存在</div>
              return <img src={`${BASE}${item.large}`} alt={item.file} />
            })()
          ) : block?.type === 'note' ? (
            <div className="storyline-reader-note">{block.text}</div>
          ) : (
            <div className="faint">这条故事线还没有内容</div>
          )}
        </div>
        <div className="storyline-reader-nav">
          <button className="btn" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page <= 0}>
            <Icon name="left" size={14} />上一页
          </button>
          <button
            className="btn btn-primary"
            onClick={() => setPage((p) => Math.min(blocks.length - 1, p + 1))}
            disabled={page >= blocks.length - 1}
          >
            下一页<Icon name="right" size={14} />
          </button>
        </div>
      </div>
    )
  }

  const moveBlock = (from: number, to: number) => {
    if (to < 0 || to >= blocks.length || from === to) return
    const next = [...blocks]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    reorderStorylineBlocks(story.id, next)
  }

  const shareUrl = `${location.origin}${location.pathname}#/storyline/${story.id}?read=1`
  const copyShare = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      notify('阅读链接已复制', 'success')
    } catch {
      notify(shareUrl, 'default')
    }
  }

  const exportHtml = () => {
    const rows = blocks
      .map((block) => {
        if (block.type === 'note') return `<p class="note">${escapeHtml(block.text ?? '')}</p>`
        const item = block.itemId ? itemMap.get(block.itemId) : undefined
        if (!item) return ''
        const date = effectiveDate(item, annotations[item.id])
        return `<figure><img src="${location.origin}${BASE}${item.large}" alt="" /><figcaption>${escapeHtml(
          date.iso || item.file,
        )}</figcaption></figure>`
      })
      .join('\n')
    const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8" /><title>${escapeHtml(story.title)}</title>
<style>body{font-family:-apple-system,"Noto Sans SC",sans-serif;max-width:880px;margin:40px auto;padding:0 20px;line-height:1.7;color:#222}h1{font-size:26px}p.desc{color:#666}figure{margin:28px 0}img{max-width:100%;height:auto;border-radius:6px}figcaption{color:#888;font-size:12px;margin-top:6px}p.note{background:#f6f3ee;padding:14px 18px;border-radius:8px;white-space:pre-wrap}</style>
</head><body><h1>${escapeHtml(story.title)}</h1>${story.description ? `<p class="desc">${escapeHtml(story.description)}</p>` : ''}${rows}</body></html>`
    downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), `${story.title || 'storyline'}.html`)
  }

  return (
    <div className="storyline-detail">
      <div className="page-head">
        <div style={{ flex: 1 }}>
          <div className="page-eyebrow">Storyline</div>
          {IS_PUBLIC ? (
            <>
              <h2 className="page-title">{story.title}</h2>
              {story.description && <div className="page-sub">{story.description}</div>}
              {story.tags.length > 0 && (
                <div className="row row-wrap" style={{ gap: 6, marginTop: 8 }}>
                  {story.tags.map((tag) => (
                    <span key={tag} className="badge">{tag}</span>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <input
                className="storyline-title-input"
                value={story.title}
                onChange={(e) => updateStoryline(story.id, { title: e.target.value })}
                aria-label="故事线标题"
              />
              <textarea
                className="textarea storyline-desc-input"
                placeholder="写一段简介"
                value={story.description}
                onChange={(e) => updateStoryline(story.id, { description: e.target.value })}
              />
              <input
                className="input"
                style={{ maxWidth: 420 }}
                placeholder="标签，用逗号分隔"
                value={story.tags.join(', ')}
                onChange={(e) =>
                  updateStoryline(story.id, {
                    tags: e.target.value
                      .split(/[,，]/)
                      .map((t) => t.trim())
                      .filter(Boolean),
                  })
                }
              />
              <label className="switch-line" style={{ marginTop: 10 }}>
                <input
                  type="checkbox"
                  checked={Boolean(story.published)}
                  onChange={(e) => updateStoryline(story.id, { published: e.target.checked })}
                />
                <span>公开此故事线（会出现在发布数据与公开站）</span>
              </label>
            </>
          )}
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => navigate(`/storyline/${story.id}?read=1`)}>
            <Icon name="eye" size={14} />阅读模式
          </button>
          <button className="btn" onClick={copyShare}>
            <Icon name="share" size={14} />分享链接
          </button>
          <button className="btn" onClick={() => downloadJson(story, `storyline-${story.id}.json`)}>
            <Icon name="download" size={14} />导出 JSON
          </button>
          <button className="btn" onClick={exportHtml}>
            <Icon name="download" size={14} />导出 HTML
          </button>
          {!IS_PUBLIC && (
            <button
              className="btn btn-danger-ghost"
              onClick={() => {
                deleteStoryline(story.id)
                notify('故事线已删除，图片本身不受影响', 'success')
                navigate('/storylines')
              }}
            >
              <Icon name="trash" size={14} />删除
            </button>
          )}
        </div>
      </div>

      <div className="storyline-stats faint">
        {images.length} 张图片 · {blocks.filter((b) => b.type === 'note').length} 段备注 · 最后编辑{' '}
        {formatShortDate(story.updatedAt.slice(0, 10))}
      </div>

      <div className="storyline-blocks">
        {blocks.map((block, index) => (
          <div
            key={block.id}
            className={`storyline-block${dragging === block.id ? ' dragging' : ''}`}
            draggable={!IS_PUBLIC}
            onDragStart={() => !IS_PUBLIC && setDragging(block.id)}
            onDragEnd={() => setDragging(null)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (!dragging) return
              const from = blocks.findIndex((b) => b.id === dragging)
              moveBlock(from, index)
              setDragging(null)
            }}
          >
            {!IS_PUBLIC && (
              <div className="storyline-block-handle">
                <Icon name="grip" size={14} />
              </div>
            )}
            {block.type === 'image' && block.itemId ? (
              (() => {
                const item = itemMap.get(block.itemId)
                if (!item) return <div className="faint">图片不存在</div>
                const date = effectiveDate(item, annotations[item.id])
                return (
                  <div className="storyline-image-block">
                    <img src={`${BASE}${item.thumb}`} alt={item.file} loading="lazy" />
                    <div className="storyline-image-meta">
                      <span className="num">{date.iso || '日期待定'}</span>
                      <div className="row" style={{ gap: 4 }}>
                        {!IS_PUBLIC && (
                          <button className="btn btn-ghost btn-sm" onClick={() => updateStoryline(story.id, { coverItemId: item.id })}>
                            {story.coverItemId === item.id ? '当前封面' : '设为封面'}
                          </button>
                        )}
                        <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/item/${item.id}`)}>
                          查看
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })()
            ) : (
              <div className="storyline-note-block">
                <textarea
                  className="textarea"
                  value={block.text ?? ''}
                  readOnly={IS_PUBLIC}
                  onChange={(e) => {
                    const next = blocks.map((b) => (b.id === block.id ? { ...b, text: e.target.value } : b))
                    reorderStorylineBlocks(story.id, next)
                  }}
                  placeholder="章节说明 / 备注"
                />
              </div>
            )}
            {!IS_PUBLIC && (
              <div className="storyline-block-actions">
              <button className="icon-btn" onClick={() => moveBlock(index, index - 1)} disabled={index === 0} aria-label="上移">
                <Icon name="up" size={14} />
              </button>
              <button className="icon-btn" onClick={() => moveBlock(index, index + 1)} disabled={index === blocks.length - 1} aria-label="下移">
                <Icon name="down" size={14} />
              </button>
              <button className="icon-btn" onClick={() => removeStorylineBlock(story.id, block.id)} aria-label="移除">
                <Icon name="trash" size={14} />
              </button>
              </div>
            )}
          </div>
        ))}
        {!blocks.length && <div className="faint">还没有内容，可从图库选图加入，或在下面插入备注。</div>}
      </div>

      {!IS_PUBLIC && (
        <div className="storyline-add-note">
          <textarea className="textarea" placeholder="插入一段章节备注" value={note} onChange={(e) => setNote(e.target.value)} />
          <button
            className="btn"
            disabled={!note.trim()}
            onClick={() => {
              addStorylineNote(story.id, note.trim())
              setNote('')
            }}
          >
            <Icon name="plus" size={14} />插入备注
          </button>
          <button
            className="btn"
            onClick={() => navigate('/gallery')}
            title="在图库多选后使用「加入故事线」批量补充"
          >
            <Icon name="gallery" size={14} />去图库选图
          </button>
        </div>
      )}
    </div>
  )
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
