import { fmtSize } from './bytes.js'

export function flatten(m) {
  const rows = []
  const add = (group, key, value) => value !== undefined && value !== null && value !== '' && rows.push({ group, key, value: Array.isArray(value) ? value.map((x) => (typeof x === 'number' ? +x.toFixed(5) : x)).join(', ') : String(value) })
  add('File', 'Name', m.name)
  add('File', 'Format', m.format)
  add('File', 'Size', fmtSize(m.size))
  add('File', 'Dimensions', m.width ? `${m.width} x ${m.height}` : '')
  add('File', 'Colour type', m.colorType)
  add('File', 'Bit depth', m.bitDepth)
  add('File', 'Alpha channel', m.alphaChannel === undefined ? '' : m.alphaChannel ? 'yes' : 'no')
  add('File', 'Animated', m.animated ? 'yes' : '')
  add('File', 'Interlaced / progressive', m.interlaced || m.progressive ? 'yes' : '')
  add('File', 'Resolution (dpi)', m.dpi)
  add('File', 'ICC profile', m.icc ? 'yes' : '')
  add('File', 'C2PA credentials', m.c2pa ? 'yes' : '')
  if (m.exif) {
    for (const [k, v] of Object.entries(m.exif.ifd0)) add('EXIF', k, v)
    for (const [k, v] of Object.entries(m.exif.exif)) add('EXIF', k, v)
    for (const [k, v] of Object.entries(m.exif.gps)) add('GPS', k, v)
  }
  if (m.gps) add('GPS', 'Decimal coordinates', `${m.gps.lat.toFixed(6)}, ${m.gps.lon.toFixed(6)}`)
  for (const f of m.iptc?.fields || []) add('IPTC', f.name, f.value)
  for (const [k, v] of Object.entries(m.xmp?.fields || {})) add('XMP', k, v)
  for (const t of m.pngText || []) add('PNG text', t.keyword, t.text.length > 300 ? `${t.text.slice(0, 300)}...` : t.text)
  m.comments?.forEach((c, i) => add('Comment', `#${i + 1}`, c))
  add('Other', 'Embedded thumbnail', m.thumbBytes ? fmtSize(m.thumbBytes.length) : '')
  add('Other', 'Data after image end', m.appended ? `${m.appended} bytes` : '')
  add('Other', 'Possible AI origin', m.ai?.join(', '))
  return rows
}

export function compareMeta(a, b) {
  const fa = new Map(flatten(a).map((r) => [`${r.group}|${r.key}`, r]))
  const fb = new Map(flatten(b).map((r) => [`${r.group}|${r.key}`, r]))
  const keys = [...new Set([...fa.keys(), ...fb.keys()])]
  return keys.map((k) => {
    const x = fa.get(k)
    const y = fb.get(k)
    const [group, key] = k.split('|')
    const status = x && y ? (x.value === y.value ? 'same' : 'diff') : x ? 'onlyA' : 'onlyB'
    return { group, key, a: x?.value ?? '', b: y?.value ?? '', status }
  })
}

export function toText(m) {
  const rows = flatten(m)
  let out = `Metadata report\n${'='.repeat(40)}\n`
  let g = ''
  for (const r of rows) {
    if (r.group !== g) { g = r.group; out += `\n[${g}]\n` }
    out += `${r.key}: ${r.value}\n`
  }
  if (m.segments?.length) out += `\n[JPEG segments]\n${m.segments.map((s) => `${s.name} (${s.size} bytes at ${s.offset})`).join('\n')}\n`
  if (m.chunks?.length) out += `\n[Chunks]\n${m.chunks.map((s) => `${s.name} (${s.size} bytes at ${s.offset})`).join('\n')}\n`
  if (m.xmp) out += `\n[Raw XMP]\n${m.xmp.raw}\n`
  return out
}

export function toJSON(m) {
  const { bytes, exifRaw, thumbBytes, ...rest } = m
  const grouped = {}
  for (const r of flatten(m)) (grouped[r.group] ||= {})[r.key] = r.value
  return JSON.stringify({ ...grouped, structure: m.segments?.length ? m.segments : m.chunks, hasThumbnail: !!thumbBytes, rawXmp: m.xmp?.raw ?? null, aiHints: m.ai }, null, 2)
}

export function saveText(text, name, mime = 'text/plain') {
  saveBlob(new Blob([text], { type: mime }), name)
}

export function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
