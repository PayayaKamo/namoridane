/** 颜色工具：色板相似度、对比色、hex 转换 */

export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean
  const n = parseInt(full, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function rgbToHex(r: number, g: number, b: number): string {
  const to = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`
}

function srgbToLinear(v: number): number {
  const c = v / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/** RGB -> CIELAB，用于感知色差 */
export function hexToLab(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex)
  const lr = srgbToLinear(r)
  const lg = srgbToLinear(g)
  const lb = srgbToLinear(b)

  const x = (lr * 0.4124 + lg * 0.3576 + lb * 0.1805) / 0.95047
  const y = lr * 0.2126 + lg * 0.7152 + lb * 0.0722
  const z = (lr * 0.0193 + lg * 0.1192 + lb * 0.9505) / 1.08883

  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  const fx = f(x)
  const fy = f(y)
  const fz = f(z)
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

/** 两个色板的平均最小 Lab 距离（0 = 完全一致） */
export function paletteDistance(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 100
  const labA = a.map(hexToLab)
  const labB = b.map(hexToLab)
  let total = 0
  for (const [l1, a1, b1] of labA) {
    let best = Infinity
    for (const [l2, a2, b2] of labB) {
      const d = Math.sqrt((l1 - l2) ** 2 + (a1 - a2) ** 2 + (b1 - b2) ** 2)
      if (d < best) best = d
    }
    total += best
  }
  return total / labA.length
}

/** 色板相似度 0~1 */
export function paletteSimilarity(a: string[], b: string[]): number {
  const d = paletteDistance(a, b)
  return Math.max(0, 1 - d / 70)
}

export function readableInk(hex: string): string {
  const [r, g, b] = hexToRgb(hex)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.62 ? '#2a2723' : '#fffaf0'
}

export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
