import { useStore } from '../state/store'
import { useI18n } from '../i18n'
import { navigate } from '../lib/router'
import { Icon } from './Icon'

/**
 * 本地标注写入异常时的常驻提示：
 * - 配额不足 / 存储不可用：明确告知「本次修改未保存」，并提供导出 JSON 与重试
 * - 缓存损坏：告知未加载，并提供损坏副本下载与数据页入口
 */
export function StorageBanner() {
  const { storageIssue, retryStorageSave, exportLocalData, exportCorruptBackup } = useStore()
  const { t } = useI18n()

  if (!storageIssue) return null

  const copy = {
    quota: { title: t('shell.storage.quotaTitle'), hint: t('shell.storage.quotaHint') },
    corrupt: { title: t('shell.storage.corruptTitle'), hint: t('shell.storage.corruptHint') },
    unavailable: {
      title: t('shell.storage.unavailableTitle'),
      hint: t('shell.storage.unavailableHint'),
    },
  }[storageIssue]

  const corrupt = storageIssue === 'corrupt'

  return (
    <div className="storage-banner" role="alert" aria-live="assertive">
      <Icon name="info" size={16} />
      <div className="storage-banner-text">
        <strong>{copy.title}</strong>
        <span>{copy.hint}</span>
      </div>
      <div className="storage-banner-actions">
        {corrupt ? (
          <>
            <button className="btn btn-sm" onClick={exportCorruptBackup}>
              <Icon name="download" size={14} />
              {t('shell.storage.exportCorrupt')}
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => navigate('/data')}>
              {t('shell.storage.goData')}
            </button>
          </>
        ) : (
          <>
            <button className="btn btn-sm btn-primary" onClick={exportLocalData}>
              <Icon name="download" size={14} />
              {t('shell.storage.exportData')}
            </button>
            <button className="btn btn-sm" onClick={retryStorageSave}>
              {t('shell.storage.retry')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
