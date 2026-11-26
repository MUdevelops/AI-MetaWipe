import { useRef, useState } from 'react'
import { Icon } from '../Icon.jsx'
import { Sec, Accordion, FormatsTable, PrivacyFlow } from './shared.jsx'
import { CATS, TOOLS } from '../../lib/tools.js'
import { fmtSize } from '../../lib/bytes.js'

const hasGps = (m) => !!(m.gps || m.hasGpsTags)
const hasMeta = (m) => !!(m.exif || m.xmp || m.iptc || m.pngText.length || m.comments.length || m.c2pa || m.thumbBytes || m.appended || hasGps(m))
const tone = (s) => (s >= 90 ? 'good' : s >= 45 ? 'mid' : 'bad')

const INTEL = [
  ['EXIF', 'tag', 'Camera, lens, exposure settings and dates.', (m) => !!m.exif],
  ['GPS', 'pin', 'The coordinates where a photo was taken.', hasGps],
  ['IPTC', 'file', 'Captions, credits and keywords added by photo editors.', (m) => !!m.iptc],
  ['XMP', 'file', 'Adobe-style tags, also written by many AI tools.', (m) => !!m.xmp],
  ['PNG text chunks', 'file', 'Prompts and workflows stored by AI image tools.', (m) => m.pngText.length > 0],
  ['C2PA credentials', 'shield', 'Signed records of how an image was made or edited.', (m) => !!m.c2pa],
  ['Camera and technical', 'device', 'Make, model, lens, ISO and the file structure.', (m) => !!(m.exif && (m.exif.ifd0.Make || m.exif.ifd0.Model || m.exif.exif.ISO))],
  ['AI prompt information', 'bot', 'Prompt, sampler and generator hints, where present.', (m) => m.ai.length > 0],
]

const CLEAN = [['exif', 'EXIF', 'Camera, lens, settings, dates'], ['gps', 'GPS location', 'Only the location tags'], ['thumbnail', 'Thumbnail', 'The preview inside EXIF'], ['iptc', 'IPTC', 'Captions and credits'], ['xmp', 'XMP', 'Adobe-style tags'], ['text', 'PNG text', 'AI prompts and workflows'], ['c2pa', 'C2PA', 'Content credentials'], ['comments', 'Comments', 'JPEG comment blocks']]

const USES = [
  ['shield', 'Privacy before sharing photos', 'See what a photo reveals, then remove it.', 'privacy'],
  ['pin', 'Removing GPS information', 'Hide where a picture was taken.', 'remove', { gps: true }],
  ['image', 'Preparing images for social media', 'Strip metadata, resize and convert.', 'optimize'],
  ['bot', 'Cleaning AI-generated image metadata', 'Remove prompts and content credentials.', 'remove', { text: true, xmp: true, c2pa: true }],
  ['folder', 'Organizing image libraries', 'Find duplicates and compare files.', 'duplicates'],
  ['zap', 'Optimizing images for websites', 'Compress and convert to WebP.', 'optimize'],
  ['compare', 'Comparing metadata between images', 'Spot exactly what differs.', 'compare'],
]

function Gauge({ score, label }) {
  return (
    <div className={`gauge s-${tone(score)}`}>
      <div className="gauge-num">{score}<small>/100</small></div>
      <div className="gauge-bar"><span style={{ width: `${score}%` }} /></div>
      <b>{label}</b>
    </div>
  )
}

