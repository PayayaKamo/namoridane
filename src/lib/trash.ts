import { IS_PUBLIC } from './appMode'

/** 本地管理端接口：只在 `npm run dev`（admin 模式）下由 Vite 中间件提供，公开构建里不存在。 */
async function post(path: string, body: unknown): Promise<Record<string, unknown> | null> {
  if (IS_PUBLIC) return null
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) return null
    return (await res.json()) as Record<string, unknown>
  } catch {
    return null
  }
}

/** 把原图移进 images/_trash；返回是否成功 */
export async function moveFilesToTrash(files: string[]): Promise<boolean> {
  const result = await post('/__admin/trash', { files })
  return Boolean(result?.ok)
}

export async function restoreFilesFromTrash(files: string[]): Promise<boolean> {
  const result = await post('/__admin/restore', { files })
  return Boolean(result?.ok)
}

/** 彻底删除 images/_trash 里的文件；返回删除数量，接口不可用时为 null */
export async function purgeTrashFiles(): Promise<number | null> {
  const result = await post('/__admin/purge', {})
  return typeof result?.removed === 'number' ? result.removed : null
}
