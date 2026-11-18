import { Component, Fragment, useEffect, useState, type ErrorInfo, type ReactNode } from 'react'
import { useI18n } from '../i18n'
import { navigate } from '../lib/router'
import { Icon } from './Icon'

/** 单个页面渲染失败时的降级界面：保留站内导航，可重试或返回首页 */
function RenderErrorFallback({ onRetry }: { onRetry: () => void }) {
  const { t } = useI18n()
  return (
    <div className="render-error" role="alert">
      <div className="empty-title">{t('shell.error.boundaryTitle')}</div>
      <p className="muted">{t('shell.error.boundaryHint')}</p>
      <div className="render-error-actions">
        <button className="btn btn-primary" onClick={onRetry}>
          {t('shell.error.retry')}
        </button>
        <button className="btn btn-ghost" onClick={() => navigate('/')}>
          {t('shell.error.goHome')}
        </button>
      </div>
    </div>
  )
}

/**
 * 页面级错误边界：只把当前路由出口降级，避免整站白屏。
 * 重试通过递增 attempt 重新挂载子树；路由变化时由外部 key 重置。
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean; attempt: number }> {
  state = { failed: false, attempt: 0 }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[namori] view render failed', error, info.componentStack)
  }

  private retry = () => {
    this.setState((prev) => ({ failed: false, attempt: prev.attempt + 1 }))
  }

  render() {
    if (this.state.failed) return <RenderErrorFallback onRetry={this.retry} />
    return <Fragment key={this.state.attempt}>{this.props.children}</Fragment>
  }
}

function describeReason(reason: unknown): string {
  if (reason instanceof Error) return reason.message
  if (typeof reason === 'string') return reason
  try {
    return JSON.stringify(reason)
  } catch {
    return ''
  }
}

/** 全局兜底：未处理的 Promise 拒绝用提示条告知，不再静默失败 */
export function UnhandledRejectionBanner() {
  const { t } = useI18n()
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const onRejection = (event: PromiseRejectionEvent) => {
      setMessage(describeReason(event.reason) || t('shell.error.unknown'))
    }
    window.addEventListener('unhandledrejection', onRejection)
    return () => window.removeEventListener('unhandledrejection', onRejection)
  }, [t])

  if (!message) return null

  return (
    <div className="global-error-banner" role="alert">
      <Icon name="info" size={14} />
      <span className="global-error-text">{t('shell.error.unhandled', { message })}</span>
      <button className="icon-btn" onClick={() => setMessage(null)} aria-label={t('shell.error.dismiss')}>
        <Icon name="close" size={14} />
      </button>
    </div>
  )
}
