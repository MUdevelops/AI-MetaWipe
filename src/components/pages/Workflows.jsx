import { Icon } from '../Icon.jsx'
import { toolById } from '../../lib/tools.js'

const FLOWS = [
  { icon: 'shield', title: 'Share a photo safely', desc: 'Check what a photo reveals, remove it, and prove it is gone.', steps: [
    { tool: 'privacy', text: 'Check the privacy score and risks' },
    { tool: 'remove', preset: 'all', text: 'Clean everything (preset "Everything" is filled in for you)' },
    { tool: 'privacy', text: 'Press "Sanitize and verify" to confirm the result' },
  ] },
  { icon: 'pin', title: 'Remove GPS only', desc: 'Keep camera details but hide where the photo was taken.', steps: [
    { tool: 'viewer', text: 'Open the GPS tab to see what is stored' },
    { tool: 'remove', preset: 'gps', text: 'Clean with the GPS-only option ticked' },
  ] },
  { icon: 'bot', title: 'Clean an AI-generated image', desc: 'Remove prompts, workflows and content credentials from a PNG.', steps: [
    { tool: 'viewer', text: 'Look at the PNG text tab to see the stored prompt' },
    { tool: 'remove', preset: 'ai', text: 'Clean PNG text, XMP and C2PA' },
    { tool: 'compare', text: 'Compare the original and the clean copy' },
  ] },
  { icon: 'image', title: 'Prepare for social media', desc: 'Strip metadata, size the picture and pick a light format.', steps: [
    { tool: 'remove', preset: 'all', text: 'Remove metadata' },
    { tool: 'optimize', text: 'Resize and convert to WebP or JPG' },
  ] },
  { icon: 'zap', title: 'Optimize for a website', desc: 'Make images small and tidy before publishing.', steps: [
    { tool: 'duplicates', text: 'Remove duplicates from the list' },
    { tool: 'crop', text: 'Crop to the layout you need' },
    { tool: 'optimize', text: 'Compress or convert to WebP' },
    { tool: 'palette', text: 'Extract brand colours for your CSS' },
  ] },
  { icon: 'pencil', title: 'Stamp copyright on a batch', desc: 'Write your name and copyright into many images at once.', steps: [
    { tool: 'library', text: 'Import the whole folder' },
    { tool: 'editor', text: 'Fill the fields, choose "All images" and write' },
  ] },
]

export default function Workflows({ onStep, total }) {
  return (
    <div className="page">
      <div className="page-head">
        <p className="eyebrow">Workflows</p>
        <h1>Guided workflows</h1>
        <p className="sub">Common jobs as short checklists. Every step opens the real tool; you stay in control and press the buttons yourself.{!total && ' Add an image first.'}</p>
      </div>
      <div className="flow-grid">
        {FLOWS.map((f) => (
          <article key={f.title} className="card-x">
            <div className="tool-top"><span className="tool-ico"><Icon name={f.icon} size={22} /></span></div>
            <h3>{f.title}</h3>
            <p className="meta">{f.desc}</p>
            <ol className="steps-list">
              {f.steps.map((s, i) => (
                <li key={i}>
                  <span className="step-n">{i + 1}</span>
                  <span className="grow">{s.text}</span>
                  <button className="btn small" onClick={() => onStep(s)}>{toolById(s.tool).name.split(',')[0]} <Icon name="right" size={14} /></button>
                </li>
              ))}
            </ol>
          </article>
        ))}
      </div>
    </div>
  )
}
