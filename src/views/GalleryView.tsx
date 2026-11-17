import { useEffect, useMemo, useState } from 'react'
import type { Route } from '../lib/router'
import { navigate } from '../lib/router'
import { useStore } from '../state/store'
import { applyFilters, DEFAULT_FILTER, groupByMonth } from '../lib/filtering'
import { MONTHS_CN } from '../lib/dates'
import { Icon } from '../components/Icon'
import { Masonry } from '../components/ItemCard'
import { Empty, Modal } from '../components/Modal'
import { TagPicker } from '../components/TagPicker'
import { CharacterPicker } from '../components/CharacterPicker'
import { downloadBlob, downloadOriginalsZip } from '../lib/image'
import { IS_PUBLIC } from '../lib/appMode'
import { moveFilesToTrash } from '../lib/trash'
import type { FilterState } from '../types'

export function GalleryView({ route }: { route: Route }) {
  const {
    items,
    excludedItems,
    pendingReviewItems,
    itemMap,
    annotations,
    tags,
    collections,
    storylines,
    data,
    addTagToItems,
    removeTagFromItems,
    setFavorite,
    setReviewStatus,
    confirmDate,
    addToCollection,
    addCollection,
    addStoryline,
    addToStoryline,
    deleteItems,
    notify,
  } = useStore()

  const [filter, setFilter] = useState<FilterState>(() => {
    const q = route.query
    const tag = q.get('tag')
    return {
      ...DEFAULT_FILTER,
      year: q.get('year') ?? '',
      month: q.get('month') ?? '',
      keyword: q.get('q') ?? '',
      tagIds: tag ? [tag] : [],
      favoriteOnly: q.get('fav') === '1',
      unconfirmedOnly: q.get('pending') === '1',
      collectionId: q.get('collection') ?? '',
      sort: (q.get('sort') as FilterState['sort']) || 'diaryAsc',
    }
  })

  const [selectMode, setSelectMode] = useState(false)
  const [showExcluded, setShowExcluded] = useState(route.query.get('excluded') === '1')
  const [zipProgress, setZipProgress] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [tagModal, setTagModal] = useState(false)
  const [characterModal, setCharacterModal] = useState(false)
  const [pickCharacters, setPickCharacters] = useState<string[]>([])
  const [pickTags, setPickTags] = useState<string[]>([])
  const [collectionModal, setCollectionModal] = useState(false)
  const [newCollection, setNewCollection] = useState('')
  const [storylineIds, setStorylineIds] = useState<string[] | null>(null)
  const [newStoryline, setNewStoryline] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [tagFilterOpen, setTagFilterOpen] = useState(route.query.get('tag') !== null)
  // 手机端顶部控件默认收起，只留一行紧凑入口
  const [filtersOpen, setFiltersOpen] = useState(false)

  // 支持 #/gallery?tag=… 直接打开；同一页面内切换 tag 参数时同步筛选
  const queryTag = route.query.get('tag') ?? ''
  useEffect(() => {
    if (!queryTag) return
    setFilter((f) => (f.tagIds.length === 1 && f.tagIds[0] === queryTag ? f : { ...f, tagIds: [queryTag] }))
    setTagFilterOpen(true)
  }, [queryTag])

  const activeFilterCount = [
    filter.keyword !== DEFAULT_FILTER.keyword,
    filter.year !== DEFAULT_FILTER.year,
    filter.month !== DEFAULT_FILTER.month,
    filter.sort !== DEFAULT_FILTER.sort,
    filter.translation !== DEFAULT_FILTER.translation,
    filter.favoriteOnly,
    filter.unconfirmedOnly,
    filter.tagIds.length > 0,
    filter.collectionId !== DEFAULT_FILTER.collectionId,
  ].filter(Boolean).length

  const sourceItems = showExcluded ? excludedItems : items

  const filtered = useMemo(
    () =>
      applyFilters(
        { items: sourceItems, annotations, tags, collectionItemIds: collections.find((c) => c.id === filter.collectionId)?.itemIds },
        filter,
      ),
    [sourceItems, annotations, tags, collections, filter],
  )

  const groups = useMemo(() => groupByMonth(filtered, annotations), [filtered, annotations])

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedIds = useMemo(() => [...selected], [selected])
  const selectedItems = useMemo(
    () => selectedIds.flatMap((id) => {
      const item = itemMap.get(id)
      return item ? [item] : []
    }),
    [selectedIds, itemMap],
  )

  const downloadSelected = async () => {
    if (!selectedItems.length || zipProgress) return
    setZipProgress(`0 / ${selectedItems.length}`)
    try {
      await downloadOriginalsZip(selectedItems, (done, total) => setZipProgress(`${done} / ${total}`))
      notify(`已打包 ${selectedItems.length} 张原始 JPG`, 'success')
    } catch (err) {
      console.error(err)
      notify('原图打包失败，请减少选择数量后重试', 'error')
    } finally {
      setZipProgress(null)
    }
  }

  const exportExcluded = () => {
    const text = excludedItems.map((item) => item.file).join('\r\n')
    downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), 'namori-excluded-files.txt')
    notify(`已导出 ${excludedItems.length} 个非绘日记文件名`, 'success')
  }

  const clearSelection = () => setSelected(new Set())

  const toggleTagFilter = (tagId: string) => {
    setFilter((f) => ({
      ...f,
      tagIds: f.tagIds.includes(tagId) ? f.tagIds.filter((t) => t !== tagId) : [...f.tagIds, tagId],
    }))
  }

  const years = useMemo(
    () => [...new Set(sourceItems.map((i) => i.publishedAt.slice(0, 4)).filter(Boolean))].sort(),
    [sourceItems],
  )

  return (
    <div className={`gallery-view${filtersOpen ? ' is-filters-open' : ''}`}>
      <div className="page-head">
        <div>
          <div className="page-eyebrow">{showExcluded ? 'Excluded' : 'Gallery'}</div>
          <h2 className="page-title">{showExcluded ? '非绘日记排除区' : '图库'}</h2>
          <div className="page-sub">
            {filtered.length} / {sourceItems.length} 张 · {groups.length} 个月份
            {!showExcluded && ' · 默认按图内日记日期排列'}
            {filter.tagIds.length > 0 && ` · 已筛选 ${filter.tagIds.length} 个标签`}
          </div>
        </div>
        <div className="page-actions">
          {!IS_PUBLIC && (
            <>
              <button className="btn" onClick={() => navigate('/diary-review')}>
                <Icon name="checkSquare" size={15} />
                绘日记审核 · {pendingReviewItems.length}
              </button>
              <button
                className={`btn${showExcluded ? ' btn-primary' : ''}`}
                onClick={() => {
                  setShowExcluded((value) => !value)
                  clearSelection()
                }}
              >
                <Icon name={showExcluded ? 'gallery' : 'trash'} size={15} />
                {showExcluded ? '返回图库' : `排除区 ${excludedItems.length}`}
              </button>
              <button
                className={`btn${selectMode ? ' btn-primary' : ''}`}
                onClick={() => {
                  setSelectMode((v) => !v)
                  clearSelection()
                }}
              >
                <Icon name="checkSquare" size={15} />
                {selectMode ? '退出多选' : '多选整理'}
              </button>
            </>
          )}
          <button className="btn btn-ghost" onClick={() => navigate('/search')}>
            <Icon name="filter" size={15} />
            高级筛选
          </button>
        </div>
      </div>

      {!IS_PUBLIC && showExcluded && (
        <div className="excluded-banner">
          <div>
            <strong>这里只放你标记的「非绘日记」</strong>
            <span>这里只修改浏览器中的审核标注，不会修改、移动或删除原始图片；构建和原图 ZIP 仍包含全部图片。</span>
          </div>
          <button className="btn btn-sm" onClick={exportExcluded} disabled={!excludedItems.length}>
            <Icon name="download" size={14} />导出非绘日记名单
          </button>
        </div>
      )}

      <div className="gallery-toolbar">
        <button
          className={`gallery-toolbar-toggle${filtersOpen ? ' is-open' : ''}`}
          onClick={() => setFiltersOpen((value) => !value)}
          aria-expanded={filtersOpen}
        >
          <Icon name="filter" size={14} />
          <span>筛选与排序</span>
          {activeFilterCount > 0 && <span className="gallery-toolbar-count">{activeFilterCount}</span>}
          <Icon name={filtersOpen ? 'up' : 'down'} size={13} className="gallery-toolbar-chevron" />
        </button>
        <div className="top-search" style={{ maxWidth: 300, marginLeft: 0 }}>
          <Icon name="search" size={14} />
          <input
            value={filter.keyword}
            placeholder="搜索标签 / 备注 / 日期"
            onChange={(e) => setFilter((f) => ({ ...f, keyword: e.target.value }))}
          />
        </div>
        <select
          className="select"
          style={{ width: 106 }}
          value={filter.year}
          onChange={(e) => setFilter((f) => ({ ...f, year: e.target.value }))}
        >
          <option value="">全部年份</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y} 年
            </option>
          ))}
        </select>
        <select
          className="select"
          style={{ width: 92 }}
          value={filter.month}
          onChange={(e) => setFilter((f) => ({ ...f, month: e.target.value }))}
        >
          <option value="">全年</option>
          {MONTHS_CN.map((name, idx) => (
            <option key={name} value={idx + 1}>
              {name}
            </option>
          ))}
        </select>
        <select
          className="select"
          style={{ width: 132 }}
          value={filter.sort}
          onChange={(e) => setFilter((f) => ({ ...f, sort: e.target.value as FilterState['sort'] }))}
        >
          <option value="publishedAsc">发布日 · 早→晚</option>
          <option value="publishedDesc">发布日 · 晚→早</option>
          <option value="diaryAsc">日记日 · 早→晚</option>
          <option value="diaryDesc">日记日 · 晚→早</option>
          <option value="updatedDesc">最近整理</option>
        </select>
        <select
          className="select"
          style={{ width: 112 }}
          value={filter.translation}
          onChange={(e) => setFilter((f) => ({ ...f, translation: e.target.value as FilterState['translation'] }))}
        >
          <option value="any">翻译不限</option>
          <option value="none">未翻译</option>
          <option value="translated">已翻译</option>
        </select>
        <div className="row" style={{ gap: 6 }}>
          {!IS_PUBLIC && (
            <>
              <button
                className={`chip${filter.favoriteOnly ? ' active' : ''}`}
                onClick={() => setFilter((f) => ({ ...f, favoriteOnly: !f.favoriteOnly }))}
              >
                <Icon name="heart" size={11} />
                只看收藏
              </button>
              <button
                className={`chip${filter.unconfirmedOnly ? ' active' : ''}`}
                onClick={() => setFilter((f) => ({ ...f, unconfirmedOnly: !f.unconfirmedOnly }))}
              >
                <Icon name="check" size={11} />
                待校对
              </button>
            </>
          )}
          <button className={`chip${tagFilterOpen ? ' active' : ''}`} onClick={() => setTagFilterOpen((v) => !v)}>
            <Icon name="tag" size={11} />
            标签{filter.tagIds.length ? ` ${filter.tagIds.length}` : ''}
          </button>
        </div>
        <div className="spacer" />
        {!IS_PUBLIC && (
          <>
            <button
              className="btn btn-sm"
              onClick={() => setStorylineIds(filtered.map((i) => i.id))}
              disabled={!filtered.length}
              title="把当前筛选结果的顺序保存为故事线"
            >
              <Icon name="book" size={13} />
              当前筛选加入故事线
            </button>
            {selectMode && (
              <>
                <button
                  className="btn btn-sm"
                  onClick={() => setSelected(new Set(filtered.map((i) => i.id)))}
                >
                  全选当前
                </button>
                <button className="btn btn-sm btn-ghost" onClick={clearSelection} disabled={!selected.size}>
                  清除
                </button>
              </>
            )}
          </>
        )}
      </div>

      {tagFilterOpen && (
        <div className="panel tag-filter-panel">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="field-label">按标签过滤</span>
            <div className="segmented">
              <button
                className={filter.tagMode === 'any' ? 'active' : ''}
                onClick={() => setFilter((f) => ({ ...f, tagMode: 'any' }))}
              >
                任一
              </button>
              <button
                className={filter.tagMode === 'all' ? 'active' : ''}
                onClick={() => setFilter((f) => ({ ...f, tagMode: 'all' }))}
              >
                全部
              </button>
            </div>
          </div>
          <div className="row row-wrap" style={{ gap: 6, marginTop: 10 }}>
            {tags.length ? (
              tags.map((tag) => (
                <button
                  key={tag.id}
                  className={`chip${filter.tagIds.includes(tag.id) ? ' active' : ''}`}
                  style={filter.tagIds.includes(tag.id) ? { background: tag.color, borderColor: tag.color, color: '#fff' } : undefined}
                  onClick={() => toggleTagFilter(tag.id)}
                >
                  {tag.name}
                </button>
              ))
            ) : (
              <span className="muted">还没有标签，先去标签页创建吧。</span>
            )}
            {filter.tagIds.length > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={() => setFilter((f) => ({ ...f, tagIds: [] }))}>
                清空标签
              </button>
            )}
          </div>
        </div>
      )}

      {!groups.length ? (
        !sourceItems.length ? (
          <Empty
            icon="image"
            title="还没有图片"
            hint={
              IS_PUBLIC
                ? '公开站还没有发布任何绘日记。'
                : '把解压后的 Instagram 保存页目录导入：npm run import -- "<解压目录>"，然后运行 npm run data 生成索引。'
            }
          />
        ) : (
          <Empty
            icon="image"
            title={showExcluded ? '排除区是空的' : '没有符合条件的作品'}
            hint={
              showExcluded
                ? '在详情中点「非绘日记」，图片就会集中到这里；原始文件始终保留。'
                : '试试清除关键词、年份或标签筛选。'
            }
            action={
              <button className="btn btn-sm" onClick={() => setFilter(DEFAULT_FILTER)}>
                重置筛选
              </button>
            }
          />
        )
      ) : (
        <div className="gallery-groups">
          {groups.map((group) => (
            <section key={group.key} className="gallery-group">
              <div className="group-head">
                <h3>
                  {group.key === 'unknown' ? '日期待定' : `${group.year} 年 ${group.month} 月`}
                  <span className="group-count num">{group.items.length} 张</span>
                </h3>
                {group.key !== 'unknown' && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => navigate(`/calendar?y=${group.year}&m=${group.month}`)}
                  >
                    在日历中查看
                    <Icon name="right" size={12} />
                  </button>
                )}
              </div>
              <Masonry
                items={group.items}
                selectable={!IS_PUBLIC && selectMode}
                selected={selected}
                onToggleSelect={toggleSelect}
              />
            </section>
          ))}
        </div>
      )}

      {!IS_PUBLIC && selectMode && selected.size > 0 && (
        <div className="selection-bar">
          <span className="selection-count num">已选 {selected.size} 张</span>
          <div className="divider-v" />
          <button className="btn btn-sm btn-soft" onClick={downloadSelected} disabled={zipProgress !== null}>
            <Icon name="download" size={13} />
            {zipProgress ? `原图 ${zipProgress}` : '原图 ZIP'}
          </button>
          <button className="btn btn-sm btn-soft" onClick={() => { setPickTags([]); setTagModal(true) }}>
            <Icon name="tag" size={13} />
            打标签
          </button>
          <button
            className="btn btn-sm btn-soft"
            onClick={() => {
              setPickCharacters([])
              setCharacterModal(true)
            }}
          >
            <Icon name="users" size={13} />
            出场人物
          </button>
          <button className="btn btn-sm btn-soft" onClick={() => { setFavorite(selectedIds, true); notify(`已收藏 ${selectedIds.length} 张`, 'success') }}>
            <Icon name="heart" size={13} />
            收藏
          </button>
          <button className="btn btn-sm btn-soft" onClick={() => { setFavorite(selectedIds, false); notify('已取消收藏', 'success') }}>
            取消收藏
          </button>
          <button
            className="btn btn-sm btn-soft"
            onClick={() => { confirmDate(selectedIds, 'suggested'); notify(`已按推断日期确认 ${selectedIds.length} 张`, 'success') }}
          >
            <Icon name="check" size={13} />
            确认推断日期
          </button>
          <button className="btn btn-sm btn-soft" onClick={() => setCollectionModal(true)}>
            <Icon name="folder" size={13} />
            加入合集
          </button>
          <button className="btn btn-sm btn-soft" onClick={() => setStorylineIds(selectedIds)}>
            <Icon name="book" size={13} />
            加入故事线
          </button>
          {!showExcluded && (
            <button
              className="btn btn-sm btn-soft"
              onClick={() => {
                setReviewStatus(selectedIds, 'diary')
                notify(`已确认 ${selectedIds.length} 张绘日记，原始图片保持不变`, 'success')
                clearSelection()
              }}
            >
              <Icon name="check" size={13} />
              确认绘日记
            </button>
          )}
          <button
            className={`btn btn-sm${showExcluded ? ' btn-primary' : ' btn-danger'}`}
            onClick={() => {
              setReviewStatus(selectedIds, showExcluded ? 'diary' : 'not_diary')
              notify(showExcluded ? `已恢复 ${selectedIds.length} 张绘日记` : `已标记 ${selectedIds.length} 张非绘日记，原始图片仍保留`, 'success')
              clearSelection()
            }}
          >
            <Icon name={showExcluded ? 'check' : 'close'} size={13} />
            {showExcluded ? '恢复为绘日记' : '标记非绘日记'}
          </button>
          <button className="btn btn-sm btn-danger-ghost" onClick={() => setDeleteOpen(true)}>
            <Icon name="trash" size={13} />
            删除
          </button>
          <button className="icon-btn" onClick={clearSelection} aria-label="清除选择">
            <Icon name="close" size={14} />
          </button>
        </div>
      )}

      {!IS_PUBLIC && deleteOpen && (
        <Modal title={`删除 ${selectedIds.length} 张图？`} onClose={() => setDeleteOpen(false)}>
          <div className="muted" style={{ lineHeight: 1.7 }}>
            确认后立即从图库、索引和公开数据中移除，并把原图移入
            <code> images/_trash/</code>。底部提示条可短时间撤销；彻底清理需在本地管理端执行
            （<code>npm run dev</code> 的「待清理」或 <code>npm run purge</code>），清理后不可恢复。
          </div>
          <div className="modal-foot">
            <button className="btn" onClick={() => setDeleteOpen(false)}>
              取消
            </button>
            <button
              className="btn btn-danger-ghost"
              onClick={async () => {
                const files = selectedItems.map((item) => item.file)
                const moved = await moveFilesToTrash(files)
                deleteItems(selectedIds)
                notify(
                  moved
                    ? `已把 ${selectedIds.length} 张移入回收站，可在底部撤销`
                    : `已移除 ${selectedIds.length} 张；原图清理需在本地管理端执行（npm run dev）`,
                  'success',
                )
                setDeleteOpen(false)
                clearSelection()
              }}
            >
              确认删除
            </button>
          </div>
        </Modal>
      )}

      {tagModal && (
        <Modal
          title={`批量打标签 · ${selected.size} 张`}
          onClose={() => setTagModal(false)}
          footer={
            <>
              <button className="btn" onClick={() => setTagModal(false)}>
                取消
              </button>
              <button
                className="btn btn-danger"
                disabled={!pickTags.length}
                onClick={() => {
                  removeTagFromItems(selectedIds, pickTags[0])
                  notify('已移除标签', 'success')
                  setTagModal(false)
                }}
              >
                移除第一个
              </button>
              <button
                className="btn btn-primary"
                disabled={!pickTags.length}
                onClick={() => {
                  pickTags.forEach((tagId) => addTagToItems(selectedIds, tagId))
                  notify(`已为 ${selected.size} 张添加 ${pickTags.length} 个标签`, 'success')
                  setTagModal(false)
                }}
              >
                添加标签
              </button>
            </>
          }
        >
          <TagPicker selected={pickTags} onChange={setPickTags} counts={undefined} />
        </Modal>
      )}

      {characterModal && (
        <Modal
          title={`批量标注出场人物 · ${selected.size} 张`}
          onClose={() => setCharacterModal(false)}
          footer={
            <>
              <button className="btn" onClick={() => setCharacterModal(false)}>
                取消
              </button>
              <button
                className="btn btn-danger"
                disabled={!pickCharacters.length}
                onClick={() => {
                  pickCharacters.forEach((tagId) => removeTagFromItems(selectedIds, tagId))
                  notify(`已从 ${selected.size} 张移除所选角色`, 'success')
                  setCharacterModal(false)
                }}
              >
                移除所选角色
              </button>
              <button
                className="btn btn-primary"
                disabled={!pickCharacters.length}
                onClick={() => {
                  pickCharacters.forEach((tagId) => addTagToItems(selectedIds, tagId))
                  notify(`已为 ${selected.size} 张添加 ${pickCharacters.length} 个角色`, 'success')
                  setCharacterModal(false)
                }}
              >
                添加所选角色
              </button>
            </>
          }
        >
          <CharacterPicker selected={pickCharacters} onChange={setPickCharacters} />
        </Modal>
      )}

      {collectionModal && (
        <Modal
          title="加入合集"
          onClose={() => setCollectionModal(false)}
          footer={
            <button className="btn" onClick={() => setCollectionModal(false)}>
              完成
            </button>
          }
        >
          <div className="collection-pick-list">
            {collections.map((col) => {
              const added = selectedIds.every((id) => col.itemIds.includes(id))
              return (
                <button
                  key={col.id}
                  className="collection-pick"
                  onClick={() => {
                    addToCollection(col.id, selectedIds)
                    notify(`已加入「${col.name}」`, 'success')
                    setCollectionModal(false)
                  }}
                >
                  <Icon name="folder" size={16} />
                  <span>{col.name}</span>
                  <span className="faint">{col.itemIds.length} 张</span>
                  {added && <Icon name="check" size={14} />}
                </button>
              )
            })}
          </div>
          <div className="divider" />
          <div className="row">
            <input
              className="input"
              placeholder="新建合集名称"
              value={newCollection}
              onChange={(e) => setNewCollection(e.target.value)}
            />
            <button
              className="btn btn-primary"
              disabled={!newCollection.trim()}
              onClick={() => {
                const col = addCollection(newCollection.trim())
                addToCollection(col.id, selectedIds)
                setNewCollection('')
                notify(`已创建「${col.name}」并加入 ${selectedIds.length} 张`, 'success')
                setCollectionModal(false)
              }}
            >
              新建并加入
            </button>
          </div>
          <div className="faint" style={{ marginTop: 8, fontSize: 11.5 }}>
            当前本地共有 {data.collections.length} 个合集。
          </div>
        </Modal>
      )}

      {storylineIds && (
        <Modal
          title={`加入故事线 · ${storylineIds.length} 张`}
          onClose={() => setStorylineIds(null)}
          footer={
            <button className="btn" onClick={() => setStorylineIds(null)}>
              完成
            </button>
          }
        >
          <div className="collection-pick-list">
            {storylines.map((story) => (
              <button
                key={story.id}
                className="collection-pick"
                onClick={() => {
                  addToStoryline(story.id, storylineIds)
                  notify(`已加入「${story.title}」`, 'success')
                  setStorylineIds(null)
                }}
              >
                <Icon name="book" size={16} />
                <span>{story.title}</span>
                <span className="faint">{story.blocks.filter((b) => b.type === 'image').length} 张</span>
              </button>
            ))}
          </div>
          <div className="divider" />
          <div className="row">
            <input
              className="input"
              placeholder="新建故事线标题"
              value={newStoryline}
              onChange={(e) => setNewStoryline(e.target.value)}
            />
            <button
              className="btn btn-primary"
              disabled={!newStoryline.trim()}
              onClick={() => {
                const story = addStoryline(newStoryline.trim(), storylineIds)
                setNewStoryline('')
                notify(`已创建「${story.title}」并加入 ${storylineIds.length} 张`, 'success')
                setStorylineIds(null)
              }}
            >
              新建并加入
            </button>
          </div>
          <div className="faint" style={{ marginTop: 8, fontSize: 11.5 }}>
            图片顺序会按当前筛选 / 选择顺序写入，之后可在故事线里拖动调整。
          </div>
        </Modal>
      )}
    </div>
  )
}
