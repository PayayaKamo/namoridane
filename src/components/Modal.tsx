import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'
import { useI18n } from '../i18n'

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  wide,
  bare,
}: {
  title?: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
  bare?: boolean
}) {
  const { t } = useI18n()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true">
        {!bare && (
          <div className="modal-head">
            <div>
              {title && <h3>{title}</h3>}
              {subtitle && <div className="page-sub">{subtitle}</div>}
            </div>
            <button className="icon-btn" onClick={onClose} aria-label={t('shell.modal.close')}>
              <Icon name="close" />
            </button>
          </div>
        )}
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

export function Toasts({
  toasts,
  onDismiss,
}: {
  toasts: { id: string; text: string; tone: string }[]
  onDismiss: (id: string) => void
}) {
  if (!toasts.length) return null
  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.tone}`} onClick={() => onDismiss(t.id)}>
          <Icon name={t.tone === 'error' ? 'info' : 'check'} size={16} />
          {t.text}
        </div>
      ))}
    </div>
  )
}

export function Empty({ icon = 'image', title, hint, action }: { icon?: string; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon name={icon} size={24} />
      </div>
      <div className="empty-title">{title}</div>
      {hint && <div style={{ maxWidth: 420 }}>{hint}</div>}
      {action}
    </div>
  )
}
