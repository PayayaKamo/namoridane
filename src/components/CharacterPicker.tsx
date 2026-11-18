import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../state/store'
import { Icon } from './Icon'
import { CharacterAvatar } from './CharacterAvatar'
import { TAG_COLORS, sortCharacterTags } from '../lib/constants'
import { useI18n } from '../i18n'

/**
 * 出场人物选择器：复用 character 维度标签，点选即标记、再点取消。
 * 芯片与角色图鉴共用同一排序，已选角色只高亮、保持原位；
 * 输入框支持 ↑/↓ 选择、Enter 标记、Esc 关闭，输入的名字不存在时 Enter 直接新建角色。
 */
export function CharacterPicker({
  selected,
  onChange,
  onClose,
}: {
  selected: string[]
  onChange: (ids: string[]) => void
  onClose?: () => void
}) {
  const { tags, addCharacter, notify } = useStore()
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)

  // 与「角色图鉴」共用同一排序；搜索结果保持该相对顺序
  const characterTags = useMemo(
    () => sortCharacterTags(tags.filter((tag) => tag.dimensionId === 'character')),
    [tags],
  )

  const ordered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? characterTags.filter((tag) => tag.name.toLowerCase().includes(q)) : characterTags
  }, [characterTags, query])

  // 焦点指示只在键盘上下键导航时出现，进入页面或点击后不留下焦点环
  useEffect(() => setActive(-1), [query])

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((t) => t !== id) : [...selected, id])

  const create = () => {
    const name = query.trim()
    if (!name) return
    const exists = characterTags.find((tag) => tag.name === name)
    if (exists) {
      if (!selected.includes(exists.id)) toggle(exists.id)
      setQuery('')
      return
    }
    const tag = addCharacter(name, TAG_COLORS[characterTags.length % TAG_COLORS.length])
    onChange([...selected, tag.id])
    setQuery('')
    notify(t('shell.characterPicker.created', { name }), 'success')
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((index) => (ordered.length ? (index < 0 ? 0 : (index + 1) % ordered.length) : -1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((index) =>
        ordered.length ? (index < 0 ? ordered.length - 1 : (index - 1 + ordered.length) % ordered.length) : -1,
      )
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const target = active >= 0 ? ordered[active] : undefined
      if (target && !query.trim()) {
        toggle(target.id)
        setActive(-1)
      } else {
        create()
      }
    } else if (event.key === 'Escape') {
      event.preventDefault()
      onClose?.()
    }
  }

  const canCreate = Boolean(query.trim()) && !characterTags.some((tag) => tag.name === query.trim())

  return (
    <div className="character-picker">
      <div className="character-search">
        <Icon name="search" size={14} />
        <input
          ref={inputRef}
          value={query}
          placeholder={t('shell.characterPicker.placeholder')}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
        />
        {query.trim() && (
          <button className="btn btn-ghost btn-sm" onClick={create}>
            <Icon name={canCreate ? 'plus' : 'check'} size={12} />
            {canCreate ? t('shell.characterPicker.createAndSelect') : t('shell.characterPicker.select')}
          </button>
        )}
      </div>

      <div className="character-chips">
        {ordered.map((tag, index) => {
          const isSelected = selected.includes(tag.id)
          return (
            <button
              key={tag.id}
              className={`character-chip${isSelected ? ' active' : ''}${index === active ? ' focused' : ''}`}
              onClick={(event) => {
                // 鼠标点选后不保留 DOM 焦点，避免后续按键出现类似选中的焦点环
                event.currentTarget.blur()
                setActive(-1)
                toggle(tag.id)
              }}
              title={isSelected ? t('shell.characterPicker.unmark', { name: tag.name }) : t('shell.characterPicker.mark', { name: tag.name })}
            >
              <CharacterAvatar tagId={tag.id} />
              <span>{tag.name}</span>
              {isSelected && <Icon name="check" size={12} />}
            </button>
          )
        })}
        {!ordered.length && (
          <span className="faint" style={{ fontSize: 12 }}>
            {t('shell.characterPicker.noMatch')}
          </span>
        )}
      </div>
    </div>
  )
}
