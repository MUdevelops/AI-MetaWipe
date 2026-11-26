import { useEffect, useState } from 'react'
import { Panel, Pick, NeedImage, Flash } from './ui.jsx'
import { extractPalette } from '../lib/imgtools.js'
import { saveText } from '../lib/report.js'
import { useToast } from './Toast.jsx'

export default function Palette({ items, sel, onSel }) {
  const [n, setN] = useState(8)
  const [colors, setColors] = useState([])
  const [copied, setCopied] = useState('')
  const [err, setErr] = useState('')
  const toast = useToast()
  useEffect(() => {
    let live = true
    setErr('')
    if (!sel) return undefined
    extractPalette(sel.file, n).then((c) => live && setColors(c)).catch((e) => live && setErr(e.message))
    return () => { live = false }
  }, [sel?.id, n])
  if (!sel) return <NeedImage />

  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); setCopied(text); toast('Copied to clipboard.', 'info'); setTimeout(() => setCopied(''), 1200) } catch { setErr('Copy is blocked in this browser. Select the text and copy it by hand.') }
  }
  const css = `:root {\n${colors.map((c, i) => `  --color-${i + 1}: ${c.hex};`).join('\n')}\n}`

  return (
    <Panel title="Color Palette Extractor" hint="The dominant colours of the image. Click a swatch to copy its hex code.">
      <div className="two">
        <Pick items={items} value={sel.id} onChange={onSel} />
        <label className="field">Number of colours
          <select value={n} onChange={(e) => setN(+e.target.value)}>{[4, 5, 6, 8, 10, 12].map((v) => <option key={v}>{v}</option>)}</select>
        </label>
      </div>
      {err && <Flash kind="danger">{err}</Flash>}
      <div className="strip">{colors.map((c) => <span key={c.hex} style={{ background: c.hex, flexGrow: c.pct }} title={c.hex} />)}</div>
      <ul className="swatches">
        {colors.map((c) => (
          <li key={c.hex}>
            <button onClick={() => copy(c.hex)} aria-label={`Copy ${c.hex}`}>
              <span className="sw" style={{ background: c.hex }} />
              <b>{copied === c.hex ? 'Copied' : c.hex}</b>
              <small>rgb({c.rgb}) · {c.pct.toFixed(1)}%</small>
            </button>
          </li>
        ))}
      </ul>
      <div className="row">
        <button className="btn" onClick={() => copy(css)}>{copied === css ? 'Copied' : 'Copy as CSS variables'}</button>
        <button className="btn" onClick={() => saveText(JSON.stringify(colors, null, 2), 'palette.json', 'application/json')}>Download JSON</button>
      </div>
    </Panel>
  )
}
