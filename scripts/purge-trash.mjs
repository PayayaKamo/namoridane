/**
 * 彻底清空本地回收站 images/_trash。
 *
 * 用法：
 *   npm run purge
 *
 * 说明：
 * - 管理端的「执行清理」走 dev server 的本地接口；这个脚本是等价的命令行入口，
 *   适合不方便开 dev server 时使用。
 * - 只删除 images/_trash 下的文件，不会触碰 images/original 或 public/images。
 * - 清理后重新运行 `npm run data` 可以同步索引（已删除图片不会再次进入索引）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TRASH_DIR = path.join(ROOT, 'images', '_trash')

if (!fs.existsSync(TRASH_DIR)) {
  console.log('[purge] images/_trash 不存在，无需清理')
  process.exit(0)
}

let removed = 0
for (const name of fs.readdirSync(TRASH_DIR)) {
  const target = path.join(TRASH_DIR, name)
  if (!fs.statSync(target).isFile()) continue
  fs.unlinkSync(target)
  removed += 1
}

console.log(`[purge] 已彻底删除 ${removed} 个回收站文件`)
console.log('[purge] 如需同步索引与衍生图，请运行 npm run data（或 npm run build:public）')
