import { useMemo, useState } from 'react'
import { Icon } from '../Icon.jsx'
import { CATS, TOOLS } from '../../lib/tools.js'

export default function ToolsDirectory({ onOpen, total }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('all')
  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return TOOLS.filter((t) => (cat === 'all' || t.cat === cat) && (!s || `${t.name} ${t.desc} ${t.features.join(' ')}`.toLowerCase().includes(s)))
  }, [q, cat])
  const accent = (c) => CATS.find((x) => x.id === c)?.accent

  return (
    <div className="page">
      <div className="page-head">
        <p className="eyebrow">Tools directory</p>
        <h1>All 12 tools</h1>
        <p className="sub">Every feature of AI MetaWipe in one place. Each card opens the real tool, working on the image you have selected.{!total && ' Add an image first so the tools have something to work on.'}</p>
      </div>

      <div className="dir-bar">
        <label className="search">
          <Icon name="search" size={18} />
          <span className="sr">Search tools</span>
          <input type="search" placeholder="Search tools, for example GPS, WebP, crop…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <div className="cat-filter" role="group" aria-label="Filter by category">
          {[{ id: 'all', label: 'All' }, ...CATS].map((c) => (
            <button key={c.id} className={cat === c.id ? 'on' : ''} aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>{c.label}</button>
          ))}
        </div>
      </div>
      <p className="meta" aria-live="polite">{list.length} of {TOOLS.length} tools</p>

      {list.length === 0 && (
        <div className="empty-state">
          <Icon name="search" size={28} />
          <h3>No tool matches “{q}”</h3>
          <p>Try a broader word such as “metadata”, “image” or “privacy”.</p>
          <button className="btn" onClick={() => { setQ(''); setCat('all') }}>Clear search</button>
        </div>
      )}

      <div className="tool-grid">
        {list.map((t) => (
          <article key={t.id} className={`tool-card a-${accent(t.cat)}`}>
            <div className="tool-top">
              <span className="tool-ico"><Icon name={t.icon} size={22} /></span>
              <span className="tool-num">{t.n}</span>
            </div>
            <span className="cat-tag">{CATS.find((c) => c.id === t.cat).label}</span>
            <h3>{t.name}</h3>
            <p>{t.desc}</p>
            <ul>{t.features.slice(0, 4).map((f) => <li key={f}><Icon name="check" size={14} />{f}</li>)}</ul>
            <button className="btn primary" onClick={() => onOpen(t.id)}>Open tool <Icon name="right" size={16} /></button>
          </article>
        ))}
      </div>
    </div>
  )
}
