import { useMemo, useState } from 'react'
import { useStore } from '../state/store'
import { Icon } from './Icon'
import { TAG_COLORS } from '../lib/constants'
import type { Tag } from '../types'
import { readableInk } from '../lib/colors'
import { useI18n } from '../i18n'

export function TagPill({
  tag,
  onRemove,
  onClick,
  active,
}: {
  tag: Tag
  onRemove?: () => void
  onClick?: () => void
  active?: boolean
}) {
  const { t } = useI18n()
  return (
    <span
      className="tag-pill"
      style={{
        ['--tag-color' as string]: tag.color,
        ...(active ? { background: tag.color, color: readableInk(tag.color), borderColor: tag.color } : {}),
      }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      {tag.name}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          aria-label={t('shell.tagPicker.removeTag', { name: tag.name })}
        >
          <Icon name="close" size={9} strokeWidth={2.2} />
        </button>
      )}
    </span>
  )
}

export function TagPicker({
  selected,
  onChange,
  allowCreate = true,
  counts,
}: {
  selected: string[]
  onChange: (ids: string[]) => void
  allowCreate?: boolean
  counts?: Record<string, number>
}) {
  const { tags, dimensions, addTag, notify, tagUsage } = useStore()
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDim, setNewDim] = useState(dimensions[0]?.id ?? 'custom')
  const [newColor, setNewColor] = useState(TAG_COLORS[0])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? tags.filter((t) => t.name.toLowerCase().includes(q)) : tags
  }, [tags, query])

  const byDimension = useMemo(() => {
    return dimensions
      .map((dim) => ({
        dim,
        tags: filtered
          .filter((t) => t.dimensionId === dim.id)
          .sort((a, b) => (tagUsage[b.id] ?? 0) - (tagUsage[a.id] ?? 0) || a.name.localeCompare(b.name)),
      }))
      .filter((g) => g.tags.length > 0 || (!query && g.dim.id === 'character'))
  }, [dimensions, filtered, query, tagUsage])

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((t) => t !== id) : [...selected, id])
  }

  const submitCreate = () => {
    const name = newName.trim()
    if (!name) return
    const exists = tags.find((t) => t.name === name && t.dimensionId === newDim)
    if (exists) {
      notify(t('shell.tagPicker.duplicate'), 'error')
      return
    }
    const tag = addTag(name, newDim, newColor)
    onChange([...selected, tag.id])
    setNewName('')
    setCreating(false)
    notify(t('shell.tagPicker.created', { name }), 'success')
  }

  return (
    <div className="tag-picker">
      <div className="row">
        <div className="top-search" style={{ maxWidth: 'none', flex: 1, marginLeft: 0 }}>
          <Icon name="search" size={14} />
          <input
            value={query}
            placeholder={t('shell.tagPicker.filterPlaceholder')}
            onChange={(e) => setQuery(e.target.value)}
            style={{ height: 32 }}
          />
        </div>
        {allowCreate && (
          <button className="btn btn-sm" onClick={() => setCreating((v) => !v)}>
            <Icon name="plus" size={13} />
            {t('shell.tagPicker.newTag')}
          </button>
        )}
      </div>

      {creating && (
        <div className="tag-create">
          <input
            className="input"
            placeholder={t('shell.tagPicker.tagName')}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitCreate()}
            autoFocus
          />
          <select className="select" value={newDim} onChange={(e) => setNewDim(e.target.value)}>
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
                className={`color-dot${newColor === c ? ' active' : ''}`}
                style={{ background: c }}
                onClick={() => setNewColor(c)}
                aria-label={t('shell.tagPicker.colorLabel', { color: c })}
              />
            ))}
          </div>
          <button className="btn btn-primary btn-sm" onClick={submitCreate}>
            {t('shell.tagPicker.createAndSelect')}
          </button>
        </div>
      )}

      <div className="tag-groups">
        {byDimension.map(({ dim, tags: dimTags }) => (
          <div key={dim.id} className="tag-group">
            <div className="tag-group-name">{dim.name}</div>
            <div className="row row-wrap" style={{ gap: 6 }}>
              {dimTags.map((tag) => {
                const active = selected.includes(tag.id)
                return (
                  <button
                    key={tag.id}
                    className={`chip${active ? ' active' : ''}`}
                    style={
                      active
                        ? { background: tag.color, borderColor: tag.color, color: readableInk(tag.color) }
                        : { borderColor: `color-mix(in srgb, ${tag.color} 32%, var(--line))` }
                    }
                    onClick={() => toggle(tag.id)}
                  >
                    <span className="color-dot" style={{ background: tag.color, width: 7, height: 7 }} />
                    {tag.name}
                    {counts && <span className="chip-count">{counts[tag.id] ?? 0}</span>}
                  </button>
                )
              })}
              {!dimTags.length && <span className="faint" style={{ fontSize: 11.5 }}>{t('shell.tagPicker.noTags')}</span>}
            </div>
          </div>
        ))}
        {!byDimension.length && (
          <div className="faint" style={{ fontSize: 12 }}>
            {t('shell.tagPicker.noMatch')}
          </div>
        )}
      </div>
    </div>
  )
}
