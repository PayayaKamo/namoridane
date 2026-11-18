import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { useStore } from '../state/store'
import { useI18n } from '../i18n'
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
  const { t } = useI18n()
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
    notify(missingCount ? t('characters.list.addPresetsDone', { count: missingCount }) : t('characters.list.presetsAllReady'), 'success')
  }
  const coverOverrideCount = characters.filter((character) => character.coverItemId || character.coverCrop).length
  const clearCoverOverrides = () => {
    if (!coverOverrideCount) {
      notify(t('characters.list.noCoverOverrides'))
      return
    }
    if (!window.confirm(t('characters.list.clearCoversConfirm', { count: coverOverrideCount }))) return
    for (const character of characters) {
      if (character.coverItemId || character.coverCrop) {
        updateCharacter(character.id, { coverItemId: undefined, coverCrop: undefined })
      }
    }
    notify(t('characters.list.coversRestored', { count: coverOverrideCount }), 'success')
  }

  return (
    <div className="characters-view">
      <div className="page-head">
        <div>
          <div className="page-eyebrow">{t('characters.eyebrow')}</div>
          <h2 className="page-title">{t('shell.page.characters.title')}</h2>
          <div className="page-sub">
            {t('characters.list.summary', {
              count: data.length,
              total: totalTagged,
              dimension: characterDim?.name ?? '人物 / 角色',
            })}
          </div>
        </div>
        <div className="page-actions">
          {!IS_PUBLIC && (
            <button className="btn" onClick={() => setCreating(true)}>
              <Icon name="plus" size={14} />{t('characters.list.newCharacter')}
            </button>
          )}
          {!IS_PUBLIC && (
            <>
              <button className="btn" onClick={addPresets} disabled={!missingCount}>
                <Icon name={missingCount ? 'plus' : 'check'} size={14} />
                {missingCount
                  ? t('characters.list.addPresets', { count: missingCount })
                  : t('characters.list.presetsReady', { count: CHARACTER_PRESETS.length })}
              </button>
              <button className="btn" onClick={() => navigate('/tags')}>
                <Icon name="tag" size={14} />
                {t('characters.list.manageTags')}
              </button>
              <button className="btn" onClick={clearCoverOverrides}>
                <Icon name="trash" size={14} />
                {coverOverrideCount
                  ? t('characters.list.resetCoversCount', { count: coverOverrideCount })
                  : t('characters.list.resetCovers')}
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
                  <span className="character-count num">{t('common.itemCount', { count })}</span>
                </button>
                <div className="character-body">
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <div className="character-name">{tag.name}</div>
                    {!IS_PUBLIC && (
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditing(tag)}>
                        {t('common.edit')}
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
          title={IS_PUBLIC ? t('characters.list.emptyPublicTitle') : t('characters.list.emptyTitle')}
          hint={IS_PUBLIC ? t('characters.list.emptyPublicHint') : t('characters.list.emptyHint')}
          action={
            IS_PUBLIC ? undefined : (
              <div className="row row-wrap" style={{ justifyContent: 'center', gap: 8, marginTop: 16 }}>
                <button className="btn btn-primary btn-sm" onClick={addPresets}>
                  <Icon name="plus" size={14} />{t('characters.list.joinPresets', { count: CHARACTER_PRESETS.length })}
                </button>
                <button className="btn btn-sm" onClick={() => navigate('/tags')}>{t('characters.list.manageManually')}</button>
              </div>
            )
          }
        />
      )}

      {editing && (
        <CharacterEditModal
          tag={editing}
          character={characterMap.get(editing.id)}
          coverOptions={(editingEntry?.members ?? []).map((item) => {
            const iso = effectiveDate(item, annotations[item.id]).iso || t('common.dateUnknown')
            return {
              id: item.id,
              thumb: `${BASE}${item.thumb}`,
              label: `${iso} · ${item.file}`,
              date: iso,
            }
          })}
          onClose={() => setEditing(null)}
          onSave={(patch) => {
            updateCharacter(editing.id, patch)
            notify(t('characters.list.coverSaved'), 'success')
            setEditing(null)
          }}
        />
      )}

      {creating && (
        <CharacterCreateModal
          onCreate={(name, color) => {
            addCharacter(name, color)
            notify(t('characters.list.created', { name }), 'success')
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
  const { t } = useI18n()
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
      title={t('characters.editor.title', { name: tag.name })}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn btn-primary" onClick={save}>{t('common.save')}</button>
        </>
      }
    >
      <div className="character-edit">
        <div className="cover-editor">
          <div
            className="cover-editor-preview"
            style={{ background: tag.color }}
              role="group"
              aria-label={t('characters.editor.previewAria')}
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
              <span className="cover-editor-hint">{t('characters.editor.dragHint')}</span>
            </div>
            <div className="cover-editor-controls">
              <div className="field cover-source">
                <span className="field-label">{t('characters.editor.source')}</span>
                <div className="cover-source-strip" role="listbox" aria-label={t('characters.editor.sourceAria')}>
                  <button
                    type="button"
                    className={`cover-source-item${coverItemId ? '' : ' active'}`}
                    aria-pressed={!coverItemId}
                    title={t('characters.editor.defaultSource')}
                    onClick={() => setCoverItemId('')}
                  >
                    {avatarFallback ? (
                      <img src={avatarFallback} alt="" loading="lazy" draggable={false} />
                    ) : (
                      <span className="cover-source-fallback" style={{ background: tag.color }}>{tag.name.slice(0, 1)}</span>
                    )}
                    <span className="cover-source-date">{t('characters.editor.default')}</span>
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
                <span>{t('characters.editor.horizontal')}</span>
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
                <span>{t('characters.editor.vertical')}</span>
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
                <span>{t('characters.editor.zoom')}</span>
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
                  {t('characters.editor.reset')}
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
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [color, setColor] = useState('#8aa8c8')
  return (
    <Modal title={t('characters.create.title')} onClose={onClose}>
      <div className="character-edit">
        <label className="field">
          <span className="field-label">{t('common.name')}</span>
          <input className="input" value={name} placeholder={t('characters.create.namePlaceholder')} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">{t('common.color')}</span>
          <input type="color" className="input" style={{ height: 36 }} value={color} onChange={(e) => setColor(e.target.value)} />
        </label>
      </div>
      <div className="modal-foot">
        <button className="btn" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn btn-primary" disabled={!name.trim()} onClick={() => onCreate(name.trim(), color)}>
          {t('common.create')}
        </button>
      </div>
    </Modal>
  )
}
