import { Icon, Logo } from '../Icon.jsx'

const LINKS = [['overview', 'Overview'], ['tools', 'Tools'], ['library', 'Workspace'], ['privacy', 'Privacy Center'], ['agent', 'AI Assistant'], ['help', 'Documentation']]

export default function Topbar({ view, setView, onMenu, theme, resolved, onTheme, onSettings, status }) {
  return (
    <header className="topbar">
      <button className="icon-btn menu-btn" onClick={onMenu} aria-label="Open navigation menu" data-tip="Menu"><Icon name="menu" /></button>
      <button className="brand" onClick={() => setView('overview')} aria-label="AI MetaWipe, go to overview">
        <Logo size={30} /><span>AI MetaWipe</span>
      </button>
      <nav className="top-links" aria-label="Main">
        {LINKS.map(([id, label]) => (
          <button key={id} className={view === id ? 'on' : ''} aria-current={view === id ? 'page' : undefined} onClick={() => setView(id)}>{label}</button>
        ))}
      </nav>
      <div className="top-right">
        <button className={`status ${status.tone}`} onClick={() => setView('library')} data-tip="Open workspace">
          <span className="dot" aria-hidden="true" />
          <span>{status.text}</span>
        </button>
        <button className="icon-btn" onClick={onTheme} aria-label={`Switch to ${resolved === 'dark' ? 'light' : 'dark'} theme`} data-tip={resolved === 'dark' ? 'Light theme' : 'Dark theme'}>
          <Icon name={resolved === 'dark' ? 'sun' : 'moon'} />
        </button>
        <button className="icon-btn" onClick={onSettings} aria-label="Open settings" data-tip="Settings"><Icon name="settings" /></button>
      </div>
    </header>
  )
}
