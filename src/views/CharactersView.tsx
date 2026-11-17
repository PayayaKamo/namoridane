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
import type { Character, DiaryItem, Tag } from '../types'
import type { Route } from '../lib/router'

const BASE = import.meta.env.BASE_URL

export function CharactersView({ route }: { route: Route }) {
  const {
    tags,
    dimensions,
    annotations,
    items,
    characters,
    getDate,
    addCharacterPresets,
    addCharacter,
    updateCharacter,
    updateTag,
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
      const scenes = new Map<string, number>()
      for (const item of members) {
        for (const tid of annotations[item.id]?.tags ?? []) {
          const t = tags.find((x) => x.id === tid)
          if (!t || t.dimensionId !== 'scene') continue
          scenes.set(t.name, (scenes.get(t.name) ?? 0) + 1)
        }
      }
      return {
        tag,
        character: characterMap.get(tag.id),
        count: members.length,
        cover,
        members: sorted,
        first: sorted[sorted.length - 1],
        latest: cover,
        scenes: [...scenes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3),
      }
    })
  }, [charTags, items, annotations, tags, getDate, characterMap])

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
            </>
          )}
        </div>
      </div>

      {data.length ? (
        <div className="character-grid">
          {data.map(({ tag, character, count, cover, first, latest, scenes }) => {
            const avatarItem = character?.avatarItemId
              ? items.find((item) => item.id === character.avatarItemId)
              : undefined
            const coverItem = character?.coverItemId
              ? items.find((item) => item.id === character.coverItemId)
              : undefined
            const coverCrop = character?.coverCrop
            const position = coverCrop
              ? `${coverCrop.x}% ${coverCrop.y}%`
              : character?.avatarCrop
                ? `${Math.round(character.avatarCrop.cx * 100)}% ${Math.round(character.avatarCrop.cy * 100)}%`
                : '50% 50%'
            const coverStyle = {
              objectPosition: position,
              transformOrigin: position,
              transform: coverCrop && coverCrop.zoom !== 1 ? `scale(${coverCrop.zoom})` : undefined,
            }
            return (
              <div
                key={tag.id}
                id={`character-${tag.id}`}
                className={`character-card${tag.id === highlightId ? ' is-highlight' : ''}`}
              >
                <button className="character-cover" style={{ background: tag.color }} onClick={() => navigate(`/gallery?tag=${tag.id}`)}>
                  {coverItem ? (
                    <img src={`${BASE}${coverItem.thumb}`} alt={tag.name} style={coverStyle} loading="lazy" />
                  ) : character?.avatarDataUrl ? (
                    <img src={character.avatarDataUrl} alt={tag.name} style={coverStyle} />
                  ) : avatarItem ? (
                    <img src={`${BASE}${avatarItem.thumb}`} alt={tag.name} style={coverStyle} />
                  ) : character?.avatar ? (
                    <img src={`${BASE}${character.avatar}`} alt={tag.name} style={coverStyle} loading="lazy" />
                  ) : presetAvatarPath(tag.id) ? (
                    <img src={`${BASE}${presetAvatarPath(tag.id)}`} alt={tag.name} style={coverStyle} loading="lazy" />
                  ) : cover ? (
                    <img src={`${BASE}${cover.thumb}`} alt={tag.name} style={coverStyle} loading="lazy" />
                  ) : (
                    <span className="character-placeholder">
                      <Icon name="users" size={28} />
                    </span>
                  )}
                  <span className="character-count num">{count} 张</span>
                </button>
                <div className="character-body">
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <div className="character-name">
                      <span className="color-dot" style={{ background: tag.color }} />
                      {tag.name}
                    </div>
                    {!IS_PUBLIC && (
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditing(tag)}>
                        编辑
                      </button>
                    )}
                  </div>
                  <div className="faint character-meta">
                    {first && latest ? (
                      <>
                        首次 {effectiveDate(first, annotations[first.id]).year || '待定'} · 最近{' '}
                        {effectiveDate(latest, annotations[latest.id]).year || '待定'}
                      </>
                    ) : (
                      '还没有作品出场'
                    )}
                  </div>
                  {scenes.length > 0 && (
                    <div className="row row-wrap" style={{ gap: 4, marginTop: 8 }}>
                      {scenes.map(([name, n]) => (
                        <span key={name} className="mini-chip">
                          {name}
                          <span className="num">{n}</span>
                        </span>
                      ))}
                    </div>
                  )}
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
          latest={editingEntry?.latest}
          coverOptions={(editingEntry?.members ?? []).map((item) => ({
            id: item.id,
            thumb: `${BASE}${item.thumb}`,
            label: `${effectiveDate(item, annotations[item.id]).iso || '日期待定'} · ${item.file}`,
          }))}
          onClose={() => setEditing(null)}
          onSave={(patch, avatar) => {
            updateTag(editing.id, patch)
            if (avatar) updateCharacter(editing.id, avatar)
            notify('角色信息已保存', 'success')
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

type CoverOption = { id: string; label: string; thumb: string }

function CharacterEditModal({
  tag,
  character,
  latest,
  coverOptions,
  onClose,
  onSave,
}: {
  tag: Tag
  character?: Character
  latest?: DiaryItem
  coverOptions: CoverOption[]
  onClose: () => void
  onSave: (patch: Partial<Pick<Tag, 'name' | 'color'>>, avatar?: Partial<Character>) => void
}) {
  const [name, setName] = useState(tag.name)
  const [color, setColor] = useState(tag.color)
  const [note, setNote] = useState(character?.note ?? '')
  const [avatarDataUrl, setAvatarDataUrl] = useState(character?.avatarDataUrl ?? '')
  const [avatarItemId, setAvatarItemId] = useState(character?.avatarItemId ?? '')
  const [coverItemId, setCoverItemId] = useState(character?.coverItemId ?? '')
  const [crop, setCrop] = useState(() => ({
    x: character?.coverCrop?.x ?? 50,
    y: character?.coverCrop?.y ?? 50,
    zoom: character?.coverCrop?.zoom ?? 1,
  }))
  const dragRef = useRef<{ px: number; py: number; x: number; y: number; w: number; h: number } | null>(null)

  const clamp = (value: number) => Math.min(100, Math.max(0, value))
  const patchCrop = (next: Partial<typeof crop>) => setCrop((prev) => ({ ...prev, ...next }))

  const upload = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      const image = new Image()
      image.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = 160
        canvas.height = 160
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        const side = Math.min(image.width, image.height)
        ctx.drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, 160, 160)
        setAvatarDataUrl(canvas.toDataURL('image/jpeg', 0.82))
        setAvatarItemId('')
      }
      image.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  }

  const coverOption = coverOptions.find((option) => option.id === coverItemId)
  const avatarOption = coverOptions.find((option) => option.id === avatarItemId)
  const preset = presetAvatarPath(tag.id)
  const avatarFallback = avatarDataUrl
    ? avatarDataUrl
    : avatarOption
      ? avatarOption.thumb
      : character?.avatar
        ? `${BASE}${character.avatar}`
        : preset
          ? `${BASE}${preset}`
          : latest
            ? `${BASE}${latest.thumb}`
            : ''
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

  return (
    <Modal title="编辑角色" onClose={onClose}>
      <div className="character-edit">
        <label className="character-edit-avatar">
          <span className="character-avatar" style={{ background: color, width: 56, height: 56 }}>
            {avatarDataUrl ? (
              <img src={avatarDataUrl} alt="" />
            ) : character?.avatar ? (
              <img src={`${BASE}${character.avatar}`} alt="" />
            ) : preset ? (
              <img src={`${BASE}${preset}`} alt="" />
            ) : latest ? (
              <img src={`${BASE}${latest.thumb}`} alt="" />
            ) : (
              name.slice(0, 1)
            )}
          </span>
          <span className="faint">上传正方形头像</span>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) upload(file)
            }}
          />
        </label>
        <label className="field">
          <span className="field-label">名称</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">颜色</span>
          <input type="color" className="input" style={{ height: 36 }} value={color} onChange={(e) => setColor(e.target.value)} />
        </label>
        <div className="field">
          <span className="field-label">封面</span>
          <div className="cover-editor">
            <div
              className="cover-editor-preview"
              style={{ background: color }}
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
                <span className="cover-editor-empty">{name.slice(0, 1)}</span>
              )}
              <span className="cover-editor-hint">拖动调整焦点 · 方向键微调</span>
            </div>
            <div className="cover-editor-controls">
              <label className="field">
                <span className="field-label">封面来源</span>
                <select className="select" value={coverItemId} onChange={(e) => setCoverItemId(e.target.value)}>
                  <option value="">默认（预置头像 / 最近作品）</option>
                  {coverOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
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
                  max={1.6}
                  step={0.01}
                  value={crop.zoom}
                  onChange={(e) => patchCrop({ zoom: Number(e.target.value) })}
                />
                <span className="num">{crop.zoom.toFixed(2)}×</span>
              </label>
              <div className="row row-wrap" style={{ gap: 8, alignItems: 'center' }}>
                <button className="btn btn-sm btn-ghost" onClick={resetCover}>
                  恢复默认
                </button>
                <span className="faint" style={{ fontSize: 11 }}>
                  只调整显示位置，不修改图片文件
                </span>
              </div>
            </div>
          </div>
        </div>
        <label className="field">
          <span className="field-label">备注</span>
          <textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <div className="row row-wrap" style={{ gap: 8 }}>
          {latest && (
            <button
              className="btn btn-sm"
              onClick={() => {
                setAvatarDataUrl('')
                setAvatarItemId(latest.id)
              }}
            >
              用最新作品做头像
            </button>
          )}
          {(avatarDataUrl || avatarItemId) && (
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => {
                setAvatarDataUrl('')
                setAvatarItemId('')
              }}
            >
              清除头像
            </button>
          )}
        </div>
      </div>
      <div className="modal-foot">
        <button className="btn" onClick={onClose}>取消</button>
        <button
          className="btn btn-primary"
          onClick={() =>
            onSave(
              { name: name.trim() || tag.name, color },
              {
                note,
                avatarDataUrl: avatarDataUrl || undefined,
                avatarItemId: avatarItemId || undefined,
                coverItemId: coverItemId || undefined,
                coverCrop:
                  crop.x === 50 && crop.y === 50 && crop.zoom === 1
                    ? undefined
                    : { x: crop.x, y: crop.y, zoom: crop.zoom },
              },
            )
          }
        >
          保存
        </button>
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