export default function Overview({ items, loading, lastVerify, onAdd, setView, openTool, onInspect, onAgentPrompt }) {
  const [over, setOver] = useState(false)
  const input = useRef(null)
  const total = items.length
  const withMeta = items.filter((i) => hasMeta(i.meta)).length
  const gps = items.filter((i) => hasGps(i.meta)).length
  const avg = total ? Math.round(items.reduce((s, i) => s + i.score, 0) / total) : 0
  const dist = { good: items.filter((i) => i.score >= 90).length, mid: items.filter((i) => i.score >= 45 && i.score < 90).length, bad: items.filter((i) => i.score < 45).length }
  const high = items.filter((i) => i.risks.some((r) => r.level === 'high')).length
  const agg = {}
  items.forEach((i) => i.risks.forEach((r) => { agg[r.title] = agg[r.title] || { level: r.level, n: 0 }; agg[r.title].n++ }))
  const topRisks = Object.entries(agg).sort((a, b) => b[1].n - a[1].n).slice(0, 5)
  const avgLabel = avg >= 90 ? 'Excellent' : avg >= 70 ? 'Good' : avg >= 45 ? 'Fair' : 'Poor'
  const recent = [...items].reverse().slice(0, 8)
  const status = loading ? `Reading ${loading} file${loading > 1 ? 's' : ''}…` : !total ? 'Empty workspace' : gps ? 'Attention: GPS found' : withMeta ? 'Metadata found' : 'All images are clean'

  const drop = (e) => { e.preventDefault(); setOver(false); onAdd(e.dataTransfer.files) }

  return (
    <div className="overview">
      {/* 01 */}
      <section className="hero" id="sec-01" aria-labelledby="h-hero">
        <div className="hero-copy">
          <span className="chip-pill"><Icon name="lock" size={14} /> Privacy-first. Images stay in your browser.</span>
          <p className="eyebrow">AI MetaWipe</p>
          <h1 id="h-hero">Take Control of What’s Hidden Inside Your Images.</h1>
          <p className="lead">Inspect, clean, edit, optimize, and protect your images with a privacy-first toolkit that works directly in your browser.</p>
          <div className="row">
            <button className="btn primary lg" onClick={() => (total ? openTool('remove') : input.current.click())}>Start Cleaning</button>
            <button className="btn lg" onClick={() => setView('tools')}>Explore All Tools</button>
          </div>
          <div className={`drop hero-drop ${over ? 'over' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)} onDrop={drop}>
            <Icon name="upload" size={26} />
            <div className="grow">
              <b>{loading ? `Reading ${loading} file${loading > 1 ? 's' : ''}…` : 'Drop images or a folder here'}</b>
              <span className="meta">PNG, JPG, WebP, GIF, BMP, AVIF and more. No limit on how many.</span>
            </div>
            <button className="btn" onClick={() => input.current.click()}>Choose images</button>
            <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => { onAdd(e.target.files); e.target.value = '' }} />
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="insp">
            <div className="insp-head"><Icon name="image" size={16} /> holiday-photo.jpg <em>Illustration</em></div>
            <div className="scan" />
            {[['Camera', '█████████ ████'], ['Lens', '██████████████'], ['GPS', '31.4° N, 74.3° E'], ['Taken', '2026-03-14 18:42'], ['Software', '████████'], ['Author', '██████ ████']].map(([k, v], i) => (
              <div key={k} className={`insp-row ${k === 'GPS' ? 'warn' : ''}`} style={{ '--i': i }}><span>{k}</span><b>{v}</b></div>
            ))}
            <div className="insp-foot"><span className="pill bad">Privacy 24</span><Icon name="right" size={16} /><span className="pill good">Clean 100</span></div>
          </div>
        </div>
      </section>

      {/* 02 */}
      <Sec n="02" id="02" title="Workspace overview" sub="Live numbers from the images you have loaded.">
        <div className="stat-grid">
          <div className="stat"><Icon name="image" /><b>{total}</b><span>Images loaded</span></div>
          <div className="stat"><Icon name="tag" /><b>{withMeta}</b><span>Contain metadata</span></div>
          <div className={`stat ${gps ? 'warn' : ''}`}><Icon name="pin" /><b>{gps}</b><span>Contain GPS</span></div>
          <div className={`stat ${gps ? 'warn' : total ? 'ok' : ''}`}><Icon name="zap" /><b className="small">{status}</b><span>Workspace status</span></div>
        </div>
        {total > 0 ? (
          <div className="dist">
            <p className="meta">Privacy score distribution (average {avg})</p>
            <div className="dist-bar" role="img" aria-label={`${dist.good} good, ${dist.mid} fair, ${dist.bad} poor`}>
              {dist.good > 0 && <span className="good" style={{ flexGrow: dist.good }}>{dist.good}</span>}
              {dist.mid > 0 && <span className="mid" style={{ flexGrow: dist.mid }}>{dist.mid}</span>}
              {dist.bad > 0 && <span className="bad" style={{ flexGrow: dist.bad }}>{dist.bad}</span>}
            </div>
            <p className="legend"><i className="good" />90+ good <i className="mid" />45 to 89 fair <i className="bad" />under 45 poor</p>
          </div>
        ) : <p className="meta">Add images to see your workspace numbers.</p>}
      </Sec>

      {/* 03 */}
      <Sec n="03" id="03" title="Quick actions" sub="Jump straight into the most common jobs.">
        <div className="qa-grid">
          {[['eye', 'Inspect Metadata', 'See every hidden field.', 'viewer'], ['eraser', 'Remove Metadata', 'Choose what to remove.', 'remove'], ['sliders', 'Optimize Image', 'Compress, convert, resize.', 'optimize'], ['compare', 'Compare Images', 'Spot the differences.', 'compare'], ['shield', 'Check Privacy', 'Score and risk analysis.', 'privacy'], ['bot', 'Open AI Agent', 'Ask about your metadata.', 'agent']].map(([ic, t, d, id]) => (
            <button key={id} className="qa" onClick={() => openTool(id)}>
              <span className="tool-ico"><Icon name={ic} size={22} /></span><b>{t}</b><span>{d}</span><Icon name="right" size={16} className="go" />
            </button>
          ))}
        </div>
      </Sec>

      {/* 04 */}
      <Sec n="04" id="04" title="Recent files" sub="The images in your workspace, newest first.">
        {!total ? (
          <div className="empty-state"><Icon name="image" size={30} /><h3>No images yet</h3><p>Drop images above, or choose files to start.</p><button className="btn primary" onClick={() => input.current.click()}>Choose images</button></div>
        ) : (
          <>
            <div className="file-grid">
              {recent.map((it) => (
                <article key={it.id} className="file">
                  <div className="checker file-thumb"><img src={it.url} alt="" loading="lazy" decoding="async" onError={(e) => { e.currentTarget.style.display = 'none' }} /></div>
                  <div className="file-info">
                    <b className="name" title={it.meta.name}>{it.meta.name}</b>
                    <span className="meta">{it.meta.format} · {fmtSize(it.meta.size)}</span>
                    <span className="tags">
                      <i className={`tag s-${tone(it.score)}`}>Privacy {it.score}</i>
                      {hasGps(it.meta) ? <i className="tag s-bad">GPS</i> : hasMeta(it.meta) ? <i className="tag s-mid">Has metadata</i> : <i className="tag s-good">Clean</i>}
                    </span>
                  </div>
                  <div className="file-actions">
                    <button className="btn small" onClick={() => onInspect(it.id, 'viewer')}>Inspect</button>
                    <button className="btn small" onClick={() => onInspect(it.id, 'remove')}>Clean</button>
                    <button className="btn small" onClick={() => onInspect(it.id, 'privacy')}>Privacy</button>
                  </div>
                </article>
              ))}
            </div>
            {total > recent.length && <p className="meta">Showing the newest {recent.length} of {total}. <button className="linkish" onClick={() => setView('library')}>Open the full library</button></p>}
          </>
        )}
      </Sec>

      {/* 05 */}
      <Sec n="05" id="05" title="Tools at a glance" sub="Six categories, twelve tools.">
        <div className="cat-grid">
          {CATS.map((c) => {
            const ts = TOOLS.filter((t) => t.cat === c.id)
            return (
              <button key={c.id} className={`cat-card a-${c.accent}`} onClick={() => openTool(ts[0].id)}>
                <span className="tool-ico"><Icon name={ts[0].icon} size={22} /></span>
                <b>{c.label}</b>
                <span className="meta">{ts.length} tool{ts.length > 1 ? 's' : ''}: {ts.map((t) => t.name.split(',')[0]).join(', ')}</span>
              </button>
            )
          })}
        </div>
        <div className="row"><button className="btn primary" onClick={() => setView('tools')}>Explore All Tools <Icon name="right" size={16} /></button></div>
      </Sec>

      {/* 06 */}
      <Sec n="06" id="06" title="Complete tools directory" sub="Search and filter all 12 tools on a dedicated page. Or open any of them right here.">
        <div className="chips-wrap">{TOOLS.map((t) => <button key={t.id} className="chip" onClick={() => openTool(t.id)}><Icon name={t.icon} size={14} /> {t.name}</button>)}</div>
        <div className="row"><button className="btn" onClick={() => setView('tools')}>Open the Tools directory</button></div>
      </Sec>

      {/* 07 */}
      <Sec n="07" id="07" title="How it works" sub="Four steps from import to a verified result.">
        <ol className="steps4">
          {[['upload', 'Import your image', 'Drop files or a folder. Nothing is uploaded.'], ['eye', 'Inspect hidden metadata', 'See EXIF, GPS, IPTC, XMP and more.'], ['eraser', 'Clean, edit or optimize', 'Pick exactly what to change.'], ['shield', 'Verify and download', 'Check the result, then save it.']].map(([ic, t, d], i) => (
            <li key={t}><span className="step-badge">{i + 1}</span><Icon name={ic} size={24} /><b>{t}</b><span>{d}</span></li>
          ))}
        </ol>
      </Sec>

      {/* 08 */}
      <Sec n="08" id="08" title="Metadata intelligence" sub={total ? 'What your loaded images actually contain. Click a card to inspect.' : 'The kinds of hidden data you can inspect. Load images to see live counts.'} alt>
        <div className="intel-grid">
          {INTEL.map(([name, ic, desc, test]) => {
            const n = items.filter((i) => test(i.meta)).length
            return (
              <button key={name} className="intel" onClick={() => openTool('viewer')}>
                <span className="tool-ico"><Icon name={ic} size={20} /></span>
                <b>{name}</b>
                <span className="meta">{desc}</span>
                {total > 0 && <span className="meter" role="img" aria-label={`${n} of ${total} images`}><i style={{ width: `${(n / total) * 100}%` }} /><em>{n} of {total}</em></span>}
              </button>
            )
          })}
        </div>
      </Sec>

      {/* 09 */}
      <Sec n="09" id="09" title="Clean and protect" sub="Remove everything, or only the categories you choose. Each button opens Remove Metadata with that option already ticked.">
        <div className="clean-grid">
          {CLEAN.map(([k, l, h]) => (
            <button key={k} className="clean" onClick={() => openTool('remove', { [k]: true })}><b>{l}</b><span className="meta">{h}</span></button>
          ))}
        </div>
        <div className="row">
          <button className="btn primary" onClick={() => openTool('remove', { __all: true })}>Open Remove Metadata</button>
          <span className="meta">Default cleaning keeps the pixels untouched.</span>
        </div>
      </Sec>

      {/* 10 */}
      <Sec n="10" id="10" title="Image optimization studio" sub="Make images smaller, sharper to the point, and web-ready." alt>
        <div className="qa-grid">
          {[['sliders', 'Compression', 'PNG compressor with quality levels.', 'optimize'], ['sliders', 'Format conversion', 'PNG, JPG and WebP.', 'optimize'], ['sliders', 'Resizing', 'Exact pixels or percentages.', 'optimize'], ['crop', 'Cropping', 'Drag or type exact values.', 'crop'], ['layers', 'Background and transparency', 'Plain backgrounds and alpha checks.', 'background'], ['palette', 'Color extraction', 'HEX, CSS variables and JSON.', 'palette']].map(([ic, t, d, id]) => (
            <button key={t} className="qa" onClick={() => openTool(id)}><span className="tool-ico"><Icon name={ic} size={22} /></span><b>{t}</b><span>{d}</span><Icon name="right" size={16} className="go" /></button>
          ))}
        </div>
      </Sec>

      {/* 11 */}
      <Sec n="11" id="11" title="Batch processing" sub="Work with many images at once. No fake progress: what you see is what is running.">
        <div className="three">
          <div className="card-x"><Icon name="folder" size={22} /><h3>Folder and multi-file import</h3><p className="meta">Add whole folders or thousands of files. Each image is read as it loads.</p></div>
          <div className="card-x"><Icon name="eraser" size={22} /><h3>Batch cleanup</h3><p className="meta">Choose “All images” in Remove Metadata or the Metadata Editor to process the whole workspace.</p></div>
          <div className="card-x"><Icon name="download" size={22} /><h3>ZIP download</h3><p className="meta">Results are bundled into one ZIP. Very large batches depend on your device memory.</p></div>
        </div>
        <div className="row"><button className="btn primary" onClick={() => openTool('remove')}>Open batch cleanup</button><button className="btn" onClick={() => openTool('library')}>Import a folder</button></div>
      </Sec>

      {/* 12 */}
      <Sec n="12" id="12" title="Privacy Center" sub="Risk analysis, scoring, scanning and verified sanitizing." alt>
        {total > 0 ? (
          <div className="two">
            <div className="card-x"><h3>Average privacy score</h3><Gauge score={avg} label={avgLabel} /><p className="meta">Based on {total} loaded image{total > 1 ? 's' : ''}. An estimate, not a guarantee.</p></div>
            <div className="card-x">
              <h3>What was found</h3>
              <p className="meta">{gps ? `${gps} image${gps > 1 ? 's contain' : ' contains'} GPS location data. ` : 'No GPS data found. '}{high ? `${high} with high-risk data.` : ''}</p>
              {topRisks.length ? <ul className="risk-mini">{topRisks.map(([t, v]) => <li key={t}><i className={`lvl-dot ${v.level}`} />{t}<em>{v.n}</em></li>)}</ul> : <p className="meta">No risky metadata found.</p>}
            </div>
          </div>
        ) : <div className="empty-state"><Icon name="shield" size={30} /><h3>Nothing to analyze yet</h3><p>Load an image to see its privacy score, GPS warnings and hidden data.</p></div>}
        <div className="chips-wrap">{['Privacy score', 'Sensitive metadata detection', 'GPS warnings', 'Hidden metadata scan', 'Sanitize and verify', 'Before and after proof'].map((x) => <span key={x} className="chip static"><Icon name="check" size={14} /> {x}</span>)}</div>
        <div className="row"><button className="btn primary" onClick={() => openTool('privacy')}>Open Privacy Center</button></div>
      </Sec>

      {/* 13 */}
      <Sec n="13" id="13" title="Before and after" sub={lastVerify ? `Real result from your last verified clean: ${lastVerify.name}` : 'Run “Sanitize and verify” in the Privacy Center to see your own result here. Below is an illustration.'}>
        <div className="ba">
          <div className="ba-col before">
            <p className="ba-title">Before cleaning</p>
            {lastVerify ? <Gauge score={lastVerify.scoreBefore} label="Privacy score" /> : <span className="pill bad">Example score 24</span>}
            <ul>
              {lastVerify ? <li>{lastVerify.removed.filter((r) => !r.startsWith('(')).length} metadata item{lastVerify.removed.length === 1 ? '' : 's'} detected</li> : <><li>Camera model and lens</li><li>GPS coordinates</li><li>Capture date and time</li></>}
            </ul>
          </div>
          <Icon name="right" size={28} className="ba-arrow" />
          <div className="ba-col after">
            <p className="ba-title">After cleaning</p>
            {lastVerify ? <Gauge score={lastVerify.scoreAfter} label="Privacy score" /> : <span className="pill good">Example score 100</span>}
            <ul>
              {lastVerify ? lastVerify.checks.slice(0, 5).map((c, i) => <li key={i} className={c.ok ? 'ok' : 'bad'}>{c.ok ? '✓' : '✗'} {c.text}</li>) : <><li className="ok">✓ All selected fields removed</li><li className="ok">✓ Pixels identical</li><li className="ok">✓ File still opens</li></>}
            </ul>
          </div>
        </div>
        {lastVerify && lastVerify.removed.length > 0 && (
          <ul className="redacted">{lastVerify.removed.filter((r) => !r.startsWith('(')).map((r, i) => <li key={i} tabIndex={0} aria-label={`Removed: ${r}`}>{r}</li>)}</ul>
        )}
        {!lastVerify && <p className="meta"><em>Illustration with example values, not your data.</em></p>}
      </Sec>

      {/* 14 */}
      <Sec n="14" id="14" title="AI Metadata Agent" sub="Ask in plain words what your metadata means and what to remove." alt>
        <div className="two">
          <div className="card-x">
            <h3>Ask something</h3>
            <div className="chips-wrap col">
              {['Explain the metadata in my selected image in simple words.', 'Is it safe to share this image publicly?', 'What exactly should I remove, and what can I keep?', 'Does this image look AI generated?'].map((q) => <button key={q} className="chip" onClick={() => onAgentPrompt(q)}>{q}</button>)}
            </div>
          </div>
          <div className="card-x">
            <h3>You approve every action</h3>
            <ol className="steps-list plain">
              <li><span className="step-n">1</span>The agent explains and suggests, for example “Remove GPS”.</li>
              <li><span className="step-n">2</span>You press the suggestion. It fills in the Remove Metadata options.</li>
              <li><span className="step-n">3</span>Nothing runs until you press “Clean now”.</li>
            </ol>
            <p className="meta">Needs an optional Pollinations API key. Field values are only shared if you switch that on.</p>
          </div>
        </div>
        <div className="row"><button className="btn primary" onClick={() => openTool('agent')}>Open AI Agent</button></div>
      </Sec>

      {/* 15 */}
      <Sec n="15" id="15" title="Privacy architecture" sub="Exactly where your data goes.">
        <PrivacyFlow />
      </Sec>

      {/* 16 */}
      <Sec n="16" id="16" title="Supported formats" sub="What each format supports in this version." alt>
        <FormatsTable />
      </Sec>

      {/* 17 */}
      <Sec n="17" id="17" title="Real-world use cases">
        <div className="qa-grid">
          {USES.map(([ic, t, d, id, preset]) => (
            <button key={t} className="qa" onClick={() => openTool(id, preset)}><span className="tool-ico"><Icon name={ic} size={22} /></span><b>{t}</b><span>{d}</span><Icon name="right" size={16} className="go" /></button>
          ))}
        </div>
      </Sec>

      {/* 18 */}
      <Sec n="18" id="18" title="Getting started" sub="Five steps for first-time users." alt>
        <ol className="steps5">
          {['Add images', 'Select a file', 'Explore its metadata', 'Choose a tool', 'Download the result'].map((s, i) => <li key={s}><span className="step-badge">{i + 1}</span>{s}</li>)}
        </ol>
        <div className="row"><button className="btn primary" onClick={() => (total ? openTool('viewer') : input.current.click())}>{total ? 'Explore metadata' : 'Add images'}</button></div>
      </Sec>

      {/* 19 */}
      <Sec n="19" id="19" title="Frequently asked questions">
        <Accordion />
      </Sec>
    </div>
  )
}
