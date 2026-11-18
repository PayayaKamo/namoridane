import { defineConfig } from 'vitest/config'

export default defineConfig({
  // 测试统一按管理端语义运行，避免公开端把推测日期折叠成空值
  define: {
    __APP_MODE__: JSON.stringify('admin'),
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,mjs}'],
  },
})
