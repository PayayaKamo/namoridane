import type { CSSProperties } from 'react'

const PATHS: Record<string, JSX.Element> = {
  home: (
    <>
      <path d="M3.5 10.5 12 3.5l8.5 7" />
      <path d="M5.5 9.5V20h13V9.5" />
      <path d="M9.5 20v-5.5h5V20" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
      <circle cx="8.5" cy="13.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="13.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="17" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  gallery: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.6" />
    </>
  ),
  book: (
    <>
      <path d="M12 6.5c-1.8-1.6-4.2-2-7-2v13c2.8 0 5.2.4 7 2 1.8-1.6 4.2-2 7-2v-13c-2.8 0-5.2.4-7 2Z" />
      <path d="M12 6.5v13" />
    </>
  ),
  search: (
    <>
      <circle cx="10.8" cy="10.8" r="6.3" />
      <path d="m15.5 15.5 4 4" />
    </>
  ),
  tag: (
    <>
      <path d="M3.6 11.2V4.8c0-.7.5-1.2 1.2-1.2h6.4c.4 0 .7.1 1 .4l7.6 7.6c.5.5.5 1.3 0 1.8l-6 6c-.5.5-1.3.5-1.8 0L3.9 12.2a1.4 1.4 0 0 1-.3-1Z" />
      <circle cx="8" cy="8" r="1.2" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3.5 20c.4-3.3 2.6-5.2 5.5-5.2s5.1 1.9 5.5 5.2" />
      <path d="M15.5 5.6a3 3 0 0 1 0 5.8M17 14.9c2 .5 3.2 2.2 3.5 4.6" />
    </>
  ),
  folder: (
    <>
      <path d="M3.5 7.2c0-1 .8-1.7 1.7-1.7h3.3l2 2.2h8.3c1 0 1.7.8 1.7 1.7v8.4c0 1-.8 1.7-1.7 1.7H5.2c-1 0-1.7-.8-1.7-1.7V7.2Z" />
      <path d="M3.5 10.5h17" />
    </>
  ),
  sticker: (
    <>
      <path d="M4 6.2C4 5 5 4 6.2 4h11.6C19 4 20 5 20 6.2v7.3L14.5 20H6.2C5 20 4 19 4 17.8V6.2Z" />
      <path d="M14.5 20v-4.3c0-.8.7-1.5 1.5-1.5H20" />
      <circle cx="9" cy="9.5" r=".9" fill="currentColor" stroke="none" />
      <circle cx="15" cy="9.5" r=".9" fill="currentColor" stroke="none" />
      <path d="M9 13c.8.8 1.8 1.2 3 1.2s2.2-.4 3-1.2" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.5 12.2 2.3 2.3 4.7-4.9" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20h16" />
      <path d="M6.5 20v-5M11 20V8.5M15.5 20v-8M20 20V5" />
    </>
  ),
  database: (
    <>
      <ellipse cx="12" cy="6" rx="7.5" ry="2.8" />
      <path d="M4.5 6v12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8V6" />
      <path d="M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" />
    </>
  ),
  moon: <path d="M20 14.5A8.3 8.3 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />,
  left: <path d="m14.5 5.5-6 6.5 6 6.5" />,
  right: <path d="m9.5 5.5 6 6.5-6 6.5" />,
  up: <path d="m5.5 14.5 6.5-6 6.5 6" />,
  down: <path d="m5.5 9.5 6.5 6 6.5-6" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  heart: (
    <path d="M12 20s-7.6-4.6-7.6-9.4A4.2 4.2 0 0 1 12 7.7a4.2 4.2 0 0 1 7.6 2.9C19.6 15.4 12 20 12 20Z" />
  ),
  heartFill: (
    <path
      d="M12 20s-7.6-4.6-7.6-9.4A4.2 4.2 0 0 1 12 7.7a4.2 4.2 0 0 1 7.6 2.9C19.6 15.4 12 20 12 20Z"
      fill="currentColor"
    />
  ),
  trash: (
    <>
      <path d="M4.5 6.5h15M9 6.5V4.8c0-.7.6-1.3 1.3-1.3h3.4c.7 0 1.3.6 1.3 1.3v1.7" />
      <path d="M6.5 6.5 7.4 20h9.2l.9-13.5M10 10v6M14 10v6" />
    </>
  ),
  edit: (
    <>
      <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
      <path d="m14.5 5 3 3" />
    </>
  ),
  download: (
    <>
      <path d="M12 3.5v11M7.5 10.5 12 15l4.5-4.5" />
      <path d="M4 17v2.5h16V17" />
    </>
  ),
  upload: (
    <>
      <path d="M12 15V4M7.5 8 12 3.5 16.5 8" />
      <path d="M4 17v2.5h16V17" />
    </>
  ),
  filter: <path d="M3.5 5.5h17l-6.5 7.5v6l-4 2v-8L3.5 5.5Z" />,
  shuffle: (
    <>
      <path d="M4 7h3l9 10h4M4 17h3l9-10h4" />
      <path d="m17 4 3 3-3 3M17 14l3 3-3 3" />
    </>
  ),
  expand: <path d="M4 9V4h5M20 15v5h-5M20 9V4h-5M4 15v5h5" />,
  shrink: <path d="M9 4v5H4M15 20v-5h5M15 4v5h5M9 20v-5H4" />,
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5M12 7.8v.4" />
    </>
  ),
  grip: (
    <>
      <circle cx="9" cy="7" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="7" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="9" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="9" cy="17" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="17" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  grid: (
    <>
      <path d="M4 4h16v16H4z" />
      <path d="M4 9.3h16M4 14.6h16M9.3 4v16M14.6 4v16" />
    </>
  ),
  contrast: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5v17a8.5 8.5 0 0 0 0-17Z" fill="currentColor" stroke="none" />
    </>
  ),
  mirror: (
    <>
      <path d="M12 3.5v17" strokeDasharray="2 2.4" />
      <path d="M8.5 6.5 4 12l4.5 5.5v-11ZM15.5 6.5 20 12l-4.5 5.5v-11Z" />
    </>
  ),
  compare: (
    <>
      <rect x="3.5" y="5" width="7" height="14" rx="1.5" />
      <rect x="13.5" y="5" width="7" height="14" rx="1.5" />
    </>
  ),
  share: (
    <>
      <circle cx="6" cy="12" r="2.4" />
      <circle cx="17.5" cy="6" r="2.4" />
      <circle cx="17.5" cy="18" r="2.4" />
      <path d="m8.2 10.8 7.2-3.6M8.2 13.2l7.2 3.6" />
    </>
  ),
  dice: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <circle cx="8.5" cy="8.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="8.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="8.5" cy="15.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="15.5" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  palette: (
    <>
      <path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.4 0 2-.9 2-1.9 0-1.2-1-1.6-1-2.6 0-.8.7-1.5 1.6-1.5h1.6a4.3 4.3 0 0 0 4.3-4.3C20.5 6.4 16.7 3.5 12 3.5Z" />
      <circle cx="8" cy="9" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="7.2" r="1" fill="currentColor" stroke="none" />
      <circle cx="16" cy="9.4" r="1" fill="currentColor" stroke="none" />
      <circle cx="7" cy="13.4" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  spark: (
    <>
      <path d="M12 3.5 13.8 9l5.7 1.8-5.7 1.8L12 18.5l-1.8-5.9-5.7-1.8L10.2 9 12 3.5Z" />
      <path d="M18.5 17.5 19.3 20l2.2.8-2.2.8-.8 2.4" />
    </>
  ),
  eye: (
    <>
      <path d="M2.8 12S6.4 5.8 12 5.8 21.2 12 21.2 12 17.6 18.2 12 18.2 2.8 12 2.8 12Z" />
      <circle cx="12" cy="12" r="2.7" />
    </>
  ),
  checkSquare: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
      <path d="m8 12.2 2.6 2.6L16.3 9" />
    </>
  ),
  copy: (
    <>
      <rect x="8.5" y="8.5" width="12" height="12" rx="2" />
      <path d="M15.5 8.5v-2a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </>
  ),
  layers: (
    <>
      <path d="m12 3.5 9 4.7-9 4.7-9-4.7 9-4.7Z" />
      <path d="m3 12.5 9 4.7 9-4.7M3 16.8l9 4.7 9-4.7" />
    </>
  ),
}

export type IconName = keyof typeof PATHS

export function Icon({
  name,
  size = 18,
  className,
  style,
  strokeWidth = 1.6,
}: {
  name: IconName | string
  size?: number
  className?: string
  style?: CSSProperties
  strokeWidth?: number
}) {
  const content = PATHS[name] ?? PATHS.info
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {content}
    </svg>
  )
}
