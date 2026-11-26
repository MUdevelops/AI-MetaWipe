import { useState } from 'react'
import { Panel, Flash } from './ui.jsx'
import { sha256, dHash, hamming } from '../lib/imgtools.js'
import { fmtSize } from '../lib/bytes.js'

export default function Duplicates({ items, onRemove }) {
  const [thr, setThr] = useState(6)
  const [groups, setGroups] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function scan() {
    setBusy(true); setErr('')
    try {
      const info = []
      for (const it of items) {
        let hash = ''
        try { hash = await dHash(it.file) } catch { /* undecodable */ }
        info.push({ it, sha: await sha256(it.meta.bytes), hash })
      }
      const parent = info.map((_, i) => i)
      const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])))
      const exact = new Set()
      for (let i = 0; i < info.length; i++) for (let j = i + 1; j < info.length; j++) {
        const same = info[i].sha === info[j].sha
        const close = info[i].hash && info[j].hash && hamming(info[i].hash, info[j].hash) <= thr
        if (same || close) { parent[find(j)] = find(i); if (same) exact.add(i).add(j) }
      }
      const map = new Map()
      info.forEach((x, i) => { const r = find(i); map.set(r, [...(map.get(r) || []), { ...x, i }]) })
      setGroups([...map.values()].filter((g) => g.length > 1).map((g) => ({ members: g, exact: g.every((x) => exact.has(x.i)) })))
    } catch (e) { setErr(e.message) }
    setBusy(false)
  }

  const dropExtras = (g) => {
    const sorted = [...g.members].sort((a, b) => b.it.meta.size - a.it.meta.size)
    onRemove(sorted.slice(1).map((x) => x.it.id))
    setGroups((gs) => gs.filter((x) => x !== g))
  }

  if (items.length < 2) return <Panel title="Duplicate Image Detector"><p className="empty">Add at least two images to look for duplicates.</p></Panel>

  return (
    <Panel title="Duplicate Image Detector" hint="Finds identical files and near-identical pictures (resized, recompressed or with different metadata).">
      <label className="field">Similarity: {thr <= 2 ? 'strict' : thr <= 6 ? 'balanced' : 'loose'} ({thr})
        <input type="range" min="0" max="12" value={thr} onChange={(e) => setThr(+e.target.value)} />
      </label>
      <button className="btn primary" disabled={busy} onClick={scan}>{busy ? 'Scanning…' : `Scan ${items.length} images`}</button>
      {err && <Flash kind="danger">{err}</Flash>}
      {groups && !groups.length && <Flash kind="ok">No duplicates found.</Flash>}
      {groups?.map((g, k) => (
        <div className="card" key={k}>
          <div className="panel-head">
            <b>{g.exact ? 'Identical files' : 'Similar pictures'} ({g.members.length})</b>
            <button className="btn small" onClick={() => dropExtras(g)}>Keep largest, remove the rest from the list</button>
          </div>
          <ul className="dups">
            {g.members.map((x) => (
              <li key={x.it.id}>
                <span className="checker thumb big"><img src={x.it.url} alt="" loading="lazy" decoding="async" /></span>
                <span className="name">{x.it.meta.name}</span>
                <span className="meta">{x.it.meta.width} x {x.it.meta.height} · {fmtSize(x.it.meta.size)}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {groups?.length > 0 && <p className="meta">Removing only takes images out of this list. Your files on disk are not touched.</p>}
    </Panel>
  )
}
