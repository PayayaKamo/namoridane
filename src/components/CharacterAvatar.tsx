import { useStore } from '../state/store'

/**
 * 角色缩略图：全站统一使用图鉴封面（coverItemId + coverCrop）与原图一致的对象位置与缩放。
 * 没有设置封面时只显示颜色底色与首字，不回落到预置头像、上传头像或作品首图。
 */
export function CharacterAvatar({ tagId, className = 'character-avatar' }: { tagId: string; className?: string }) {
  const { tagMap, characterCovers } = useStore()
  const tag = tagMap.get(tagId)
  const cover = characterCovers.get(tagId)
  return (
    <span className={className} style={{ background: tag?.color }}>
      {cover ? (
        <img
          src={cover.src}
          alt=""
          loading="lazy"
          style={{
            objectPosition: cover.objectPosition,
            transformOrigin: cover.transformOrigin,
            transform: cover.transform,
          }}
        />
      ) : (
        (tag?.name ?? '?').slice(0, 1)
      )}
    </span>
  )
}
