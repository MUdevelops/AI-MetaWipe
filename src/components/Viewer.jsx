import { useEffect, useState } from 'react'
import { Panel, NeedImage, Pills, Table, Flash, fmtExif, useBlobUrl } from './ui.jsx'
import { flatten, toText, toJSON, saveText } from '../lib/report.js'
import { fmtSize, hex } from '../lib/bytes.js'
import { sha256 } from '../lib/imgtools.js'

const kv = (rows) => rows.map((r) => ({ cells: [r.key, r.value] }))

export default function Viewer({ sel }) {
  const [tab, setTab] = useState('props')
  const [sha, setSha] = useState('')
  const thumbUrl = useBlobUrl(sel?.meta.thumbBytes ? new Blob([sel.meta.thumbBytes], { type: 'image/jpeg' }) : null)
  useEffect(() => setSha(''), [sel?.id])
  if (!sel) return <NeedImage />
  const m = sel.meta
  const rows = flatten(m)
  const g = (name) => rows.filter((r) => r.group === name)
  const structure = m.segments.length ? m.segments : m.chunks
  const base = m.name.replace(/\.[^.]+$/, '')

  return (
    <Panel
      title="Metadata Viewer"
      hint="Everything readable inside the file, grouped the way tools like ExifTool show it."
      actions={
        <>
          <button className="btn" onClick={() => saveText(toText(m), `${base}-metadata.txt`)}>Export TXT</button>
          <button className="btn" onClick={() => saveText(toJSON(m), `${base}-metadata.json`, 'application/json')}>Export JSON</button>
        </>
      }
    >
      <div className="viewer-top">
        <span className="checker thumb big"><img src={sel.url} alt="" /></span>
        <div>
          <p className="name">{m.name}</p>
          <p className="meta">{m.format} · {m.width ? `${m.width} x ${m.height}` : 'dimensions unknown'} · {fmtSize(m.size)}</p>
          {m.ai.length > 0 && <Flash kind="info">Possible AI origin: {m.ai.join(', ')}</Flash>}
          {m.parseError && <Flash kind="danger">Could not fully read this file: {m.parseError}</Flash>}
        </div>
      </div>

      <Pills
        value={tab}
        onChange={setTab}
        tabs={[['props', 'Properties'], ['exif', 'EXIF'], ['gps', 'GPS'], ['iptc', 'IPTC and XMP'], ['png', 'PNG text'], ['inspect', 'Inspector']]}
      />

      {tab === 'props' && <Table head={['Property', 'Value']} rows={kv(g('File'))} />}

      {tab === 'exif' && (
        <>
          <p className="meta">Camera, lens, ISO, shutter speed and other capture details.</p>
          <Table head={['Tag', 'Value']} rows={g('EXIF').map((r) => ({ cells: [r.key, fmtExif(r.key, m.exif.ifd0[r.key] ?? m.exif.exif[r.key] ?? r.value)] }))} empty="No EXIF data in this file." />
        </>
      )}

      {tab === 'gps' && (
        m.gps ? (
          <>
            <Flash kind="danger">This image contains GPS coordinates. Anyone who gets the file can see where it was taken.</Flash>
            <Table head={['Field', 'Value']} rows={[
              { cells: ['Latitude', m.gps.lat.toFixed(6)] },
              { cells: ['Longitude', m.gps.lon.toFixed(6)] },
              ...(m.gps.alt !== null ? [{ cells: ['Altitude', `${m.gps.alt.toFixed(1)} m`] }] : []),
              ...g('GPS').filter((r) => r.key !== 'Decimal coordinates').map((r) => ({ cells: [r.key, fmtExif(r.key, m.exif.gps[r.key] ?? r.value)] })),
            ]} />
            <a className="btn" target="_blank" rel="noopener noreferrer" href={`https://www.openstreetmap.org/?mlat=${m.gps.lat}&mlon=${m.gps.lon}#map=16/${m.gps.lat}/${m.gps.lon}`}>Open in OpenStreetMap</a>
          </>
        ) : (
          <p className="meta">{m.hasGpsTags ? 'GPS fields exist but could not be decoded into coordinates.' : 'No GPS location found.'}</p>
        )
      )}

      {tab === 'iptc' && (
        <>
          <h3>IPTC</h3>
          <Table head={['Field', 'Value']} rows={kv(g('IPTC'))} empty="No IPTC data." />
          <h3>XMP</h3>
          <Table head={['Field', 'Value']} rows={kv(g('XMP'))} empty="No XMP data." />
        </>
      )}

      {tab === 'png' && (
        m.type !== 'png' ? <p className="meta">This is not a PNG file. PNG text chunks only exist in PNG images.</p> : (
          <>
            <Table head={['Property', 'Value']} rows={[
              { cells: ['Colour type', m.colorType] }, { cells: ['Bit depth', m.bitDepth] },
              { cells: ['Interlaced', m.interlaced ? 'yes' : 'no'] }, { cells: ['Alpha channel', m.alphaChannel ? 'yes' : m.hasTrns ? 'palette transparency' : 'no'] },
              ...(m.dpi ? [{ cells: ['Resolution', `${m.dpi} dpi`] }] : []), ...(m.pngTime ? [{ cells: ['Last modified chunk', m.pngTime] }] : []),
            ]} />
            <h3>Text chunks ({m.pngText.length})</h3>
            {!m.pngText.length && <p className="meta">No text chunks.</p>}
            {m.pngText.map((t, i) => (
              <details key={i} className="chunk" open={t.text.length < 400}>
                <summary><b>{t.keyword}</b> <small>{t.kind}{t.compressed ? ', compressed' : ''}, {t.text.length} characters</small></summary>
                <pre>{t.text}</pre>
              </details>
            ))}
          </>
        )
      )}

      {tab === 'inspect' && (
        <>
          <p className="meta">Technical structure of the file, in order.</p>
          <Table head={['Block', 'Offset', 'Size']} rows={structure.map((s) => ({ cells: [s.name, s.offset, fmtSize(s.size)] }))} empty="No structure to show for this format." />
          {m.appended > 0 && <Flash kind="danger">{m.appended} bytes of extra data follow the end of the image.</Flash>}
          <h3>File header</h3>
          <pre className="mono">{hex(m.bytes, 32)}</pre>
          <div className="row">
            <button className="btn" onClick={async () => setSha(await sha256(m.bytes))}>Compute SHA-256</button>
            {sha && <code className="mono">{sha}</code>}
          </div>
          {thumbUrl && (<><h3>Embedded thumbnail</h3><span className="checker thumb big"><img src={thumbUrl} alt="Embedded thumbnail" /></span></>)}
          {m.xmp && (<><h3>Raw XMP</h3><pre className="mono scroll">{m.xmp.raw}</pre></>)}
        </>
      )}
    </Panel>
  )
}
