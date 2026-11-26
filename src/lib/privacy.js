// Risk analysis, privacy score, helpers for fixes.
const RE = {
  email: /[\w.+-]+@[\w-]+\.[\w.-]+/,
  url: /https?:\/\/[^\s"'<>]+/,
  path: /[A-Za-z]:\\[^\s"'<>]+|\/(?:Users|home)\/[^\s"'<>]+/,
}

export function textValues(m) {
  const out = []
  if (m.exif) {
    for (const [k, v] of Object.entries({ ...m.exif.ifd0, ...m.exif.exif })) if (typeof v === 'string') out.push([`EXIF ${k}`, v])
  }
  for (const f of m.iptc?.fields || []) out.push([`IPTC ${f.name}`, f.value])
  for (const [k, v] of Object.entries(m.xmp?.fields || {})) out.push([`XMP ${k}`, v])
  for (const t of m.pngText || []) out.push([`PNG ${t.keyword}`, t.text.slice(0, 20000)])
  for (const c of m.comments || []) out.push(['Comment', c])
  return out
}

export function analyzeRisks(m) {
  const r = []
  const add = (id, level, weight, title, detail, fix) => r.push({ id, level, weight, title, detail, fix })
  const e = m.exif
  if (m.gps) add('gps', 'high', 40, 'GPS location embedded', `Coordinates ${m.gps.lat.toFixed(5)}, ${m.gps.lon.toFixed(5)} point to where the photo was taken.`, ['gps'])
  else if (m.hasGpsTags) add('gps', 'high', 30, 'GPS fields present', 'Location tags exist in the file, even if they could not be decoded.', ['gps'])
  const serials = e ? ['BodySerialNumber', 'LensSerialNumber', 'CameraSerialNumber'].filter((k) => e.exif[k] || e.ifd0[k]) : []
  if (serials.length) add('serial', 'high', 15, 'Device serial number', `${serials.join(', ')} can identify the exact camera.`, ['exif'])
  const owner = e && (e.exif.CameraOwnerName || e.ifd0.Artist)
  const iptcBy = m.iptc?.fields.find((f) => f.name === 'Byline')
  const xmpBy = m.xmp?.fields['dc:creator']
  if (owner || iptcBy || xmpBy) add('owner', 'medium', 10, 'Author or owner name', 'A creator name is stored in the metadata.', ['exif', 'iptc', 'xmp'])
  if (e && (e.ifd0.Make || e.ifd0.Model || e.exif.LensModel)) add('device', 'medium', 8, 'Camera or phone model', `${[e.ifd0.Make, e.ifd0.Model].filter(Boolean).join(' ')} ${e.exif.LensModel || ''}`.trim(), ['exif'])
  if (e && (e.exif.DateTimeOriginal || e.ifd0.DateTime)) add('time', 'low', 5, 'Capture date and time', e.exif.DateTimeOriginal || e.ifd0.DateTime, ['exif'])
  if (m.pngTime) add('time2', 'low', 3, 'PNG modification time', m.pngTime, ['other'])
  if (e && e.ifd0.Software) add('software', 'low', 3, 'Software name', String(e.ifd0.Software), ['exif'])
  if (m.thumbBytes) add('thumb', 'medium', 8, 'Embedded thumbnail', 'A small preview is stored. It can still show the original, uncropped picture.', ['thumbnail'])
  const prompts = (m.pngText || []).filter((t) => ['parameters', 'prompt', 'workflow', 'Comment', 'Description', 'invokeai_metadata'].includes(t.keyword))
  if (prompts.length) add('prompt', 'medium', 12, 'AI prompt or workflow text', `Found in: ${prompts.map((p) => p.keyword).join(', ')}. This can reveal your prompt, model and settings.`, ['text'])
  if (m.c2pa) add('c2pa', 'info', 4, 'C2PA content credentials', 'A signed provenance record says how this image was made or edited.', ['c2pa'])
  const hits = []
  for (const [where, v] of textValues(m)) for (const [k, re] of Object.entries(RE)) if (re.test(v)) hits.push(`${k} in ${where}`)
  if (hits.length) add('pii', 'medium', 10, 'Email, link or file path in text fields', hits.slice(0, 4).join('; '), ['exif', 'xmp', 'iptc', 'text', 'comments'])
  if (m.xmp && Object.keys(m.xmp.fields).length) add('xmp', 'low', 4, 'XMP metadata block', `${Object.keys(m.xmp.fields).length} readable fields.`, ['xmp'])
  if (m.iptc?.fields.length) add('iptc', 'low', 6, 'IPTC metadata', `${m.iptc.fields.length} fields such as caption, credit or keywords.`, ['iptc'])
  if (m.comments?.length) add('comments', 'low', 3, 'Embedded comment', m.comments[0].slice(0, 80), ['comments'])
  if (m.appended > 0) add('appended', 'medium', 5, 'Extra data after the image', `${m.appended} bytes sit after the image end marker.`, ['other'])
  return r
}

export function privacyScore(risks) {
  const score = Math.max(0, 100 - risks.reduce((s, x) => s + x.weight, 0))
  const label = score >= 90 ? 'Excellent' : score >= 70 ? 'Good' : score >= 45 ? 'Fair' : 'Poor'
  return { score, label }
}

export function optsFromRisks(risks) {
  const o = {}
  for (const r of risks) for (const k of r.fix) o[k] = true
  if (o.exif) o.gps = true
  return o
}
