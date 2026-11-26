import { Icon } from '../Icon.jsx'

export function Sec({ n, title, sub, children, id, alt }) {
  const hid = `h-${id || n}`
  return (
    <section className={`sec ${alt ? 'alt' : ''}`} id={`sec-${id || n}`} aria-labelledby={hid}>
      <div className="sec-head">
        {n && <span className="eyebrow">{n}</span>}
        <h2 id={hid}>{title}</h2>
        {sub && <p className="sub">{sub}</p>}
      </div>
      {children}
    </section>
  )
}

export const FAQ = [
  ['Are my images uploaded anywhere?', 'No. Reading, cleaning, editing, optimizing and checking all run inside your browser tab. The only feature that contacts an outside service is the AI Agent, which sends your typed questions and a summary of your metadata (never the pixels) to Pollinations.'],
  ['Does cleaning reduce image quality?', 'Not with the default method for JPG, PNG and WebP. The metadata blocks are removed and the image data is copied unchanged, and the Privacy Center can verify that the pixels are identical. Redraw mode, format conversion, compression below lossless, resizing and cropping do re-encode the image.'],
  ['Can GPS information be removed?', 'Yes. Use the "GPS only" preset in Remove Metadata, or sanitize from the Privacy Center. GPS values that were copied into XMP are removed as well.'],
  ['Can I process multiple images at once?', 'Yes. Add as many images or folders as you like, then choose "All images" in Remove Metadata or the Metadata Editor and download the results as a ZIP. There is no fixed limit, but very large batches depend on your device memory.'],
  ['Do I need the AI Agent?', 'No. Every other tool works without it and without any API key. The agent is optional and only runs when you ask it a question.'],
  ['Does AI MetaWipe work offline?', 'Yes, once the page has loaded. The AI Agent needs an internet connection, and the web font falls back to a system font when offline.'],
  ['Are my original files modified?', 'No. Browsers cannot overwrite your files. Every result is a new download, named with -clean, -edited or a similar suffix.'],
  ['Does removing metadata remove invisible watermarks?', 'No. Watermarks such as SynthID are written into the pixels, not into metadata. AI MetaWipe only removes metadata.'],
]

export function Accordion({ items = FAQ }) {
  return (
    <div className="faq">
      {items.map(([q, a]) => (
        <details key={q}>
          <summary><span>{q}</span><Icon name="down" size={18} /></summary>
          <p>{a}</p>
        </details>
      ))}
    </div>
  )
}

const Y = ({ children }) => <span className="yes"><Icon name="check" size={14} /> {children}</span>
const N = ({ children }) => <span className="no">{children}</span>

export function FormatsTable() {
  return (
    <div className="table-wrap">
      <table className="fmt">
        <thead><tr><th>Format</th><th>Inspect metadata</th><th>Remove (lossless)</th><th>Write metadata</th><th>Notes</th></tr></thead>
        <tbody>
          <tr><td>JPG / JPEG</td><td><Y>EXIF, GPS, IPTC, XMP, comments, thumbnail, C2PA</Y></td><td><Y>Yes</Y></td><td><Y>EXIF + XMP</Y></td><td>A single orientation value is kept so rotated photos stay upright.</td></tr>
          <tr><td>PNG</td><td><Y>Text chunks, EXIF, XMP, C2PA, alpha, DPI</Y></td><td><Y>Yes</Y></td><td><Y>Text chunks + XMP</Y></td><td>Where Stable Diffusion and ComfyUI store prompts and workflows.</td></tr>
          <tr><td>WebP</td><td><Y>EXIF, XMP, ICC, C2PA, size</Y></td><td><Y>Yes</Y></td><td><N>Converted to PNG first</N></td><td>Animated WebP keeps its animation when only cleaned.</td></tr>
          <tr><td>GIF, BMP, AVIF, ICO and other browser-readable formats</td><td><N>Dimensions only</N></td><td><N>Converted to PNG, JPG or WebP</N></td><td><N>Converted to PNG first</N></td><td>Animated GIFs keep only the first frame. HEIC and TIFF work only if your browser can decode them.</td></tr>
        </tbody>
      </table>
    </div>
  )
}

export function PrivacyFlow() {
  return (
    <div className="flow" role="group" aria-label="How data moves">
      <div className="lane local">
        <p className="lane-title"><Icon name="device" size={18} /> Your device (this browser tab)</p>
        <ol>
          <li><Icon name="upload" size={16} /> Import images</li>
          <li><Icon name="eye" size={16} /> Read metadata</li>
          <li><Icon name="eraser" size={16} /> Clean, edit, optimize</li>
          <li><Icon name="download" size={16} /> Download the result</li>
        </ol>
        <p className="meta">No application server. No image upload. Nothing is stored after you close the tab, apart from templates and settings you save.</p>
      </div>
      <div className="arrow" aria-hidden="true"><span>Only when you use the AI Agent</span></div>
      <div className="lane remote">
        <p className="lane-title"><Icon name="cloud" size={18} /> Pollinations (external service)</p>
        <ul>
          <li className="sent"><Icon name="check" size={14} /> Your typed questions</li>
          <li className="sent"><Icon name="check" size={14} /> A summary of which metadata exists</li>
          <li className="opt"><Icon name="lock" size={14} /> Field values, only if you switch it on (off by default)</li>
          <li className="never"><Icon name="x" size={14} /> Image pixels are never sent</li>
        </ul>
      </div>
    </div>
  )
}
