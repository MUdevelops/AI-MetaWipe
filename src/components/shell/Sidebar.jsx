import { useEffect, useState } from 'react'
import { Icon } from '../Icon.jsx'

export const SIDE = [
  { id: 'overview', label: 'Overview', icon: 'home', links: [['overview', 'Dashboard', 'home'], ['tools', 'All Tools', 'grid']] },
  { id: 'workspace', label: 'Workspace', icon: 'folder', links: [['library', 'Media Library', 'folder']] },
  { id: 'analyze', label: 'Analyze', icon: 'eye', links: [['viewer', 'Metadata Viewer', 'eye'], ['compare', 'Compare Images', 'compare']] },
  { id: 'clean', label: 'Clean & Edit', icon: 'eraser', links: [['remove', 'Remove Metadata', 'eraser'], ['editor', 'Metadata Editor', 'pencil']] },
  { id: 'optimize', label: 'Optimize', icon: 'sliders', links: [['optimize', 'Compress, Convert, Resize', 'sliders'], ['crop', 'Crop Studio', 'crop'], ['background', 'Background & Alpha', 'layers'], ['palette', 'Color Palette', 'palette'], ['duplicates', 'Duplicate Finder', 'copy']] },
  { id: 'privacy', label: 'Privacy & Security', icon: 'shield', links: [['privacy', 'Privacy Center', 'shield']] },
  { id: 'ai', label: 'AI Assistant', icon: 'bot', links: [['agent', 'AI Metadata Agent', 'bot']] },
  { id: 'workflows', label: 'Workflows', icon: 'workflow', direct: 'workflows' },
  { id: 'help', label: 'Help Center', icon: 'help', direct: 'help' },
  { id: 'settings', label: 'Settings', icon: 'settings', action: 'settings' },
]

export default function Sidebar({ view, setView, collapsed, onToggle, open, onClose, onSettings, badges }) {
  const activeGroup = SIDE.find((g) => g.links?.some(([id]) => id === view))?.id
  const [openGroups, setOpenGroups] = useState(() => new Set(['overview', 'analyze', 'clean']))
  useEffect(() => { if (activeGroup) setOpenGroups((s) => (s.has(activeGroup) ? s : new Set([...s, activeGroup]))) }, [activeGroup])
  const toggle = (id) => setOpenGroups((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const go = (id) => { setView(id); onClose() }
  const mini = collapsed && !open

  const Item = ({ id, label, icon }) => (
    <button className={`side-link ${view === id ? 'on' : ''}`} aria-current={view === id ? 'page' : undefined} onClick={() => go(id)} title={mini ? label : undefined}>
      <Icon name={icon} size={18} />
      {!mini && <span className="grow">{label}</span>}
      {!mini && badges[id] ? <i className={`badge ${badges[id].tone}`}>{badges[id].text}</i> : null}
    </button>
  )

  return (
    <>
      {open && <div className="drawer-back" onClick={onClose} aria-hidden="true" />}
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${open ? 'open' : ''}`} aria-label="Sidebar">
        <div className="side-head">
          {!mini && <b>Navigation</b>}
          <button className="icon-btn collapse-btn" onClick={onToggle} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}><Icon name={collapsed ? 'right' : 'left'} size={18} /></button>
          <button className="icon-btn close-btn" onClick={onClose} aria-label="Close navigation menu"><Icon name="x" size={18} /></button>
        </div>
        <div className="side-scroll">
          {SIDE.map((g, i) => {
            if (mini) {
              if (g.links) return g.links.map(([id, label, icon]) => <Item key={id} id={id} label={label} icon={icon} />)
              if (g.direct) return <Item key={g.id} id={g.direct} label={g.label} icon={g.icon} />
              return <button key={g.id} className="side-link" onClick={onSettings} title="Settings"><Icon name={g.icon} size={18} /></button>
            }
            if (g.direct) return <Item key={g.id} id={g.direct} label={g.label} icon={g.icon} />
            if (g.action) return <button key={g.id} className="side-link" onClick={() => { onClose(); onSettings() }}><Icon name={g.icon} size={18} /><span className="grow">{g.label}</span></button>
            const isOpen = openGroups.has(g.id)
            return (
              <div key={g.id} className={`side-group ${activeGroup === g.id ? 'active' : ''}`}>
                <button className="side-group-head" aria-expanded={isOpen} aria-controls={`sg-${g.id}`} onClick={() => toggle(g.id)}>
                  <span className="num">{String(i + 1).padStart(2, '0')}</span>
                  <span className="grow">{g.label}</span>
                  <Icon name="down" size={16} className={isOpen ? 'rot' : ''} />
                </button>
                {isOpen && <div id={`sg-${g.id}`} className="side-sub">{g.links.map(([id, label, icon]) => <Item key={id} id={id} label={label} icon={icon} />)}</div>}
              </div>
            )
          })}
        </div>
        {!mini && <p className="side-foot"><Icon name="lock" size={14} /> Images are processed in your browser.</p>}
      </aside>
    </>
  )
}
