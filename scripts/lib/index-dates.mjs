/**
 * 索引构建中与日期相关的纯函数。
 * 单独成模块，便于在 Vitest 中直接测试而不触发 sharp / 文件系统副作用。
 */

const NAME_RE = /^(\d{4})-(\d{2})-(\d{2})-([A-Za-z0-9_-]{11})(?:-(\d+))?\.jpe?g$/i
const UNKNOWN_RE = /^unknown-(.+)\.jpe?g$/i

/** 解析 `YYYY-MM-DD-<shortcode>[-序号].jpg`；不符合约定时返回 null */
export function parseName(fileName) {
  const m = NAME_RE.exec(fileName)
  if (m) {
    const [, y, mo, d, shortcode, idx] = m
    return {
      publishedAt: `${y}-${mo}-${d}`,
      year: Number(y),
      month: Number(mo),
      day: Number(d),
      shortcode,
      postIndex: idx === undefined ? 0 : Number(idx),
      dateKnown: true,
    }
  }
  // 拿不到发布日期的图片：文件名保留原始来源，日期留待人工审核
  const u = UNKNOWN_RE.exec(fileName)
  if (u) {
    return {
      publishedAt: '',
      year: 0,
      month: 0,
      day: 0,
      shortcode: `unknown-${u[1]}`,
      postIndex: 0,
      dateKnown: false,
    }
  }
  return null
}

/** 按 UTC 平移日期，避免本地时区与夏令时影响跨月/跨年结果 */
export function shiftDay({ year, month, day }, delta) {
  const t = new Date(Date.UTC(year, month - 1, day))
  t.setUTCDate(t.getUTCDate() + delta)
  return {
    year: t.getUTCFullYear(),
    month: t.getUTCMonth() + 1,
    day: t.getUTCDate(),
  }
}

/**
 * 日记日期的初始建议：OCR 候选优先，其次发布日期前一天；都没有时为 0。
 * rollover 表示相对发布日期发生的跨月 / 跨年，供审核界面提示。
 */
export function inferDiaryDate(parsed, ocrBest = null) {
  const inferred = ocrBest
    ? { year: ocrBest.year, month: ocrBest.month, day: ocrBest.day }
    : parsed.dateKnown
      ? shiftDay(parsed, -1)
      : { year: 0, month: 0, day: 0 }
  const rollover = parsed.dateKnown
    ? inferred.year !== parsed.year
      ? 'year'
      : inferred.month !== parsed.month
        ? 'month'
        : ''
    : ''
  return { inferred, rollover }
}
