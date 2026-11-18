import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../components/Icon'
import { Empty, Modal } from '../components/Modal'
import { effectiveDate, formatShortDate } from '../lib/dates'
import { downloadBlob } from '../lib/image'
import { IS_PUBLIC } from '../lib/appMode'
import { navigate, siteHref, useRoute } from '../lib/router'
import { downloadJson } from '../lib/storage'
import { useStore } from '../state/store'
import { useI18n } from '../i18n'
import type { DiaryItem, Storyline, StorylineBlock } from '../types'

const BASE = import.meta.env.BASE_URL
const SHORTCODE_RE = /^[A-Za-z0-9_-]{5,}$/
const POST_LINK_RE = /(?:instagram\.com|instagr\.am)\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/gi

/** 宽容解析：接受 shortcode 列表、完整帖子链接或整段分享文本；返回按输入顺序的唯一条目 */
function parseShortcodes(text: string): { codes: string[]; duplicates: string[] } {
  const seen = new Set<string>()
  const codes: string[] = []
  const duplicates: string[] = []
  const push = (raw: string) => {
    const code = raw.trim().replace(/[),.;:!?，。；：、）】」』]+$/g, '')
    if (!SHORTCODE_RE.test(code)) return
    if (seen.has(code)) {
      if (!duplicates.includes(code)) duplicates.push(code)
      return
    }
    seen.add(code)
    codes.push(code)
  }
  const rest = text.replace(POST_LINK_RE, (_match, code: string) => {
    push(code)
    return ' '
  })
  for (const token of rest.split(/[\s,，、;；|/]+/)) {
    if (!token || /instagram\.com|instagr\.am/i.test(token)) continue
    push(token)
  }
  return { codes, duplicates }
}

export function StorylineView() {
  const route = useRoute()
  return route.name === 'storyline' && route.param ? <StorylineDetail id={route.param} readMode={route.query.get('read') === '1'} /> : <StorylineList />
}

function StorylineList() {
  const { storylines, allItems, addStoryline, notify } = useStore()
  const { t } = useI18n()
  const itemMap = useMemo(() => new Map(allItems.map((item) => [item.id, item])), [allItems])
  const [title, setTitle] = useState('')
  const [builderOpen, setBuilderOpen] = useState(false)

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
    const story = addStoryline(title.trim() || t('lib.newStoryline'), itemIds)
    setTitle('')
    notify(t('storylines.list.created'), 'success')
    navigate(`/storyline/${story.id}`)
  }

  return (
    <div className="storyline-view">
      <div className="page-head">
        <div>
          <div className="page-eyebrow">{t('shell.page.storylines.eyebrow')}</div>
          <h2 className="page-title">{t('shell.page.storylines.title')}</h2>
          <div className="page-sub">{t('storylines.list.sub')}</div>
        </div>
        <div className="page-actions">
          {!IS_PUBLIC && (
            <>
              <input
                className="input"
                style={{ width: 200 }}
                placeholder={t('storylines.list.titlePlaceholder')}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') create()
                }}
              />
              <button className="btn btn-primary" onClick={() => create()}>
                <Icon name="plus" size={14} />{t('storylines.list.createEmpty')}
              </button>
              <button className="btn" onClick={() => setBuilderOpen(true)}>
                <Icon name="book" size={14} />{t('storylines.list.buildByShortcode')}
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
                  <span className="storyline-count num">{t('common.itemCount', { count })}</span>
                </div>
                <div className="storyline-body">
                  <div className="storyline-title">{story.title}</div>
                  <div className="faint storyline-desc">{story.description || t('storylines.list.noDescription')}</div>
                  <div className="faint storyline-meta">
                    {range || t('storylines.list.noDate')} · {t('storylines.list.updatedAt', { date: formatShortDate(story.updatedAt.slice(0, 10)) })}
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
          title={IS_PUBLIC ? t('storylines.list.emptyPublicTitle') : t('storylines.list.emptyTitle')}
          hint={
            IS_PUBLIC
              ? t('storylines.list.emptyPublicHint')
              : t('storylines.list.emptyHint')
          }
          action={
            IS_PUBLIC ? undefined : (
              <button className="btn btn-primary btn-sm" style={{ marginTop: 16 }} onClick={() => navigate('/gallery')}>
                {t('storylines.list.goGallery')}
              </button>
            )
          }
        />
      )}

      {builderOpen && (
        <ShortcodeBuilder
          onClose={() => setBuilderOpen(false)}
          onCreate={(storyTitle, itemIds, skipped) => {
            const story = addStoryline(storyTitle, itemIds)
            setBuilderOpen(false)
            notify(
              skipped
                ? t('storylines.list.createdCountSkipped', { count: itemIds.length, skipped })
                : t('storylines.list.createdCount', { count: itemIds.length }),
              'success',
            )
            navigate(`/storyline/${story.id}`)
          }}
        />
      )}
    </div>
  )
}

