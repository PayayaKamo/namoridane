export type AppMode = 'public' | 'admin'

/** 构建期常量，Vite 会在 public 构建中折叠为 "public"，从而剔除管理端代码路径 */
export const APP_MODE: AppMode = __APP_MODE__
export const IS_PUBLIC = APP_MODE === 'public'
