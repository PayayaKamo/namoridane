import { useRef, useState } from 'react'
import { useStore } from '../state/store'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { downloadJson } from '../lib/storage'
import { relativeTime } from '../lib/dates'

export function DataView() {
  const { data, items, tags, collections, annotations, importData, loadSeed, resetData, notify, theme, toggleTheme } = useStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<'merge' | 'replace'>('merge')
  const [confirmReset, setConfirmReset] = useState(false)
  const [importing, setImporting] = useState(false)

  const sizeKb = Math.round(new Blob([JSON.stringify(data)]).size / 1024)
  const annotated = Object.keys(annotations).length

  const handleFile = async (file: File) => {
    setImporting(true)
    try {
      const text = await file.text()
      const json = JSON.parse(text)
      importData(json, mode)
      notify(mode === 'merge' ? '已合并导入的标注' : '已替换为导入的标注', 'success')
    } catch (err) {
      console.error(err)
      notify('导入失败：不是有效的 JSON', 'error')
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const exportAll = () => {
    const filename = `namori-diary-${new Date().toISOString().slice(0, 10)}.json`
    downloadJson(data, filename)
    notify('导出成功', 'success')
  }

  return (
    <div className="data-view">
      <div className="page-head">
        <div>
          <div className="page-eyebrow">Data & Settings</div>
          <h2 className="page-title">数据与设置</h2>
          <div className="page-sub">所有标签、收藏、备注、日期校对、拆解笔记、裁切参数都保存在浏览器本地</div>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={toggleTheme}>
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={14} />
            {theme === 'dark' ? '切换亮色' : '切换暗色'}
          </button>
        </div>
      </div>

      <div className="data-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>当前数据</h3>
            <span className="faint">更新于 {relativeTime(data.updatedAt)}</span>
          </div>
          <div className="meta-list">
            <div className="meta-row"><span>作品总数</span><span className="num">{items.length}</span></div>
            <div className="meta-row"><span>已标注作品</span><span className="num">{annotated}</span></div>
            <div className="meta-row"><span>标签 / 维度</span><span className="num">{tags.length} / {data.dimensions.length}</span></div>
            <div className="meta-row"><span>合集</span><span className="num">{collections.length}</span></div>
            <div className="meta-row"><span>本地存储占用</span><span className="num">{sizeKb} KB</span></div>
          </div>
          <div className="row" style={{ gap: 8, marginTop: 16 }}>
            <button className="btn btn-primary" onClick={exportAll}>
              <Icon name="download" size={14} />
              导出全部 JSON
            </button>
            <button className="btn" onClick={() => fileRef.current?.click()} disabled={importing}>
              <Icon name="upload" size={14} />
              {importing ? '导入中…' : '导入 JSON'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFile(file)
              }}
            />
          </div>
          <div className="row" style={{ gap: 8, marginTop: 12 }}>
            <span className="field-label" style={{ margin: 0 }}>导入方式</span>
            <div className="segmented">
              <button className={mode === 'merge' ? 'active' : ''} onClick={() => setMode('merge')}>
                合并
              </button>
              <button className={mode === 'replace' ? 'active' : ''} onClick={() => setMode('replace')}>
                覆盖
              </button>
            </div>
            <span className="faint" style={{ fontSize: 11.5 }}>
              合并会保留现有标签与合集；覆盖会完全使用文件内的数据。
            </span>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>发布整理成果</h3>
          </div>
          <p className="muted" style={{ fontSize: 12.5 }}>
            把导出的 JSON 改名为 <code>data/userdata.json</code> 放到仓库里，下次构建会自动复制为种子数据
            （<code>public/data/userdata.seed.json</code>）。第一次打开站点的访客会自动载入这份标注，
            之后自己的修改仍只存在本地。
          </p>
          <div className="row" style={{ gap: 8, marginTop: 12 }}>
            <button className="btn" onClick={loadSeed}>
              <Icon name="database" size={14} />
              合并仓库种子标注
            </button>
          </div>
          <div className="divider" />
          <div className="panel-head">
            <h3>危险操作</h3>
          </div>
          <button className="btn btn-danger" onClick={() => setConfirmReset(true)}>
            <Icon name="trash" size={14} />
            清空本地标注
          </button>
          <p className="faint" style={{ fontSize: 11.5, marginTop: 8 }}>
            清空后标签、合集、笔记、裁切参数都会消失，图片索引不受影响。建议先导出备份。
          </p>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h3>数据结构速查</h3>
          <span className="faint">v{data.version}</span>
        </div>
        <pre className="schema-pre">{`{
  version: 2,
  dimensions: [{ id, name, order, builtIn }],
  tags:       [{ id, name, dimensionId, color, createdAt }],
  collections:[{ id, name, description, coverItemId, itemIds[], createdAt, updatedAt }],
  items: {
    [itemId]: {
      tags: string[],
      favorite: boolean,
      note: string,
      date?:     { year, month, day, confirmed, source },
      study?:    { composition, palette, linework, expression, memo },
      crop?:     { cx, cy, size, tolerance, transparent },
      updatedAt: string
    }
  }
}`}</pre>
        <p className="faint" style={{ fontSize: 11.5 }}>
          数据全部通过 localStorage（键名 <code>namori.diary.userdata.v2</code>）持久化，不使用任何后端或账号。
        </p>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h3>快捷键</h3>
        </div>
        <div className="shortcut-list">
          {[
            ['← / →', '详情与翻阅中切换作品'],
            ['Esc', '关闭详情'],
            ['/', '聚焦顶部搜索'],
            ['R', '随机抽一张'],
            ['F', '收藏当前作品'],
            ['1 / 2 / 3', '详情切换到信息 / 拆解 / 表情包'],
            ['?', '快捷键面板'],
          ].map(([key, desc]) => (
            <div key={key} className="shortcut-row">
              <kbd>{key}</kbd>
              <span>{desc}</span>
            </div>
          ))}
        </div>
      </section>

      {confirmReset && (
        <Modal
          title="清空本地标注"
          onClose={() => setConfirmReset(false)}
          footer={
            <>
              <button className="btn" onClick={() => setConfirmReset(false)}>
                取消
              </button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  resetData()
                  setConfirmReset(false)
                }}
              >
                确认清空
              </button>
            </>
          }
        >
          <p>此操作不可撤销，除非你事先导出了 JSON。确定继续吗？</p>
        </Modal>
      )}
    </div>
  )
}
