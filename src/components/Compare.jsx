import { useState } from 'react'
import { Panel, Pick, Table, Check, Flash } from './ui.jsx'
import { compareMeta } from '../lib/report.js'
import { saveText } from '../lib/report.js'

export default function Compare({ items, sel }) {
  const [a, setA] = useState(null)
  const [b, setB] = useState(null)
  const [diffOnly, setDiffOnly] = useState(true)
  if (items.length < 2) return <Panel title="Compare Images"><p className="empty">Add at least two images to compare their metadata.</p></Panel>
  const ia = items.find((i) => i.id === a) || sel || items[0]
  const ib = items.find((i) => i.id === b) || items.find((i) => i.id !== ia.id)
  const rows = compareMeta(ia.meta, ib.meta)
  const shown = rows.filter((r) => !diffOnly || r.status !== 'same')
  const label = { same: 'Same', diff: 'Different', onlyA: 'Only in A', onlyB: 'Only in B' }
  const counts = { diff: 0, onlyA: 0, onlyB: 0, same: 0 }
  rows.forEach((r) => counts[r.status]++)
  return (
    <Panel
      title="Compare Images"
      hint="Side by side metadata of two images. Useful to check what a clean or an edit changed."
      actions={<button className="btn" onClick={() => saveText(rows.map((r) => `[${label[r.status]}] ${r.group} ${r.key}: A=${r.a} | B=${r.b}`).join('\n'), 'metadata-comparison.txt')}>Export TXT</button>}
    >
      <div className="two">
        <Pick items={items} value={ia.id} onChange={setA} label="Image A" />
        <Pick items={items} value={ib.id} onChange={setB} label="Image B" />
      </div>
      <Flash>{counts.diff} different · {counts.onlyA} only in A · {counts.onlyB} only in B · {counts.same} identical</Flash>
      <Check checked={diffOnly} onChange={setDiffOnly}>Show differences only</Check>
      <Table
        head={['Group', 'Field', 'A', 'B', 'Result']}
        rows={shown.map((r) => ({ cls: `st-${r.status}`, cells: [r.group, r.key, r.a || '-', r.b || '-', label[r.status]] }))}
        empty="No differences. The metadata is identical."
      />
    </Panel>
  )
}
