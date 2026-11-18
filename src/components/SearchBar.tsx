import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { SearchHit, SearchMatch } from '../lib/search'
import { buildSnippet, parseKeywords } from '../lib/search'
import { dayQueryOf, formatShortDate, parseDateQuery } from '../lib/dates'
import { navigate } from '../lib/router'
import { Icon } from './Icon'

const BASE = import.meta.env.BASE_URL

/** 结果摘要优先展示文案、人物、标签等有上下文的字段 */
const MATCH_PRIORITY: SearchMatch['kind'][] = [
  'caption',
  'note',
  'translation',
  'tag',
  'character',
  'study',
  'collection',
  'shortcode',
  'date',
  'file',
]

function bestMatch(hit: SearchHit): SearchMatch | undefined {
  let best: SearchMatch | undefined
  let bestRank = Number.MAX_SAFE_INTEGER
  for (const match of hit.matches) {
    const rank = MATCH_PRIORITY.indexOf(match.kind)
    if (rank >= 0 && rank < bestRank) {
      best = match
      bestRank = rank
    }
  }
  return best ?? hit.matches[0]
}

export function HighlightedText({ match, max = 96 }: { match: SearchMatch; max?: number }) {
  const snippet = useMemo(() => buildSnippet(match, max), [match, max])
  return (
    <span className="search-snippet-text">
      {snippet.prefix ? '…' : ''}
      {snippet.parts.map((part, index) =>
        part.hit ? (
          <mark key={index} className="search-mark">
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
      {snippet.suffix ? '…' : ''}
    </span>
  )
}

export function SearchHitRow({ hit, onOpen }: { hit: SearchHit; onOpen: (id: string) => void }) {
  const match = bestMatch(hit)
  return (
    <button type="button" className="search-hit" onClick={() => onOpen(hit.item.id)}>
      <span className="search-hit-thumb" style={{ background: hit.item.color }}>
        <img src={`${BASE}${hit.item.thumb}`} alt="" loading="lazy" decoding="async" />
      </span>
      <span className="search-hit-body">
        <span className="search-hit-meta">
          <span className="hand">{formatShortDate(hit.item.publishedAt)}</span>
          {hit.matches.slice(0, 3).map((item, index) => (
            <span key={`${item.kind}-${index}`} className="search-hit-field">
              {item.label}
            </span>
          ))}
        </span>
        {match && <HighlightedText match={match} max={110} />}
      </span>
      <Icon name="right" size={13} className="search-hit-arrow" />
    </button>
  )
}

interface SearchBarProps {
  query: string
  onChange: (value: string) => void
  hits: SearchHit[]
  total: number
  suggestions: string[]
  recent: string[]
  onPickSuggestion: (value: string) => void
  onClearRecent: () => void
  onPickItem: (id: string) => void
  onSubmit: (query: string) => void
  onViewAll: () => void
}

export function SearchBar({
  query,
  onChange,
  hits,
  total,
  suggestions,
  recent,
  onPickSuggestion,
  onClearRecent,
  onPickItem,
  onSubmit,
  onViewAll,
}: SearchBarProps) {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([])
  const dateQuery = parseDateQuery(query)
  const rows = [
    ...(dateQuery ? [{ type: 'date' as const, label: `${dateQuery.month} 月 ${dateQuery.day} 日` }] : []),
    ...hits.slice(0, 6).map((hit) => ({ type: 'hit' as const, hit })),
  ]
  const suggestionsOnly = query.trim().length > 0 && rows.length === 0 && suggestions.length > 0

  useEffect(() => {
    setActive(0)
  }, [query])

  useEffect(() => {
    if (active >= rows.length) setActive(Math.max(0, rows.length - 1))
  }, [active, rows.length])

  useEffect(() => {
    rowRefs.current[active]?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const goDate = () => {
    if (!dateQuery) return
    navigate(`/datefind?md=${dayQueryOf(dateQuery)}${dateQuery.year ? `&y=${dateQuery.year}` : ''}`)
  }

  const submit = () => {
    onSubmit(query)
    if (!rows.length) {
      if (dateQuery) goDate()
      return
    }
    const row = rows[Math.max(0, Math.min(active, rows.length - 1))]
    if (row.type === 'date') {
      goDate()
      return
    }
    onPickItem(row.hit.item.id)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!open) {
        setOpen(true)
        setActive(0)
        return
      }
      setActive((index) => Math.min(index + 1, Math.max(0, rows.length - 1)))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((index) => Math.max(0, index - 1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      submit()
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  const showPanel = open && (rows.length > 0 || suggestionsOnly)

  return (
    <div className="search-hero">
      <div className="search-box">
        <Icon name="search" size={18} />
        <input
          value={query}
          placeholder="搜索文案、短码、日期、标签、人物…"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showPanel && rows.length ? `${listId}-${active}` : undefined}
          onChange={(event) => {
            onChange(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={handleKeyDown}
        />
        {query ? (
          <button
            type="button"
            className="search-box-clear"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              onChange('')
              setOpen(true)
            }}
            aria-label="清空关键词"
          >
            <Icon name="close" size={14} />
          </button>
        ) : (
          <kbd>Enter</kbd>
        )}
      </div>

      {!query.trim() && recent.length > 0 && (
        <div className="search-recent">
          <span className="search-recent-label">最近搜索</span>
          {recent.map((value) => (
            <button
              key={value}
              type="button"
              className="search-recent-chip"
              onClick={() => {
                onChange(value)
                setOpen(true)
              }}
            >
              {value}
            </button>
          ))}
          <button type="button" className="search-recent-clear" onClick={onClearRecent}>
            清空
          </button>
        </div>
      )}

      {showPanel && (
        <div
          className="search-dropdown"
          id={listId}
          role="listbox"
          onMouseDown={(event) => event.preventDefault()}
        >
          {rows.map((row, index) => {
            const id = `${listId}-${index}`
            const isActive = index === active
            if (row.type === 'date') {
              return (
                <button
                  key="date"
                  id={id}
                  ref={(node) => {
                    rowRefs.current[index] = node
                  }}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  className={`search-dropdown-row search-dropdown-date${isActive ? ' active' : ''}`}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => {
                    onSubmit(query)
                    goDate()
                  }}
                >
                  <span className="search-dropdown-icon">
                    <Icon name="calendar" size={15} />
                  </span>
                  <span>按日期查看 {row.label}</span>
                  <kbd>Enter</kbd>
                </button>
              )
            }
            const match = bestMatch(row.hit)
            return (
              <button
                key={row.hit.item.id}
                id={id}
                ref={(node) => {
                  rowRefs.current[index] = node
                }}
                type="button"
                role="option"
                aria-selected={isActive}
                className={`search-dropdown-row${isActive ? ' active' : ''}`}
                onMouseEnter={() => setActive(index)}
                onClick={() => {
                  onSubmit(query)
                  onPickItem(row.hit.item.id)
                }}
              >
                <span className="search-dropdown-thumb" style={{ background: row.hit.item.color }}>
                  <img src={`${BASE}${row.hit.item.thumb}`} alt="" loading="lazy" decoding="async" />
                </span>
                <span className="search-dropdown-main">
                  <span className="search-dropdown-meta">
                    <span className="hand">{formatShortDate(row.hit.item.publishedAt)}</span>
                    {row.hit.matches.slice(0, 2).map((item, matchIndex) => (
                      <span key={`${item.kind}-${matchIndex}`} className="search-hit-field">
                        {item.label}
                      </span>
                    ))}
                  </span>
                  {match && <HighlightedText match={match} max={72} />}
                </span>
              </button>
            )
          })}

          {suggestionsOnly && (
            <div className="search-dropdown-suggest">
              <div className="search-dropdown-suggest-title">
                没有找到「{parseKeywords(query).join(' ')}」{suggestions.length ? '，试试：' : ''}
              </div>
              <div className="row row-wrap" style={{ gap: 6 }}>
                {suggestions.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className="chip chip-tiny"
                    onClick={() => {
                      onPickSuggestion(value)
                      setOpen(true)
                    }}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
          )}

          {total > 0 && (
            <button
              type="button"
              className="search-dropdown-all"
              onClick={() => {
                onSubmit(query)
                onViewAll()
              }}
            >
              查看全部 <b>{total}</b> 条结果
              <Icon name="right" size={12} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
