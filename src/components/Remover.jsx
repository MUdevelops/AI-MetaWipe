import { useState } from 'react'
import { Panel, Pick, NeedImage, Check, Redactions, uniqueNamer, Flash } from './ui.jsx'
import { ALL_OPTS, NONE_OPTS } from '../lib/edit.js'
import { cleanFile } from '../lib/pipeline.js'
import { makeZip } from '../lib/zip.js'
import { saveBlob } from '../lib/report.js'
import { fmtSize } from '../lib/bytes.js'
import { Result } from './ui.jsx'
import { useToast } from './Toast.jsx'

const PRESETS = [
  ['Everything', { ...NONE_OPTS, ...ALL_OPTS }],
  ['GPS only', { ...NONE_OPTS, gps: true }],
  ['EXIF and GPS', { ...NONE_OPTS, exif: true, gps: true, thumbnail: true }],
  ['IPTC only', { ...NONE_OPTS, iptc: true }],
  ['XMP only', { ...NONE_OPTS, xmp: true }],
  ['PNG text only', { ...NONE_OPTS, text: true }],
  ['Clean PNG', { ...NONE_OPTS, ...ALL_OPTS }],
]

const OPTIONS = [
  ['exif', 'EXIF', 'Camera, lens, settings, dates. Also removes GPS and the thumbnail inside it.'],
  ['gps', 'GPS location', 'Only the location tags. Other EXIF stays.'],
  ['thumbnail', 'Embedded thumbnail', 'The small preview stored inside EXIF.'],
  ['iptc', 'IPTC', 'Caption, credit, keywords from photo editors.'],
  ['xmp', 'XMP', 'Adobe style metadata, also used by many AI tools.'],
  ['text', 'PNG text chunks', 'Where Stable Diffusion and ComfyUI keep prompts and workflows.'],
  ['c2pa', 'C2PA content credentials', 'Signed provenance records.'],
  ['comments', 'Comments', 'JPEG comment blocks.'],
  ['icc', 'ICC colour profile', 'Off by default. Removing it can change how colours look.'],
  ['other', 'Everything else', 'Unknown blocks, modification time, data after the image end.'],
]

export default function Remover({ items, sel, onSel, opts, setOpts }) {
  const [scope, setScope] = useState('one')
  const [redraw, setRedraw] = useState(false)
  const [quality, setQuality] = useState(0.95)
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState([])
  const [prog, setProg] = useState(null)
  const toast = useToast()
  if (!sel) return <NeedImage />

  const set = (k, v) => setOpts((o) => ({ ...o, [k]: v }))
  const any = Object.values(opts).some(Boolean)

  async function run() {
    setBusy(true)
    setResults([])
    const uniq = uniqueNamer()
    const out = []
    const targets = scope === 'all' ? items : [sel]
    for (const it of targets) {
      setProg({ done: out.length, total: targets.length })
      try {
        const r = await cleanFile(it.file, it.meta.bytes, { opts, redraw, quality })
        r.name = uniq(r.name)
        out.push(r)
      } catch (e) {
        out.push({ name: it.meta.name, error: e.message })
      }
      setResults([...out])
    }
    setBusy(false)
    setProg(null)
    const ok = out.filter((r) => r.blob).length
    toast(ok ? `Cleaned ${ok} image${ok > 1 ? 's' : ''}. Originals are untouched.` : 'Nothing could be cleaned.', ok ? 'ok' : 'danger')
  }

  const good = results.filter((r) => r.blob)

  return (
    <Panel title="Remove Metadata" hint="Choose exactly what to remove. In the default mode the pixels are never touched, so quality stays identical.">
      <div className="presets">
        {PRESETS.map(([label, o]) => <button key={label} className="chip" onClick={() => setOpts({ ...o })}>{label}</button>)}
      </div>
      <div className="checks">
        {OPTIONS.map(([k, label, hint]) => (
          <Check key={k} checked={!!(opts[k] || (opts.exif && (k === 'gps' || k === 'thumbnail')))} disabled={opts.exif && (k === 'gps' || k === 'thumbnail')} onChange={(v) => set(k, v)} hint={hint}>{label}</Check>
        ))}
      </div>

      <div className="two">
        <fieldset className="opts">
          <legend>Apply to</legend>
          <label className="opt"><input type="radio" checked={scope === 'one'} onChange={() => setScope('one')} /><span><b>Selected image</b></span></label>
          <label className="opt"><input type="radio" checked={scope === 'all'} onChange={() => setScope('all')} /><span><b>All {items.length} images (batch)</b><small>Results come as a ZIP.</small></span></label>
          {scope === 'one' && items.length > 1 && <Pick items={items} value={sel.id} onChange={onSel} />}
        </fieldset>
        <fieldset className="opts">
          <legend>Method</legend>
          <Check checked={redraw} onChange={setRedraw} hint="Rebuilds the file from pixels only. Slower, and it ignores the choices on the left. JPG and WebP are re-encoded.">Redraw the image instead</Check>
          {redraw && (
            <label className="field">Quality for JPG and WebP: {Math.round(quality * 100)}%
              <input type="range" min="0.5" max="1" step="0.01" value={quality} onChange={(e) => setQuality(+e.target.value)} />
            </label>
          )}
          <p className="meta">GIF, BMP, AVIF and other formats are always converted to PNG.</p>
        </fieldset>
      </div>

      {prog && <div className="progress" role="progressbar" aria-valuemin="0" aria-valuemax={prog.total} aria-valuenow={prog.done}><span style={{ width: `${(prog.done / prog.total) * 100}%` }} /><em>Cleaning image {prog.done + 1} of {prog.total}</em></div>}
      <div className="row">
        <button className="btn primary" disabled={busy || (!any && !redraw)} onClick={run}>{busy ? 'Cleaning…' : 'Clean now'}</button>
        {good.length > 1 && <button className="btn" onClick={async () => saveBlob(await makeZip(good), 'ai-metawipe-clean-images.zip')}>Download all as ZIP</button>}
      </div>

      {results.length > 0 && <h3>Results</h3>}
      <ul className="list">
        {results.map((r, i) => (
          <li key={i} className="card">
            {r.error ? <Flash kind="danger">{r.name}: {r.error}</Flash> : (
              <>
                <Result blob={r.blob} name={r.name} beforeSize={r.originalSize} />
                {r.note && <p className="meta">{r.note}</p>}
                {r.removed && <Redactions list={r.removed} />}
              </>
            )}
          </li>
        ))}
      </ul>
      {results.length > 0 && <p className="meta">Original files are never changed. Cleaned copies are named with -clean. Total saved: {fmtSize(Math.max(0, good.reduce((s, r) => s + r.originalSize - r.newSize, 0)))}</p>}
    </Panel>
  )
}
