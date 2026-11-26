import { useEffect, useState } from 'react'
import { fmtSize } from '../lib/bytes.js'
import { saveBlob } from '../lib/report.js'

export function useBlobUrl(blob) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (!blob) { setUrl(null); return undefined }
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url
}

export function Pick({ items, value, onChange, label = 'Image' }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value ?? ''} onChange={(e) => onChange(+e.target.value)}>
        {items.map((i) => <option key={i.id} value={i.id}>{i.meta.name}</option>)}
      </select>
    </label>
  )
}

export function Panel({ title, hint, children, actions }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>{title}</h2>
          {hint && <p className="hint">{hint}</p>}
        </div>
        {actions && <div className="row">{actions}</div>}
      </div>
      {children}
    </section>
  )
}

export const NeedImage = () => <p className="empty">Add an image on the Library page first. This tool works on the image you select.</p>

export function Flash({ kind = 'info', children }) {
  return <div className={`flash ${kind}`} role={kind === 'danger' ? 'alert' : 'status'}>{children}</div>
}

export function Redactions({ list }) {
  if (!list?.length) return <p className="meta">Nothing to remove. No metadata of the chosen kinds was found.</p>
  return (
    <ul className="redacted">
      {list.map((r, k) =>
        r.startsWith('(') ? <li key={k} className="note">{r.slice(1, -1)}</li> : <li key={k} tabIndex={0} aria-label={`Removed: ${r}`}>{r}</li>
      )}
    </ul>
  )
}

export function Result({ blob, name, beforeSize, note }) {
  const url = useBlobUrl(blob)
  const delta = beforeSize ? ((blob.size - beforeSize) / beforeSize) * 100 : null
  return (
    <div className="result">
      <div className="checker"><img src={url || undefined} alt="" /></div>
      <div className="grow">
        <p className="name">{name}</p>
        <p className="meta">
          {beforeSize ? `${fmtSize(beforeSize)} to ${fmtSize(blob.size)}` : fmtSize(blob.size)}
          {delta !== null && ` (${delta > 0 ? '+' : ''}${delta.toFixed(1)}%)`}
        </p>
        {note && <p className="meta">{note}</p>}
      </div>
      <button className="btn primary" onClick={() => saveBlob(blob, name)}>Download</button>
    </div>
  )
}

export function Table({ head, rows, empty = 'Nothing found.' }) {
  if (!rows.length) return <p className="meta">{empty}</p>
  return (
    <div className="table-wrap">
      <table>
        {head && <thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>}
        <tbody>{rows.map((r, i) => <tr key={i} className={r.cls}>{r.cells.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  )
}

export function Pills({ tabs, value, onChange }) {
  return (
    <div className="pills" role="tablist">
      {tabs.map(([id, label]) => (
        <button key={id} role="tab" aria-selected={value === id} className={value === id ? 'on' : ''} onClick={() => onChange(id)}>{label}</button>
      ))}
    </div>
  )
}

export function Check({ checked, onChange, children, disabled, hint }) {
  return (
    <label className={`check ${disabled ? 'dis' : ''}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span><b>{children}</b>{hint && <small>{hint}</small>}</span>
    </label>
  )
}

const ORI = { 1: 'Normal', 2: 'Mirrored', 3: 'Rotated 180', 4: 'Mirrored vertical', 5: 'Mirrored, 90 CCW', 6: 'Rotated 90 CW', 7: 'Mirrored, 90 CW', 8: 'Rotated 270 CW' }

export function fmtExif(k, v) {
  if (Array.isArray(v)) return v.map((x) => (typeof x === 'number' ? +x.toFixed(4) : x)).join(', ')
  if (typeof v !== 'number') return String(v)
  if (k === 'ExposureTime') return v >= 1 ? `${v} s` : `1/${Math.round(1 / v)} s`
  if (k === 'FNumber') return `f/${v.toFixed(1)}`
  if (k === 'FocalLength' || k === 'FocalLengthIn35mmFilm') return `${+v.toFixed(1)} mm`
  if (k === 'ExposureBias') return `${v > 0 ? '+' : ''}${+v.toFixed(2)} EV`
  if (k === 'Orientation') return ORI[v] || String(v)
  return String(+v.toFixed(4))
}

export const IMG_EXT = /\.(png|jpe?g|webp|gif|bmp|avif|tiff?|heic|heif|ico)$/i

export function uniqueNamer() {
  const used = new Set()
  return (name) => {
    let n = name
    let k = 1
    while (used.has(n)) n = name.replace(/(\.[^.]+)$/, `-${k++}$1`)
    used.add(n)
    return n
  }
}
