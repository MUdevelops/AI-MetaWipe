import { Icon } from '../Icon.jsx'
import { TOOLS } from '../../lib/tools.js'
import { Accordion, FormatsTable, PrivacyFlow } from './shared.jsx'

const TOC = [['start', 'Getting started'], ['tools', 'Tool guides'], ['privacy', 'Privacy and data'], ['formats', 'Supported formats'], ['limits', 'Limits'], ['fix', 'Troubleshooting'], ['a11y', 'Accessibility'], ['faq', 'FAQ']]

export default function Help({ onOpen }) {
  return (
    <div className="page">
      <div className="page-head">
        <p className="eyebrow">Help Center</p>
        <h1>Documentation</h1>
        <p className="sub">Everything you need to use AI MetaWipe with confidence.</p>
      </div>
      <div className="doc">
        <nav className="toc" aria-label="On this page">{TOC.map(([id, l]) => <a key={id} href={`#doc-${id}`}>{l}</a>)}</nav>
        <div className="doc-body">
          <section id="doc-start"><h2>Getting started</h2>
            <ol>
              <li><b>Add images.</b> Open the Media Library and drop images or a folder.</li>
              <li><b>Select a file.</b> Click an image. Every tool works on the selected one.</li>
              <li><b>Explore its metadata.</b> Open the Metadata Viewer or the Privacy Center.</li>
              <li><b>Choose a tool.</b> Clean, edit, compare or optimize.</li>
              <li><b>Download the result.</b> Single files, or a ZIP for batches. Originals are never changed.</li>
            </ol>
          </section>
          <section id="doc-tools"><h2>Tool guides</h2>
            {TOOLS.map((t) => (
              <details key={t.id} className="doc-tool">
                <summary><Icon name={t.icon} size={18} /><b>{t.n} {t.name}</b><Icon name="down" size={16} /></summary>
                <p>{t.desc}</p>
                <ul>{t.features.map((f) => <li key={f}>{f}</li>)}</ul>
                <button className="btn small primary" onClick={() => onOpen(t.id)}>Open {t.name}</button>
              </details>
            ))}
          </section>
          <section id="doc-privacy"><h2>Privacy and data</h2><PrivacyFlow /></section>
          <section id="doc-formats"><h2>Supported formats</h2><FormatsTable /></section>
          <section id="doc-limits"><h2>Limits</h2>
            <ul>
              <li>Metadata only. Invisible pixel watermarks (for example SynthID) are not removed.</li>
              <li>Writing metadata replaces the existing metadata of the file.</li>
              <li>Background removal erases a colour connected to the edges. It is not an AI cut-out tool.</li>
              <li>Compressing below "Lossless" reduces colours, which can band smooth gradients.</li>
              <li>The privacy score is an estimate, not a guarantee.</li>
            </ul>
          </section>
          <section id="doc-fix"><h2>Troubleshooting</h2>
            <ul>
              <li><b>The agent says it was rejected.</b> Add a valid Pollinations API key in the agent's Settings.</li>
              <li><b>A photo looks rotated.</b> Use the default cleaning method, which keeps the orientation value.</li>
              <li><b>HEIC or TIFF is not supported.</b> Your browser cannot decode it. Safari handles HEIC.</li>
              <li><b>Background removal cuts into the subject.</b> Lower the tolerance.</li>
            </ul>
          </section>
          <section id="doc-a11y"><h2>Accessibility</h2>
            <ul>
              <li>Everything works with the keyboard. Tab moves between controls, Enter or Space activates them, Escape closes dialogs and the mobile menu.</li>
              <li>Focus is always visible, and motion is switched off when your system asks for reduced motion.</li>
              <li>Removed metadata shown as black bars can be read by hovering or focusing them, and screen readers announce them.</li>
            </ul>
          </section>
          <section id="doc-faq"><h2>FAQ</h2><Accordion /></section>
        </div>
      </div>
    </div>
  )
}
