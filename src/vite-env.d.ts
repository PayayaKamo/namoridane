/// <reference types="vite/client" />

/** 由 vite.config.ts 在构建时注入：'admin' | 'public' */
declare const __APP_MODE__: 'admin' | 'public'
/** package.json 中的版本号 */
declare const __APP_VERSION__: string
/** 构建时刻的 ISO 时间字符串 */
declare const __BUILD_TIME__: string
