import { Icon, Logo } from '../Icon.jsx'

export default function Footer({ openTool, setView }) {
  const L = ({ id, children }) => <li><button className="linkish" onClick={() => openTool(id)}>{children}</button></li>
  return (
    <footer className="footer">
      <div className="footer-grid">
        <div>
          <div className="brand static"><Logo size={30} /><span>AI MetaWipe</span></div>
          <p className="meta">A privacy-first toolkit to inspect, clean, edit and optimize images directly in your browser.</p>
          <p className="tagline">View. Clean. Edit. Optimize. Share Safely.</p>
        </div>
        <div>
          <h4>Tools</h4>
          <ul>
            <L id="viewer">Metadata Viewer</L><L id="remove">Remove Metadata</L><L id="editor">Metadata Editor</L>
            <L id="optimize">Compress and Convert</L><L id="privacy">Privacy Center</L><L id="agent">AI Agent</L>
            <li><button className="linkish" onClick={() => setView('tools')}>All 12 tools</button></li>
          </ul>
        </div>
        <div>
          <h4>Privacy</h4>
          <ul className="plain">
            <li>Images are processed locally in your browser.</li>
            <li>No application server receives your images.</li>
            <li>The AI Agent sends questions and a metadata summary to Pollinations, never pixels.</li>
          </ul>
        </div>
        <div>
          <h4>Project</h4>
          <ul>
            <li><a href="https://github.com/MUdevelops/AI-MetaWipe" target="_blank" rel="noopener noreferrer"><Icon name="link" size={14} /> GitHub repository</a></li>
            <li><button className="linkish" onClick={() => setView('help')}>Documentation</button></li>
            <li><span className="meta">License: see the GitHub repository.</span></li>
          </ul>
        </div>
      </div>
      <p className="copy">© 2026 MUdevelops. AI MetaWipe removes metadata only; invisible pixel watermarks are not metadata.</p>
    </footer>
  )
}
