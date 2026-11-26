import { useEffect, useState } from 'react'
import { Panel, Pick, NeedImage, Flash, Table, Check, Result, useBlobUrl } from './ui.jsx'
import { NONE_OPTS } from '../lib/edit.js'
import { cleanFile } from '../lib/pipeline.js'
import { readMetadata } from '../lib/meta.js'
import { analyzeRisks, privacyScore, optsFromRisks } from '../lib/privacy.js'
import { compareMeta } from '../lib/report.js'
import { pixelHash } from '../lib/imgtools.js'
import { fmtSize } from '../lib/bytes.js'
import { useToast } from './Toast.jsx'

const LABELS = { exif: 'EXIF', gps: 'GPS location', thumbnail: 'Embedded thumbnail', iptc: 'IPTC', xmp: 'XMP', text: 'PNG text chunks', c2pa: 'C2PA credentials', comments: 'Comments', icc: 'ICC profile', other: 'Other hidden data' }

const VERIFY = {
  exif: (m) => !m.exif || (Object.keys(m.exif.ifd0).every((k) => k === 'Orientation') && !Object.keys(m.exif.exif).length && !m.hasGpsTags),
  gps: (m) => !m.gps && !m.hasGpsTags,
  thumbnail: (m) => !m.thumbBytes,
  iptc: (m) => !m.iptc,
  xmp: (m) => !m.xmp,
  text: (m) => !m.pngText.length,
  c2pa: (m) => !m.c2pa,
  comments: (m) => !m.comments.length,
  icc: (m) => !m.icc,
  other: (m) => !m.appended,
}

function Gauge({ score, label }) {
  const tone = score >= 90 ? 'good' : score >= 45 ? 'mid' : 'bad'
  return (
    <div className={`gauge s-${tone}`}>
      <div className="gauge-num">{score}<small>/100</small></div>
      <div className="gauge-bar"><span style={{ width: `${score}%` }} /></div>
      <b>{label}</b>
    </div>
  )
}