function ShortcodeBuilder({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (title: string, itemIds: string[], skipped: number) => void
}) {
  const { items, annotations } = useStore()
  const { t, locale } = useI18n()
  const [title, setTitle] = useState('')
  const [input, setInput] = useState('')

  const parsed = useMemo(() => parseShortcodes(input), [input])
  const rows = useMemo(
    () =>
      parsed.codes.map((code) => {
        const matched = items
          .filter((item) => item.shortcode === code)
          .sort((a, b) => a.postIndex - b.postIndex)
        return { code, matched }
      }),
    [parsed.codes, items],
  )
  const matchedRows = rows.filter((row) => row.matched.length > 0)
  const missing = rows.filter((row) => row.matched.length === 0).map((row) => row.code)
  const ordered = matchedRows.flatMap((row) => row.matched)

  /** 把未匹配的 shortcode 从输入框里就地删掉（链接与裸 shortcode 都处理） */
  const removeCode = (code: string) => {
    const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    setInput((text) =>
      text
        .replace(new RegExp(`https?://\\S*?/(?:p|reel|tv)/${escaped}\\S*`, 'gi'), ' ')
        .replace(new RegExp(`(^|[\\s,，、;；|/])${escaped}(?=[\\s,，、;；|/]|$)`, 'g'), '$1'),
    )
  }

  return (
    <Modal
      title={t('storylines.builder.title')}
      subtitle={t('storylines.builder.subtitle')}
      wide
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            className="btn btn-primary"
            disabled={!ordered.length}
            onClick={() => onCreate(title.trim() || t('lib.newStoryline'), ordered.map((item) => item.id), missing.length)}
          >
            {t('storylines.builder.create', { count: ordered.length })}
          </button>
        </>
      }
    >
      <div className="shortcode-builder">
        <label className="field">
          <span className="field-label">{t('storylines.builder.titleLabel')}</span>
          <input
            className="input"
            placeholder={t('storylines.builder.titlePlaceholder')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="field-label">{t('storylines.builder.inputLabel')}</span>
          <textarea
            className="textarea"
            rows={5}
            placeholder={'C5puFXYy0jP\nC6abcdEFGhI\nhttps://www.instagram.com/p/C7xyz12345/'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </label>

        <div className="shortcode-summary">
          {t('storylines.builder.matchedPrefix')} <strong>{matchedRows.length}</strong>{' '}
          {t('storylines.builder.matchedSuffix')} · {t('storylines.builder.totalPrefix')}{' '}
          <strong>{ordered.length}</strong> {t('storylines.builder.totalSuffix')}
          {missing.length > 0 && (
            <>
              {' '}
              · <span className="shortcode-danger">{t('storylines.builder.missingCount', { count: missing.length })}</span>
            </>
          )}
        </div>

        {parsed.duplicates.length > 0 && (
          <div className="shortcode-warning">
            {t('storylines.builder.duplicates', {
              codes: parsed.duplicates.join(locale === 'en' ? ', ' : '、'),
            })}
          </div>
        )}

        {missing.length > 0 && (
          <div className="shortcode-missing">
            <span>{t('storylines.builder.missingHint')}</span>
            <div className="row row-wrap" style={{ gap: 6 }}>
              {missing.map((code) => (
                <span key={code} className="shortcode-missing-chip">
                  {code}
                  <button
                    onClick={() => removeCode(code)}
                    aria-label={t('storylines.builder.removeCode', { code })}
                    title={t('storylines.builder.removeCodeTitle')}
                  >
                    <Icon name="close" size={11} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {ordered.length > 0 && (
          <div className="shortcode-preview">
            {matchedRows.map((row) =>
              row.matched.map((item) => {
                const date = effectiveDate(item, annotations[item.id])
                const order = ordered.indexOf(item) + 1
                return (
                  <div key={`${row.code}-${item.id}`} className="shortcode-preview-item">
                    <span className="shortcode-order num">{order}</span>
                    <img src={`${BASE}${item.thumb}`} alt="" loading="lazy" />
                    <div className="shortcode-preview-meta">
                      <span className="num">{date.iso || t('common.dateUnknown')}</span>
                      <span className="faint">{row.code}</span>
                    </div>
                  </div>
                )
              }),
            )}
          </div>
        )}
      </div>
    </Modal>
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
  const { t } = useI18n()
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
        title={t('storylines.detail.notFoundTitle')}
        hint={t('storylines.detail.notFoundHint')}
        action={
          <button className="btn btn-sm" style={{ marginTop: 16 }} onClick={() => navigate('/storylines')}>
            {t('storylines.detail.backToList')}
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

  const shareUrl = `${location.origin}${siteHref(`/storyline/${story.id}?read=1`)}`
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
                      <span className="num">{date.iso || t('common.dateUnknown')}</span>
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
