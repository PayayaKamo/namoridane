import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { useStore } from '../state/store'
import { Icon } from '../components/Icon'
import { Empty, Modal } from '../components/Modal'
import { effectiveDate } from '../lib/dates'
import { navigate } from '../lib/router'
import { CHARACTER_PRESETS, presetAvatarPath, sortCharacterTags } from '../lib/constants'
import { IS_PUBLIC } from '../lib/appMode'
import type { Character, Tag } from '../types'
import type { Route } from '../lib/router'

const BASE = import.meta.env.BASE_URL

export function CharactersView({ route }: { route: Route }) {
  const {
    tags,
    dimensions,
    annotations,
    items,
    characters,
    characterCovers,
    getDate,
    addCharacterPresets,
    addCharacter,
    updateCharacter,
    notify,
  } = useStore()
  const characterDim = dimensions.find((d) => d.id === 'character')
  const charTags = useMemo(
    () => sortCharacterTags(tags.filter((t) => t.dimensionId === (characterDim?.id ?? 'character'))),
    [tags, characterDim],
  )
  const characterMap = useMemo(() => new Map(characters.map((c) => [c.id, c])), [characters])

  const [editing, setEditing] = useState<Tag | null>(null)
  const [creating, setCreating] = useState(false)
  const highlightId = route.query.get('char') ?? ''

  const data = useMemo(() => {
    return charTags.map((tag) => {
      const members = items.filter((item) => annotations[item.id]?.tags.includes(tag.id))
      const sorted = [...members].sort((a, b) => getDate(b).iso.localeCompare(getDate(a).iso))
      const cover = sorted[0]
      return {
        tag,
        character: characterMap.get(tag.id),
        count: members.length,
        cover,
        members: sorted,
      }
    })
  }, [charTags, items, annotations, getDate, characterMap])

  useEffect(() => {
    if (!highlightId) return
    document.getElementById(`character-${highlightId}`)?.scrollIntoView({ block: 'center' })
  }, [highlightId, data.length])

  const totalTagged = data.reduce((sum, d) => sum + d.count, 0)
  const editingEntry = editing ? data.find((d) => d.tag.id === editing.id) : undefined
  const existingNames = new Set(charTags.map((tag) => tag.name))
  const missingCount = CHARACTER_PRESETS.filter((character) => !existingNames.has(character.name)).length
  const addPresets = () => {
    addCharacterPresets()
    notify(missingCount ? `已补齐 ${missingCount} 位预置角色` : '预置角色已全部就绪', 'success')
  }
  const coverOverrideCount = characters.filter((character) => character.coverItemId || character.coverCrop).length
  const clearCoverOverrides = () => {
    if (!coverOverrideCount) {
      notify('当前没有封面覆盖，所有角色都是默认显示')
      return
    }
    if (!window.confirm(`将清空 ${coverOverrideCount} 个角色的封面来源与焦点/缩放，全部恢复默认封面。继续？`)) return
    for (const character of characters) {
      if (character.coverItemId || character.coverCrop) {
        updateCharacter(character.id, { coverItemId: undefined, coverCrop: undefined })
      }
    }
    notify(`已恢复 ${coverOverrideCount} 个角色的默认封面`, 'success')
  }

  return (
    <div className="characters-view">
      <div className="page-head">
        <div>
          <div className="page-eyebrow">Character Codex</div>
          <h2 className="page-title">角色图鉴</h2>
          <div className="page-sub">
            {data.length} 位角色 · 累计 {totalTagged} 次出场 · 名称与颜色来自「{characterDim?.name ?? '人物 / 角色'}」维度
          </div>
        </div>
        <div className="page-actions">
          {!IS_PUBLIC && (
            <button className="btn" onClick={() => setCreating(true)}>
              <Icon name="plus" size={14} />新建角色
            </button>
          )}
          {!IS_PUBLIC && (
            <>
              <button className="btn" onClick={addPresets} disabled={!missingCount}>
                <Icon name={missingCount ? 'plus' : 'check'} size={14} />
                {missingCount ? `补齐 ${missingCount} 位角色预置` : `${CHARACTER_PRESETS.length} 位角色已就绪`}
              </button>
              <button className="btn" onClick={() => navigate('/tags')}>
                <Icon name="tag" size={14} />
                管理人物标签
              </button>
              <button className="btn" onClick={clearCoverOverrides}>
                <Icon name="trash" size={14} />
                全部恢复默认封面{coverOverrideCount ? `（${coverOverrideCount}）` : ''}
              </button>
            </>
          )}
        </div>
      </div>

      {data.length ? (
        <div className="character-grid">
          {data.map(({ tag, character, count, cover }) => {
            const characterCover = characterCovers.get(tag.id)
            const avatarItem = character?.avatarItemId
              ? items.find((item) => item.id === character.avatarItemId)
              : undefined
            // 旧头像裁切只用于图鉴内部的兜底显示，其他页面只认封面参数
            const legacyPosition = character?.avatarCrop
              ? `${Math.round(character.avatarCrop.cx * 100)}% ${Math.round(character.avatarCrop.cy * 100)}%`
              : '50% 50%'
            const coverStyle = { objectPosition: legacyPosition, transformOrigin: legacyPosition }
            return (
              <div
                key={tag.id}
                id={`character-${tag.id}`}
                className={`character-card${tag.id === highlightId ? ' is-highlight' : ''}`}
              >
                <button className="character-cover" style={{ background: tag.color }} onClick={() => navigate(`/gallery?tag=${tag.id}`)}>
                  {characterCover ? (
                    <img
                      src={characterCover.src}
                      alt={tag.name}
                      loading="lazy"
                      style={{
                        objectPosition: characterCover.objectPosition,
                        transformOrigin: characterCover.transformOrigin,
                        transform: characterCover.transform,
                      }}
                    />
                  ) : character?.avatarDataUrl ? (
                    <img src={character.avatarDataUrl} alt={tag.name} style={coverStyle} />
                  ) : avatarItem ? (
                    <img src={`${BASE}${avatarItem.thumb}`} alt={tag.name} style={coverStyle} />
                  ) : character?.avatar ? (
                    <img src={`${BASE}${character.avatar}`} alt={tag.name} loading="lazy" />
                  ) : presetAvatarPath(tag.id) ? (
                    <img src={`${BASE}${presetAvatarPath(tag.id)}`} alt={tag.name} loading="lazy" />
                  ) : cover ? (
                    <img src={`${BASE}${cover.thumb}`} alt={tag.name} loading="lazy" />
                  ) : (
                    <span className="character-placeholder">{tag.name.slice(0, 1)}</span>
                  )}
                  <span className="character-count num">{count} 张</span>
                </button>
                <div className="character-body">
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <div className="character-name">{tag.name}</div>
                    {!IS_PUBLIC && (
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditing(tag)}>
                        编辑
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <Empty
          icon="users"
          title={IS_PUBLIC ? '角色资料正在整理中' : '还没有人物/角色标签'}
          hint={
            IS_PUBLIC
              ? '敬请期待，之后会补上角色介绍与出场作品。'
              : '可以一键加入《摇曳百合》《大室家》及相关角色，再到作品详情或图库批量整理中人工选择出场人物。'
          }
          action={
            IS_PUBLIC ? undefined : (
              <div className="row row-wrap" style={{ justifyContent: 'center', gap: 8, marginTop: 16 }}>
                <button className="btn btn-primary btn-sm" onClick={addPresets}>
                  <Icon name="plus" size={14} />加入 {CHARACTER_PRESETS.length} 位预置角色
                </button>
                <button className="btn btn-sm" onClick={() => navigate('/tags')}>手动管理角色</button>
              </div>
            )
          }
        />
      )}

      {editing && (
        <CharacterEditModal
          tag={editing}
          character={characterMap.get(editing.id)}
          coverOptions={(editingEntry?.members ?? []).map((item) => ({
            id: item.id,
            thumb: `${BASE}${item.thumb}`,
            label: `${effectiveDate(item, annotations[item.id]).iso || '日期待定'} · ${item.file}`,
            date: effectiveDate(item, annotations[item.id]).iso || '日期待定',
          }))}
          onClose={() => setEditing(null)}
          onSave={(patch) => {
            updateCharacter(editing.id, patch)
            notify('封面已保存', 'success')
            setEditing(null)
          }}
        />
      )}

      {creating && (
        <CharacterCreateModal
          onCreate={(name, color) => {
            addCharacter(name, color)
            notify(`已创建角色「${name}」`, 'success')
            setCreating(false)
          }}
          onClose={() => setCreating(false)}
        />
      )}
    </div>
  )
}

type CoverOption = { id: string; label: string; thumb: string; date: string }

function CharacterEditModal({
  tag,
  character,
  coverOptions,
  onClose,
  onSave,
}: {
  tag: Tag
  character?: Character
  coverOptions: CoverOption[]
  onClose: () => void
  onSave: (patch: Partial<Character>) => void
}) {
  const [coverItemId, setCoverItemId] = useState(character?.coverItemId ?? '')
  const [crop, setCrop] = useState(() => ({
    x: character?.coverCrop?.x ?? 50,
    y: character?.coverCrop?.y ?? 50,
    zoom: character?.coverCrop?.zoom ?? 1,
  }))
  const dragRef = useRef<{ px: number; py: number; x: number; y: number; w: number; h: number } | null>(null)

  const clamp = (value: number) => Math.min(100, Math.max(0, value))
  const patchCrop = (next: Partial<typeof crop>) => setCrop((prev) => ({ ...prev, ...next }))

  const coverOption = coverOptions.find((option) => option.id === coverItemId)
  const avatarItem = character?.avatarItemId
    ? coverOptions.find((option) => option.id === character.avatarItemId)
    : undefined
  const preset = presetAvatarPath(tag.id)
  const avatarFallback = character?.avatarDataUrl
    ? character.avatarDataUrl
    : avatarItem
      ? avatarItem.thumb
      : character?.avatar
        ? `${BASE}${character.avatar}`
        : preset
          ? `${BASE}${preset}`
          : coverOptions[0]?.thumb ?? ''
  const previewSrc = coverOption ? coverOption.thumb : avatarFallback
  const previewStyle = {
    objectPosition: `${crop.x}% ${crop.y}%`,
    transformOrigin: `${crop.x}% ${crop.y}%`,
    transform: crop.zoom !== 1 ? `scale(${crop.zoom})` : undefined,
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      px: event.clientX,
      py: event.clientY,
      x: crop.x,
      y: crop.y,
      w: rect.width,
      h: rect.height,
    }
  }
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag) return
    patchCrop({
      x: clamp(drag.x - ((event.clientX - drag.px) / Math.max(1, drag.w)) * 100),
      y: clamp(drag.y - ((event.clientY - drag.py) / Math.max(1, drag.h)) * 100),
    })
  }
  const stopDrag = () => {
    dragRef.current = null
  }
  const onPreviewKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') patchCrop({ x: clamp(crop.x - 1) })
    else if (event.key === 'ArrowRight') patchCrop({ x: clamp(crop.x + 1) })
    else if (event.key === 'ArrowUp') patchCrop({ y: clamp(crop.y - 1) })
    else if (event.key === 'ArrowDown') patchCrop({ y: clamp(crop.y + 1) })
    else return
    event.preventDefault()
  }
  const resetCover = () => {
    setCoverItemId('')
    setCrop({ x: 50, y: 50, zoom: 1 })
  }

  const save = () =>
    onSave({
      coverItemId: coverItemId || undefined,
      coverCrop:
        crop.x === 50 && crop.y === 50 && crop.zoom === 1
          ? undefined
          : { x: crop.x, y: crop.y, zoom: crop.zoom },
    })

  return (
    <Modal
      title={`设置封面 · ${tag.name}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={save}>保存</button>
        </>
      }
    >
      <div className="character-edit">
        <div className="cover-editor">
          <div
            className="cover-editor-preview"
            style={{ background: tag.color }}
              role="group"
              aria-label="角色封面预览，可拖动或用方向键调整焦点"
              tabIndex={0}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={stopDrag}
              onPointerCancel={stopDrag}
              onKeyDown={onPreviewKeyDown}
            >
              {previewSrc ? (
                <img src={previewSrc} alt="" style={previewStyle} draggable={false} />
              ) : (
                <span className="cover-editor-empty">{tag.name.slice(0, 1)}</span>
              )}
              <span className="cover-editor-hint">拖动或方向键调整焦点</span>
            </div>
            <div className="cover-editor-controls">
              <div className="field cover-source">
                <span className="field-label">封面来源</span>
                <div className="cover-source-strip" role="listbox" aria-label="封面来源，点击切换预览">
                  <button
                    type="button"
                    className={`cover-source-item${coverItemId ? '' : ' active'}`}
                    aria-pressed={!coverItemId}
                    title="默认：预置头像 / 最近作品"
                    onClick={() => setCoverItemId('')}
                  >
                    {avatarFallback ? (
                      <img src={avatarFallback} alt="" loading="lazy" draggable={false} />
                    ) : (
                      <span className="cover-source-fallback" style={{ background: tag.color }}>{tag.name.slice(0, 1)}</span>
                    )}
                    <span className="cover-source-date">默认</span>
                    {!coverItemId && <span className="cover-source-check"><Icon name="check" size={11} /></span>}
                  </button>
                  {coverOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={`cover-source-item${coverItemId === option.id ? ' active' : ''}`}
                      aria-pressed={coverItemId === option.id}
                      title={option.label}
                      onClick={() => setCoverItemId(option.id)}
                    >
                      <img src={option.thumb} alt={option.label} loading="lazy" draggable={false} />
                      <span className="cover-source-date">{option.date}</span>
                      {coverItemId === option.id && <span className="cover-source-check"><Icon name="check" size={11} /></span>}
                    </button>
                  ))}
                </div>
              </div>
              <label className="cover-editor-row">
                <span>水平</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={crop.x}
                  onChange={(e) => patchCrop({ x: Number(e.target.value) })}
                />
                <span className="num">{Math.round(crop.x)}%</span>
              </label>
              <label className="cover-editor-row">
                <span>垂直</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={crop.y}
                  onChange={(e) => patchCrop({ y: Number(e.target.value) })}
                />
                <span className="num">{Math.round(crop.y)}%</span>
              </label>
              <label className="cover-editor-row">
                <span>缩放</span>
                <input
                  type="range"
                  min={1}
                  max={4}
                  step={crop.zoom < 2 ? 0.05 : 0.1}
                  value={crop.zoom}
                  onChange={(e) => patchCrop({ zoom: Number(e.target.value) })}
                />
                <input
                  className="input cover-editor-number"
                  type="number"
                  min={1}
                  max={4}
                  step={0.05}
                  value={Number(crop.zoom.toFixed(2))}
                  onChange={(e) => {
                    const next = Number(e.target.value)
                    if (Number.isFinite(next)) patchCrop({ zoom: Math.min(4, Math.max(1, next)) })
                  }}
                />
              </label>
              <div className="row row-wrap" style={{ gap: 8, alignItems: 'center' }}>
                <button className="btn btn-sm btn-ghost" onClick={resetCover}>
                  恢复默认
                </button>
              </div>
            </div>
          </div>
        </div>
      </Modal>
  )
}

function CharacterCreateModal({
  onCreate,
  onClose,
}: {
  onCreate: (name: string, color: string) => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [color, setColor] = useState('#8aa8c8')
  return (
    <Modal title="新建角色" onClose={onClose}>
      <div className="character-edit">
        <label className="field">
          <span className="field-label">名称</span>
          <input className="input" value={name} placeholder="例如：赤座灯里" onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">颜色</span>
          <input type="color" className="input" style={{ height: 36 }} value={color} onChange={(e) => setColor(e.target.value)} />
        </label>
      </div>
      <div className="modal-foot">
        <button className="btn" onClick={onClose}>取消</button>
        <button className="btn btn-primary" disabled={!name.trim()} onClick={() => onCreate(name.trim(), color)}>
          创建
        </button>
      </div>
    </Modal>
  )
}
