import { useEffect, useState } from 'react'
import { Panel, Pick, NeedImage, Result, Flash, Table, uniqueNamer } from './ui.jsx'
import { writeMetadata } from '../lib/edit.js'
import { readMetadata } from '../lib/meta.js'
import { flatten, saveBlob } from '../lib/report.js'
import { convertImage } from '../lib/imgtools.js'
import { makeZip } from '../lib/zip.js'
import { useToast } from './Toast.jsx'

const EMPTY = { title: '', author: '', copyright: '', description: '', keywords: '', date: '', software: '', custom: [] }
const KEY = 'metawipe.templates'

const loadTemplates = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] } }
const saveTemplates = (t) => { try { localStorage.setItem(KEY, JSON.stringify(t)) } catch { /* storage blocked */ } }

export default function Editor({ items, sel, onSel }) {
  const [f, setF] = useState(EMPTY)
  const [scope, setScope] = useState('one')
  const [out, setOut] = useState([])
  const [busy, setBusy] = useState(false)
  const [templates, setTemplates] = useState([])
  const [tname, setTname] = useState('')
  const [err, setErr] = useState('')
  const toast = useToast()
  useEffect(() => setTemplates(loadTemplates()), [])
  if (!sel) return <NeedImage />

  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const m = sel.meta

  function loadCurrent() {
    const x = m.xmp?.fields || {}
    const t = (k) => m.pngText.find((p) => p.keyword === k)?.text || ''
    setF({
      title: x['dc:title'] || t('Title'),
      author: m.exif?.ifd0.Artist || x['dc:creator'] || t('Author'),
      copyright: m.exif?.ifd0.Copyright || x['dc:rights'] || t('Copyright'),
      description: m.exif?.ifd0.ImageDescription || x['dc:description'] || t('Description'),
      keywords: x['dc:subject'] || t('Keywords'),
      date: '',
      software: m.exif?.ifd0.Software || x['xmp:CreatorTool'] || t('Software'),
      custom: Object.entries(x).filter(([k]) => k.startsWith('mw:')).map(([k, v]) => ({ key: k.slice(3), value: v })),
    })
  }

  async function apply() {
    setBusy(true)
    setErr('')
    setOut([])
    const uniq = uniqueNamer()
    const fields = { ...f, keywords: f.keywords.split(',').map((s) => s.trim()).filter(Boolean) }
    const res = []
    for (const it of scope === 'all' ? items : [sel]) {
      try {
        let bytes = it.meta.bytes
        let type = it.meta.type
        if (type !== 'jpeg' && type !== 'png') {
          bytes = new Uint8Array(await (await convertImage(it.file, 'image/png')).arrayBuffer())
          type = 'png'
        }
        const data = writeMetadata(bytes, fields)
        const ext = type === 'jpeg' ? 'jpg' : 'png'
        const name = uniq(`${it.meta.name.replace(/\.[^.]+$/, '')}-edited.${ext}`)
        const blob = new Blob([data], { type: type === 'jpeg' ? 'image/jpeg' : 'image/png' })
        const check = await readMetadata(new File([blob], name))
        res.push({ name, blob, before: it.file.size, rows: flatten(check).filter((r) => r.group !== 'File') })
      } catch (e) {
        res.push({ name: it.meta.name, error: e.message })
      }
    }
    setOut(res)
    setBusy(false)
    const ok = res.filter((r) => r.blob).length
    toast(ok ? `Metadata written to ${ok} image${ok > 1 ? 's' : ''}.` : 'Could not write metadata.', ok ? 'ok' : 'danger')
  }

  const saveTpl = () => {
    if (!tname.trim()) return setErr('Give the template a name first.')
    const next = [...templates.filter((t) => t.name !== tname.trim()), { name: tname.trim(), fields: f }]
    setTemplates(next); saveTemplates(next); setErr(''); toast(`Template “${tname.trim()}” saved in this browser.`)
  }
  const delTpl = (n) => { const next = templates.filter((t) => t.name !== n); setTemplates(next); saveTemplates(next) }
  const good = out.filter((r) => r.blob)

  return (
    <Panel title="Metadata Editor" hint="Write your own title, author, copyright, keywords and custom fields. Existing metadata (including GPS) is removed first, so only what you enter is stored.">
      <div className="two">
        <Pick items={items} value={sel.id} onChange={onSel} />
        <div className="row end"><button className="btn" onClick={loadCurrent}>Load current values</button><button className="btn" onClick={() => setF(EMPTY)}>Clear form</button></div>
      </div>
      <div className="form">
        <label className="field">Title<input value={f.title} onChange={(e) => set('title', e.target.value)} /></label>
        <label className="field">Author<input value={f.author} onChange={(e) => set('author', e.target.value)} /></label>
        <label className="field">Copyright<input value={f.copyright} placeholder="© 2026 Your Name" onChange={(e) => set('copyright', e.target.value)} /></label>
        <label className="field">Creation date<input type="datetime-local" value={f.date} onChange={(e) => set('date', e.target.value)} /></label>
        <label className="field wide">Description<textarea rows="3" value={f.description} onChange={(e) => set('description', e.target.value)} /></label>
        <label className="field wide">Keywords (separate with commas)<input value={f.keywords} onChange={(e) => set('keywords', e.target.value)} /></label>
        <label className="field">Software<input value={f.software} onChange={(e) => set('software', e.target.value)} /></label>
      </div>

      <h3>Custom fields</h3>
      {f.custom.map((c, i) => (
        <div className="row" key={i}>
          <input aria-label="Field name" placeholder="Name" value={c.key} onChange={(e) => set('custom', f.custom.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))} />
          <input aria-label="Field value" className="grow" placeholder="Value" value={c.value} onChange={(e) => set('custom', f.custom.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
          <button className="btn small" onClick={() => set('custom', f.custom.filter((_, j) => j !== i))}>Remove</button>
        </div>
      ))}
      <button className="btn small" onClick={() => set('custom', [...f.custom, { key: '', value: '' }])}>Add custom field</button>

      <h3>Templates</h3>
      <div className="row">
        <input placeholder="Template name" value={tname} onChange={(e) => setTname(e.target.value)} />
        <button className="btn" onClick={saveTpl}>Save current as template</button>
      </div>
      <div className="presets">
        {templates.map((t) => (
          <span key={t.name} className="chip-group">
            <button className="chip" onClick={() => setF({ ...EMPTY, ...t.fields })}>{t.name}</button>
            <button className="chip x" aria-label={`Delete template ${t.name}`} onClick={() => delTpl(t.name)}>×</button>
          </span>
        ))}
        {!templates.length && <p className="meta">Templates are saved in this browser only.</p>}
      </div>

      <fieldset className="opts">
        <legend>Apply to</legend>
        <label className="opt"><input type="radio" checked={scope === 'one'} onChange={() => setScope('one')} /><span><b>Selected image</b></span></label>
        <label className="opt"><input type="radio" checked={scope === 'all'} onChange={() => setScope('all')} /><span><b>All {items.length} images</b><small>Good for stamping copyright on a batch.</small></span></label>
      </fieldset>
      <p className="meta">JPEG and PNG keep their format. Other formats are converted to PNG first. Text is written as EXIF, XMP and (for PNG) text chunks.</p>
      {err && <Flash kind="danger">{err}</Flash>}
      <div className="row">
        <button className="btn primary" disabled={busy} onClick={apply}>{busy ? 'Writing…' : 'Write metadata'}</button>
        {good.length > 1 && <button className="btn" onClick={async () => saveBlob(await makeZip(good), 'ai-metawipe-edited.zip')}>Download all as ZIP</button>}
      </div>
      {out.map((r, i) => (
        <div key={i} className="card">
          {r.error ? <Flash kind="danger">{r.name}: {r.error}</Flash> : (
            <>
              <Result blob={r.blob} name={r.name} beforeSize={r.before} />
              <p className="meta">Verified by reading the new file back:</p>
              <Table head={['Group', 'Field', 'Value']} rows={r.rows.map((x) => ({ cells: [x.group, x.key, x.value] }))} empty="No metadata found in the new file." />
            </>
          )}
        </div>
      ))}
    </Panel>
  )
}
