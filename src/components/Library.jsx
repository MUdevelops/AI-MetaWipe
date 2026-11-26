import { useRef, useState } from 'react'
import { fmtSize } from '../lib/bytes.js'
import { Panel } from './ui.jsx'

export default function Library({ items, sel, onSelect, onAdd, onRemove, onClear, setTab, loading = 0 }) {
  const [over, setOver] = useState(false)
  const files = useRef(null)
  const dir = useRef(null)
  return (
    <>
      <div
        className={`drop ${over ? 'over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); onAdd(e.dataTransfer.files) }}
      >
        <p className="drop-title">Drop images here</p>
        <p className="drop-sub">PNG, JPG, JPEG, WebP, GIF, BMP, AVIF and more. No limit on how many. Nothing is uploaded.</p>
        <div className="row center">
          <button className="btn primary" onClick={() => files.current.click()}>Choose images</button>
          <button className="btn" onClick={() => { dir.current.setAttribute('webkitdirectory', ''); dir.current.click() }}>Choose a folder</button>
        </div>
        <input ref={files} type="file" accept="image/*" multiple hidden onChange={(e) => { onAdd(e.target.files); e.target.value = '' }} />
        <input ref={dir} type="file" multiple hidden onChange={(e) => { onAdd(e.target.files); e.target.value = '' }} />
      </div>

      <Panel
        title={items.length ? `Library (${items.length})` : 'Library'}
        hint="Pick an image here, then open any tool from the menu. Every tool works on the selected image."
        actions={items.length > 0 && <button className="btn" onClick={onClear}>Clear all</button>}
      >
        {loading > 0 && <p className="meta" role="status"><span className="spin" /> Reading {loading} file{loading > 1 ? 's' : ''}…</p>}
        {!items.length && <p className="empty">No images yet. Each one is read the moment it loads.</p>}
        <ul className="lib">
          {items.map((it) => (
            <li key={it.id} className={`lib-item ${sel?.id === it.id ? 'sel' : ''}`}>
              <button className="lib-main" onClick={() => onSelect(it.id)} aria-pressed={sel?.id === it.id}>
                <span className="checker thumb"><img src={it.url} alt="" loading="lazy" decoding="async" onError={(e) => { e.currentTarget.style.display = 'none' }} /></span>
                <span className="grow">
                  <b className="name">{it.meta.name}</b>
                  <span className="meta">{it.meta.format} · {it.meta.width ? `${it.meta.width} x ${it.meta.height}` : 'size unknown'} · {fmtSize(it.meta.size)}</span>
                  <span className="tags">
                    <i className={`tag s-${it.score >= 90 ? 'good' : it.score >= 45 ? 'mid' : 'bad'}`}>Privacy {it.score}</i>
                    {(it.meta.gps || it.meta.hasGpsTags) && <i className="tag s-bad">GPS</i>}
                    {it.meta.exif && <i className="tag">EXIF</i>}
                    {it.meta.xmp && <i className="tag">XMP</i>}
                    {it.meta.iptc && <i className="tag">IPTC</i>}
                    {it.meta.pngText.length > 0 && <i className="tag">PNG text</i>}
                    {it.meta.c2pa && <i className="tag">C2PA</i>}
                    {it.meta.ai.length > 0 && <i className="tag s-ai">AI hints</i>}
                  </span>
                </span>
              </button>
              <button className="btn small" onClick={() => onRemove([it.id])} aria-label={`Remove ${it.meta.name} from the list`}>Remove</button>
            </li>
          ))}
        </ul>
        {items.length > 0 && (
          <div className="row">
            <button className="btn primary" onClick={() => setTab('viewer')}>View metadata</button>
            <button className="btn" onClick={() => setTab('remove')}>Clean images</button>
            <button className="btn" onClick={() => setTab('privacy')}>Privacy check</button>
          </div>
        )}
      </Panel>
    </>
  )
}
