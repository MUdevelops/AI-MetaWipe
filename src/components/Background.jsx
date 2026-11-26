import { useEffect, useState } from 'react'
import { Panel, Pick, NeedImage, Result, Flash, Pills, Table } from './ui.jsx'
import { removeBackground, alphaStats, baseName } from '../lib/imgtools.js'

export default function Background({ items, sel, onSel }) {
  const [mode, setMode] = useState('remove')
  const [tol, setTol] = useState(28)
  const [erode, setErode] = useState(1)
  const [auto, setAuto] = useState(true)
  const [color, setColor] = useState('#ffffff')
  const [out, setOut] = useState(null)
  const [stats, setStats] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  useEffect(() => { setOut(null); setStats(null); setErr('') }, [sel?.id, mode])
  if (!sel) return <NeedImage />
  const m = sel.meta

  const rgb = () => [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16))

  async function remove() {
    setBusy(true); setErr('')
    try {
      const r = await removeBackground(sel.file, { tolerance: tol, erode, color: auto ? null : rgb() })
      setOut({ ...r, name: `${baseName(m.name)}-nobg.png`, before: sel.file.size })
    } catch (e) { setErr(e.message) }
    setBusy(false)
  }
  async function check() {
    setBusy(true); setErr('')
    try { setStats(await alphaStats(sel.file)) } catch (e) { setErr(e.message) }
    setBusy(false)
  }

  return (
    <Panel title="Background and Transparency" hint="Make a plain background transparent, and check whether an image really has transparency.">
      <Pills value={mode} onChange={setMode} tabs={[['remove', 'Remove background'], ['check', 'Transparency checker']]} />
      <Pick items={items} value={sel.id} onChange={onSel} />

      {mode === 'remove' && (
        <>
          <Flash>This works by erasing the background colour that touches the image edges. It is best for plain or studio backgrounds (white, green screen, solid colour). It cannot cut out a person from a busy photo.</Flash>
          <div className="crop-stage checker small"><img src={sel.url} alt="Original" /></div>
          <label className="check"><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /><span><b>Detect background colour from the corners</b></span></label>
          {!auto && <label className="field">Background colour<input type="color" value={color} onChange={(e) => setColor(e.target.value)} /></label>}
          <div className="two">
            <label className="field">Tolerance: {tol}<input type="range" min="2" max="80" value={tol} onChange={(e) => setTol(+e.target.value)} /></label>
            <label className="field">Trim edge halo: {erode} px<input type="range" min="0" max="4" value={erode} onChange={(e) => setErode(+e.target.value)} /></label>
          </div>
          {err && <Flash kind="danger">{err}</Flash>}
          <button className="btn primary" disabled={busy} onClick={remove}>{busy ? 'Working…' : 'Remove background'}</button>
          {out && (
            <div className="card">
              <Result blob={out.blob} name={out.name} beforeSize={out.before} note={`${out.removedPct.toFixed(1)}% of the pixels became transparent. If parts of the subject vanished, lower the tolerance.`} />
            </div>
          )}
        </>
      )}

      {mode === 'check' && (
        <>
          <p className="meta">File says: {m.alphaChannel === undefined ? 'unknown' : m.alphaChannel ? 'has an alpha channel' : m.hasTrns ? 'uses palette transparency' : 'no alpha channel'}.</p>
          {err && <Flash kind="danger">{err}</Flash>}
          <button className="btn primary" disabled={busy} onClick={check}>{busy ? 'Scanning…' : 'Scan pixels'}</button>
          {stats && (
            <>
              <Flash kind={stats.clear + stats.semi > 0 ? 'ok' : 'info'}>
                {stats.clear + stats.semi > 0 ? 'This image has real transparency.' : 'Every pixel is fully opaque. There is no visible transparency.'}
              </Flash>
              <Table head={['Pixels', 'Count', 'Share']} rows={[
                { cells: ['Fully transparent', stats.clear.toLocaleString(), `${stats.clearPct.toFixed(2)}%`] },
                { cells: ['Semi-transparent', stats.semi.toLocaleString(), `${stats.semiPct.toFixed(2)}%`] },
                { cells: ['Fully opaque', stats.opaque.toLocaleString(), `${(100 - stats.clearPct - stats.semiPct).toFixed(2)}%`] },
              ]} />
              <p className="meta">The checkerboard behind the preview shows through transparent areas.</p>
              <div className="crop-stage checker small"><img src={sel.url} alt="Preview on checkerboard" /></div>
            </>
          )}
        </>
      )}
    </Panel>
  )
}
