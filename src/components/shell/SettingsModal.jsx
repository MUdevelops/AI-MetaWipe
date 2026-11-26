import { Modal } from '../Confirm.jsx'

export default function SettingsModal({ open, onClose, theme, setTheme, collapsed, setCollapsed, onResetTemplates, onResetUi, total }) {
  return (
    <Modal open={open} title="Settings" onClose={onClose}>
      <fieldset className="opts">
        <legend>Theme</legend>
        {[['dark', 'Dark', 'The default premium dark interface.'], ['light', 'Light', 'A bright professional theme.'], ['system', 'Match my device', 'Follows your operating system setting.']].map(([v, l, h]) => (
          <label key={v} className="opt"><input type="radio" name="theme" checked={theme === v} onChange={() => setTheme(v)} /><span><b>{l}</b><small>{h}</small></span></label>
        ))}
      </fieldset>
      <label className="check"><input type="checkbox" checked={collapsed} onChange={(e) => setCollapsed(e.target.checked)} /><span><b>Compact sidebar</b><small>Show icons only on desktop. Hover an icon to see its name.</small></span></label>
      <p className="meta">Motion follows your device setting. If you turn on reduced motion in your system, animations are switched off.</p>
      <h3>Saved data in this browser</h3>
      <p className="meta">Metadata templates and AI agent settings are stored in this browser only. Your images are never stored. {total ? `${total} image${total > 1 ? 's are' : ' is'} currently loaded in memory.` : ''}</p>
      <div className="row">
        <button className="btn" onClick={onResetTemplates}>Delete saved templates…</button>
        <button className="btn" onClick={onResetUi}>Reset interface preferences</button>
      </div>
      <div className="row end"><button className="btn primary" data-autofocus onClick={onClose}>Done</button></div>
    </Modal>
  )
}
