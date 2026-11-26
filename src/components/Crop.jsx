import { useEffect, useRef, useState } from 'react'
import { Panel, Pick, NeedImage, Result, Flash } from './ui.jsx'
import { cropImage, baseName, EXT } from '../lib/imgtools.js'

const ASPECTS = [['Free', 0], ['1:1', 1], ['4:3', 4 / 3], ['3:2', 3 / 2], ['16:9', 16 / 9], ['9:16', 9 / 16]]
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

export default function Crop({ items, sel, onSel }) {
  const img = useRef(null)
  const drag = useRef(null)
  const [rect, setRect] = useState(null)
  const [aspect, setAspect] = useState(0)
  const [fmt, setFmt] = useState('image/png')
  const [q, setQ] = useState(0.92)
  const [out, setOut] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => { setRect(null); setOut(null) }, [sel?.id])
  if (!sel) return <NeedImage />
  const m = sel.meta
  if (!m.width) return <Panel title="Crop"><Flash kind="danger">This browser could not read the size of this image.</Flash></Panel>

  const point = (e) => {
    const r = img.current.getBoundingClientRect()
    return { x: clamp(((e.clientX - r.left) * m.width) / r.width, 0, m.width), y: clamp(((e.clientY - r.top) * m.height) / r.height, 0, m.height) }
  }
  const down = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = point(e)
    setRect({ x: drag.current.x, y: drag.current.y, w: 0, h: 0 })
  }
  const move = (e) => {
    if (!drag.current) return
    const s = drag.current
    const p = point(e)
    let dx = p.x - s.x
    let dy = p.y - s.y
    if (aspect) {
      const a = Math.abs(dx) / aspect
      dy = Math.sign(dy || 1) * a
      const maxH = dy > 0 ? m.height - s.y : s.y
      if (Math.abs(dy) > maxH) { dy = Math.sign(dy) * maxH; dx = Math.sign(dx || 1) * Math.abs(dy) * aspect }
    }
    setRect({ x: Math.min(s.x, s.x + dx), y: Math.min(s.y, s.y + dy), w: Math.abs(dx), h: Math.abs(dy) })
  }
  const up = () => { drag.current = null }

  const num = (k, v) => setRect((r) => {
    const n = { ...(r || { x: 0, y: 0, w: m.width, h: m.height }), [k]: clamp(+v || 0, 0, k === 'x' || k === 'w' ? m.width : m.height) }
    n.w = Math.min(n.w, m.width - n.x)
    n.h = Math.min(n.h, m.height - n.y)
    return n
  })
  const valid = rect && rect.w >= 1 && rect.h >= 1

  async function crop() {
    setErr('')
    try {
      const r = { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.w), h: Math.round(rect.h) }
      setOut({ blob: await cropImage(sel.file, r, fmt, q), name: `${baseName(m.name)}-crop-${r.w}x${r.h}.${EXT[fmt]}`, before: sel.file.size })
    } catch (e) { setErr(e.message) }
  }

  const centerCrop = () => {
    if (!aspect) return setRect({ x: 0, y: 0, w: m.width, h: m.height })
    let w = m.width
    let h = w / aspect
    if (h > m.height) { h = m.height; w = h * aspect }
    setRect({ x: (m.width - w) / 2, y: (m.height - h) / 2, w, h })
  }

  return (
    <Panel title="Image Cropper" hint="Drag on the picture to select an area, or type exact numbers. The cropped copy has no metadata.">
      <Pick items={items} value={sel.id} onChange={onSel} />
      <div className="presets">
        {ASPECTS.map(([l, v]) => <button key={l} className={`chip ${aspect === v ? 'on' : ''}`} onClick={() => setAspect(v)}>{l}</button>)}
        <button className="chip" onClick={centerCrop}>Centre selection</button>
      </div>
      <div className="crop-stage checker" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <img ref={img} src={sel.url} alt="Image to crop" draggable="false" />
        {valid && <div className="crop-box" style={{ left: `${(rect.x / m.width) * 100}%`, top: `${(rect.y / m.height) * 100}%`, width: `${(rect.w / m.width) * 100}%`, height: `${(rect.h / m.height) * 100}%` }} />}
      </div>
      <div className="four">
        {['x', 'y', 'w', 'h'].map((k) => (
          <label className="field" key={k}>{{ x: 'Left', y: 'Top', w: 'Width', h: 'Height' }[k]} (px)
            <input type="number" min="0" value={rect ? Math.round(rect[k]) : ''} onChange={(e) => num(k, e.target.value)} />
          </label>
        ))}
      </div>
      <div className="two">
        <label className="field">Output format
          <select value={fmt} onChange={(e) => setFmt(e.target.value)}><option value="image/png">PNG</option><option value="image/jpeg">JPG</option><option value="image/webp">WebP</option></select>
        </label>
        {fmt !== 'image/png' && <label className="field">Quality: {Math.round(q * 100)}%<input type="range" min="0.4" max="1" step="0.01" value={q} onChange={(e) => setQ(+e.target.value)} /></label>}
      </div>
      {err && <Flash kind="danger">{err}</Flash>}
      <button className="btn primary" disabled={!valid} onClick={crop}>Crop image</button>
      {out && <div className="card"><Result blob={out.blob} name={out.name} beforeSize={out.before} /></div>}
    </Panel>
  )
}