export default function Privacy({ items, sel, onSel, onVerified }) {
  const toast = useToast()
  const [opts, setOpts] = useState({})
  const [res, setRes] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const thumbUrl = useBlobUrl(sel?.meta.thumbBytes ? new Blob([sel.meta.thumbBytes], { type: 'image/jpeg' }) : null)
  useEffect(() => { setOpts(optsFromRisks(sel?.risks || [])); setRes(null); setErr('') }, [sel?.id])
  if (!sel) return <NeedImage />
  const m = sel.meta
  const flagged = (m.segments.length ? m.segments : m.chunks).filter((s) => !/^(SOI|DQT|DHT|SOF|SOS|DRI|IHDR|PLTE|IDAT|IEND|VP8|VP8L|VP8X|ALPH|ANIM|ANMF|pHYs|gAMA|cHRM|sRGB|bKGD|tRNS|sBIT|acTL|fcTL|fdAT)/.test(s.name))
  const withGps = items.filter((i) => i.meta.gps || i.meta.hasGpsTags)

  async function sanitize() {
    setBusy(true); setErr(''); setRes(null)
    try {
      const o = { ...NONE_OPTS, ...opts }
      if (o.exif) { o.gps = true; o.thumbnail = true }
      const r = await cleanFile(sel.file, m.bytes, { opts: o, redraw: false })
      const f = new File([r.blob], r.name, { type: r.blob.type })
      const after = await readMetadata(f)
      const risksAfter = analyzeRisks(after)
      const scoreAfter = privacyScore(risksAfter)
      const checks = []
      let decoded = false
      try {
        const [a, b] = await Promise.all([pixelHash(sel.file), pixelHash(f)])
        decoded = true
        checks.push({ ok: true, text: 'The cleaned file opens and decodes correctly.' })
        checks.push({ ok: a.w === b.w && a.h === b.h, text: `Dimensions unchanged (${a.w} x ${a.h}).` })
        checks.push({ ok: a.hash === b.hash, text: a.hash === b.hash ? 'Pixels are identical to the original. No quality was lost.' : 'Pixels differ from the original (the image was converted or redrawn).' })
      } catch {
        checks.push({ ok: false, text: 'The cleaned file could not be decoded by this browser.' })
      }
      for (const k of Object.keys(o)) if (o[k] && VERIFY[k]) checks.push({ ok: VERIFY[k](after), text: `${LABELS[k]} ${VERIFY[k](after) ? 'is gone from the cleaned file.' : 'is still present.'}` })
      const failed = checks.filter((c) => !c.ok).length
      onVerified?.({ name: m.name, scoreBefore: sel.score, scoreAfter: scoreAfter.score, removed: r.removed, checks })
      toast(failed ? `Cleaned, but ${failed} check${failed > 1 ? 's' : ''} need attention.` : 'Cleaned and verified. All checks passed.', failed ? 'danger' : 'ok')
      setRes({ r, after, scoreAfter, checks, rows: compareMeta(m, after).filter((x) => x.status !== 'same' && x.group !== 'File'), decoded })
    } catch (e) { setErr(e.message) }
    setBusy(false)
  }

  const set = (k, v) => setOpts((o) => ({ ...o, [k]: v }))
  const nothing = !Object.values(opts).some(Boolean)

  return (
    <Panel title="Privacy Center" hint="What this image reveals about you, how risky it is, and a one-click fix with proof.">
      {withGps.length > 0 && (
        <Flash kind="danger">GPS alert: {withGps.length === 1 ? '1 image in your library contains' : `${withGps.length} images in your library contain`} location data ({withGps.slice(0, 3).map((i) => i.meta.name).join(', ')}{withGps.length > 3 ? ', …' : ''}).</Flash>
      )}
      {items.length > 1 && <Pick items={items} value={sel.id} onChange={onSel} />}

      <div className="two">
        <div className="card"><h3>Estimated privacy score</h3><Gauge score={sel.score} label={sel.label} /><p className="meta">An estimate based on the kinds of data found. It is not a guarantee, and it cannot see invisible pixel watermarks.</p></div>
        <div className="card">
          <h3>Risk analyzer</h3>
          {!sel.risks.length && <Flash kind="ok">No risky metadata found.</Flash>}
          <ul className="risks">
            {sel.risks.map((r) => (
              <li key={r.id} className={`risk ${r.level}`}>
                <span className="lvl">{r.level}</span>
                <span><b>{r.title}</b><small>{r.detail}</small></span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <h3>Hidden data scanner</h3>
      <Table head={['Block', 'Size', 'Notes']} rows={[
        ...flagged.map((s) => ({ cells: [s.name, fmtSize(s.size), /EXIF|XMP|Photoshop|JUMBF|COM|tEXt|iTXt|zTXt|eXIf|caBX/.test(s.name) ? 'Readable metadata' : 'Extra block'] })),
        ...(m.appended ? [{ cells: ['After image end', fmtSize(m.appended), 'Hidden appended data'] }] : []),
      ]} empty="No hidden blocks found beyond the image itself." />

      <h3>Thumbnail scanner</h3>
      {thumbUrl ? (
        <div className="row">
          <span className="checker thumb big"><img src={thumbUrl} alt="Embedded thumbnail" /></span>
          <p className="meta grow">An embedded {fmtSize(m.thumbBytes.length)} thumbnail was found. If you cropped this photo, the thumbnail may still show the uncropped original.</p>
        </div>
      ) : <p className="meta">No embedded thumbnail.</p>}

      <h3>Sanitize</h3>
      <p className="meta">Pre-selected from the risks above. Change the selection if you like.</p>
      <div className="checks">
        {Object.entries(LABELS).map(([k, l]) => (
          <Check key={k} checked={!!(opts[k] || (opts.exif && (k === 'gps' || k === 'thumbnail')))} disabled={opts.exif && (k === 'gps' || k === 'thumbnail')} onChange={(v) => set(k, v)}>{l}</Check>
        ))}
      </div>
      {err && <Flash kind="danger">{err}</Flash>}
      <div className="row">
        <button className="btn primary" disabled={busy || nothing} onClick={sanitize}>{busy ? 'Cleaning and checking…' : 'Sanitize and verify'}</button>
        <button className="btn" onClick={() => setOpts(optsFromRisks(sel.risks))}>Select all risks</button>
      </div>

      {res && (
        <>
          <h3>Before and after</h3>
          <div className="two">
            <div className="card"><p className="meta">Before</p><Gauge score={sel.score} label={sel.label} /></div>
            <div className="card"><p className="meta">After</p><Gauge score={res.scoreAfter.score} label={res.scoreAfter.label} /></div>
          </div>
          <Result blob={res.r.blob} name={res.r.name} beforeSize={res.r.originalSize} />
          <h3>Integrity check</h3>
          <ul className="checklist">{res.checks.map((c, i) => <li key={i} className={c.ok ? 'ok' : 'bad'}><span aria-hidden="true">{c.ok ? '✓' : '✗'}</span> {c.text}</li>)}</ul>
          <h3>What changed</h3>
          <Table head={['Group', 'Field', 'Before', 'After']} rows={res.rows.map((x) => ({ cls: `st-${x.status}`, cells: [x.group, x.key, x.a || '-', x.b || '(removed)'] }))} empty="No readable fields changed." />
        </>
      )}
    </Panel>
  )
}
