import { useMemo } from 'react'
import { useStore } from '../state/store'
import { Icon } from '../components/Icon'
import { Empty } from '../components/Modal'
import { effectiveDate } from '../lib/dates'
import { navigate } from '../lib/router'

const BASE = import.meta.env.BASE_URL

export function CharactersView() {
  const { tags, dimensions, annotations, items, getDate } = useStore()
  const characterDim = dimensions.find((d) => d.id === 'character')
  const charTags = useMemo(
    () => tags.filter((t) => t.dimensionId === (characterDim?.id ?? 'character')),
    [tags, characterDim],
  )

  const data = useMemo(() => {
    return charTags
      .map((tag) => {
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
          count: members.length,
          cover,
          first: sorted[sorted.length - 1],
          latest: cover,
          scenes: [...scenes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3),
        }
      })
      .sort((a, b) => b.count - a.count)
  }, [charTags, items, annotations, tags, getDate])

  const totalTagged = data.reduce((sum, d) => sum + d.count, 0)

  return (
    <div className="characters-view">
      <div className="page-head">
        <div>
          <div className="page-eyebrow">Character Codex</div>
          <h2 className="page-title">角色图鉴</h2>
          <div className="page-sub">
            {data.length} 个角色标签 · 累计 {totalTagged} 次出场 · 来自「{characterDim?.name ?? '人物 / 角色'}」维度
          </div>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => navigate('/tags')}>
            <Icon name="tag" size={14} />
            管理人物标签
          </button>
        </div>
      </div>

      {data.length ? (
        <div className="character-grid">
          {data.map(({ tag, count, cover, first, latest, scenes }) => (
            <button
              key={tag.id}
              className="character-card"
              onClick={() => navigate(`/gallery?tag=${tag.id}`)}
            >
              <div className="character-cover" style={{ background: tag.color }}>
                {cover ? (
                  <img src={`${BASE}${cover.thumb}`} alt={tag.name} loading="lazy" />
                ) : (
                  <span className="character-placeholder">
                    <Icon name="users" size={28} />
                  </span>
                )}
                <span className="character-count num">{count} 张</span>
              </div>
              <div className="character-body">
                <div className="character-name">
                  <span className="color-dot" style={{ background: tag.color }} />
                  {tag.name}
                </div>
                <div className="faint character-meta">
                  {first && latest ? (
                    <>
                      首次 {effectiveDate(first, annotations[first.id]).year} · 最近{' '}
                      {effectiveDate(latest, annotations[latest.id]).year}
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
            </button>
          ))}
        </div>
      ) : (
        <Empty
          icon="users"
          title="还没有人物/角色标签"
          hint="到标签页在「人物 / 角色」维度下新建角色名，比如「小狐狸」「白猫」，再给作品打上标签，这里会自动聚合成图鉴。"
          action={
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/tags')}>
              去创建角色标签
            </button>
          }
        />
      )}
    </div>
  )
}
