import { useState } from 'react'
import { Panel, Pick, NeedImage, Pills, Result, Flash, uniqueNamer } from './ui.jsx'
import { compressPng, convertImage, resizeImage, baseName, EXT } from '../lib/imgtools.js'
import { makeZip } from '../lib/zip.js'
import { saveBlob } from '../lib/report.js'
import { useToast } from './Toast.jsx'

const LEVELS = [[256, 'Lossless re-encode'], [128, 'High quality (128 colour levels)'], [64, 'Balanced (64 levels)'], [32, 'Small (32 levels)'], [16, 'Tiny (16 levels)']]
const FORMATS = [['image/png', 'PNG'], ['image/jpeg', 'JPG'], ['image/webp', 'WebP']]

export default function Optimize({ items, sel, onSel }) {
  const [mode, setMode] = useState('compress')
  const [levels, setLevels] = useState(256)
  const [fmt, setFmt] = useState('image/webp')
  const [q, setQ] = useState(0.9)
  const [w, setW] = useState('')
  const [h, setH] = useState('')
  const [lock, setLock] = useState(true)
  const [out, setOut] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const toast = useToast()
  if (!sel) return <NeedImage />
  const m = sel.meta

  const width = w === '' ? m.width : +w
  const height = h === '' ? m.height : +h
  const ratio = m.width / m.height

  async function one(it, uniq) {
    const b = baseName(it.meta.name)
    if (mode === 'compress') return { blob: await compressPng(it.file, levels), name: uniq(`${b}-compressed.png`) }
    if (mode === 'convert') return { blob: await convertImage(it.file, fmt, q), name: uniq(`${b}.${EXT[fmt]}`) }
    const mime = fmt
    return { blob: await resizeImage(it.file, width, height, mime, q), name: uniq(`${b}-${width}x${height}.${EXT[mime]}`) }
  }

  async function run(all) {
    setBusy(true); setErr(''); setOut(null)
    try {
      const uniq = uniqueNamer()
      const targets = all ? items : [sel]
      const res = []
      for (const it of targets) res.push({ ...(await one(it, uniq)), before: it.file.size })
      setOut(res)
      toast(`Finished ${res.length} image${res.length > 1 ? 's' : ''}.`)
    } catch (e) {
      setErr(e.message)
      toast(e.message, 'danger')
    }
    setBusy(false)
  }

  const setSize = (which, v) => {
    if (which === 'w') { setW(v); if (lock && v !== '') setH(String(Math.round(+v / ratio))) }
    else { setH(v); if (lock && v !== '') setW(String(Math.round(+v * ratio))) }
  }

  return (
    <Panel title="PNG Compressor, Converter and Resizer" hint="Image tools that run on your device. Output files carry no metadata.">
      <Pills value={mode} onChange={(v) => { setMode(v); setOut(null) }} tabs={[['compress', 'PNG compressor'], ['convert', 'Convert format'], ['resize', 'Resize']]} />
      <Pick items={items} value={sel.id} onChange={onSel} />
      <p className="meta">{m.format} · {m.width} x {m.height} · {(m.size / 1024).toFixed(1)} KB</p>

      {mode === 'compress' && (
        <>
          <label className="field">Compression level
            <select value={levels} onChange={(e) => setLevels(+e.target.value)}>{LEVELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </label>
          <p className="meta">Lossless keeps every pixel exactly, but the gain can be small. Lower levels reduce the number of colours, which shrinks the file more and can show banding in gradients.</p>
        </>
      )}

      {(mode === 'convert' || mode === 'resize') && (
        <div className="two">
          <label className="field">Output format
            <select value={fmt} onChange={(e) => setFmt(e.target.value)}>{FORMATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </label>
          {fmt !== 'image/png' && (
            <label className="field">Quality: {Math.round(q * 100)}%
              <input type="range" min="0.4" max="1" step="0.01" value={q} onChange={(e) => setQ(+e.target.value)} />
            </label>
          )}
        </div>
      )}
      {mode === 'convert' && (
        <div className="presets">
          <button className="chip" onClick={() => setFmt('image/jpeg')}>PNG to JPG</button>
          <button className="chip" onClick={() => setFmt('image/png')}>JPG to PNG</button>
          <button className="chip" onClick={() => setFmt('image/webp')}>To WebP</button>
        </div>
      )}
      {mode === 'convert' && fmt === 'image/jpeg' && <p className="meta">JPG has no transparency. Transparent areas become white.</p>}

      {mode === 'resize' && (
        <>
          <div className="two">
            <label className="field">Width (px)<input type="number" min="1" value={w === '' ? m.width : w} onChange={(e) => setSize('w', e.target.value)} /></label>
            <label className="field">Height (px)<input type="number" min="1" value={h === '' ? m.height : h} onChange={(e) => setSize('h', e.target.value)} /></label>
          </div>
          <label className="check"><input type="checkbox" checked={lock} onChange={(e) => setLock(e.target.checked)} /><span><b>Keep aspect ratio</b></span></label>
          <div className="presets">
            {[25, 50, 75, 150, 200].map((p) => <button key={p} className="chip" onClick={() => { setW(String(Math.round((m.width * p) / 100))); setH(String(Math.round((m.height * p) / 100))) }}>{p}%</button>)}
            <button className="chip" onClick={() => { setW(''); setH('') }}>Reset</button>
          </div>
        </>
      )}

      {err && <Flash kind="danger">{err}</Flash>}
      <div className="row">
        <button className="btn primary" disabled={busy} onClick={() => run(false)}>{busy ? 'Working…' : 'Run on selected image'}</button>
        {mode !== 'resize' && items.length > 1 && <button className="btn" disabled={busy} onClick={() => run(true)}>Run on all {items.length} images</button>}
        {out?.length > 1 && <button className="btn" onClick={async () => saveBlob(await makeZip(out), 'ai-metawipe-images.zip')}>Download all as ZIP</button>}
      </div>
      {out?.map((r, i) => (
        <div className="card" key={i}>
          <Result blob={r.blob} name={r.name} beforeSize={r.before} note={mode === 'compress' && r.blob.size >= r.before ? 'This file was already well compressed. The result is not smaller, so keep the original.' : ''} />
        </div>
      ))}
    </Panel>
  )
}
