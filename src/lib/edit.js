// Selective metadata removal and metadata writing (JPEG, PNG, WebP). Pure byte logic.
import { detectType } from './strip.js'
import { openTiff } from './meta.js'
import { ascii, concat, enc } from './bytes.js'
import { crc32 } from './zip.js'

export const ALL_OPTS = { exif: true, gps: true, thumbnail: true, iptc: true, xmp: true, text: true, c2pa: true, comments: true, icc: false, other: true }
export const NONE_OPTS = Object.fromEntries(Object.keys(ALL_OPTS).map((k) => [k, false]))

/* ---------- in-place EXIF scrubbing (operates on a copy) ---------- */
export function zeroGps(t) {
  const tiff = openTiff(t)
  if (!tiff) return false
  const ifd0 = tiff.readIfd(tiff.u32(4))
  const gp = ifd0.entries.find((e) => e.tag === 0x8825)
  if (!gp) return false
  const off = tiff.u32(gp.entryOff + 8)
  const g = tiff.readIfd(off)
  if (!g.entries.length) return false
  for (const e of g.entries) if (e.size > 4 && e.vo + e.size <= t.length) t.fill(0, e.vo, e.vo + e.size)
  t.fill(0, off + 2, off + 2 + g.entries.length * 12)
  tiff.dv.setUint16(off, 0, tiff.le)
  return true
}

export function zeroThumb(t) {
  const tiff = openTiff(t)
  if (!tiff) return false
  const ifd0 = tiff.readIfd(tiff.u32(4))
  if (!ifd0.next) return false
  const ifd1 = tiff.readIfd(ifd0.next)
  const o = ifd1.entries.find((e) => e.tag === 0x0201)
  const l = ifd1.entries.find((e) => e.tag === 0x0202)
  if (o && l) {
    const off = tiff.value(o)
    const len = tiff.value(l)
    if (off && len && off + len <= t.length) t.fill(0, off, off + len)
  }
  t.fill(0, ifd0.next, ifd0.next + 2 + ifd1.entries.length * 12)
  tiff.dv.setUint32(ifd0.nextPos, 0, tiff.le)
  return true
}

const scrubXmpGps = (s) =>
  s.replace(/\s+exif:GPS\w+="[^"]*"/g, '').replace(/<exif:GPS\w+[^>]*>[\s\S]*?<\/exif:GPS\w+>/g, '')

/* ---------- TIFF / EXIF writer ---------- */
const asciiSafe = (s) => s.replace(/[^\x20-\x7e]/g, '?')

export function buildTiff(entries) {
  const list = [...entries].sort((a, b) => a.tag - b.tag).map((e) => {
    let bytes
    let count = 1
    if (e.type === 2) { bytes = concat([enc.encode(asciiSafe(String(e.value))), new Uint8Array([0])]); count = bytes.length }
    else if (e.type === 3) { bytes = new Uint8Array(2); new DataView(bytes.buffer).setUint16(0, e.value, true) }
    else { bytes = new Uint8Array(4); new DataView(bytes.buffer).setUint32(0, e.value, true) }
    return { ...e, bytes, count }
  })
  const n = list.length
  const ifdEnd = 8 + 2 + n * 12 + 4
  let dataLen = 0
  for (const e of list) if (e.bytes.length > 4) dataLen += e.bytes.length + (e.bytes.length & 1)
  const out = new Uint8Array(ifdEnd + dataLen)
  const dv = new DataView(out.buffer)
  out.set([0x49, 0x49, 0x2a, 0x00], 0)
  dv.setUint32(4, 8, true)
  dv.setUint16(8, n, true)
  let dp = ifdEnd
  list.forEach((e, i) => {
    const p = 10 + i * 12
    dv.setUint16(p, e.tag, true)
    dv.setUint16(p + 2, e.type, true)
    dv.setUint32(p + 4, e.count, true)
    if (e.bytes.length <= 4) out.set(e.bytes, p + 8)
    else {
      dv.setUint32(p + 8, dp, true)
      out.set(e.bytes, dp)
      dp += e.bytes.length + (e.bytes.length & 1)
    }
  })
  return out
}

const orientationTiff = (o) => buildTiff([{ tag: 0x0112, type: 3, value: o }])

/* ---------- JPEG helpers ---------- */
const jpegSeg = (marker, payload) => {
  const len = payload.length + 2
  if (len > 0xffff) throw new Error('Metadata too large for a JPEG segment')
  return concat([new Uint8Array([0xff, marker, len >> 8, len & 255]), payload])
}
const exifSeg = (tiff) => jpegSeg(0xe1, concat([enc.encode('Exif\0\0'), tiff]))
const xmpSeg = (xml) => jpegSeg(0xe1, concat([enc.encode('http://ns.adobe.com/xap/1.0/\0'), enc.encode(xml)]))

function insertJpeg(parts, extra) {
  // parts[0] = SOI. Put new segments after JFIF when present.
  const at = parts[1] && parts[1][1] === 0xe0 ? 2 : 1
  parts.splice(at, 0, ...extra)
}

/* ---------- selective strip ---------- */
export function selectiveStrip(b, opts, { keepOrientation = true } = {}) {
  const type = detectType(b)
  if (type === 'jpeg') return { type, ...stripJpegSel(b, opts, keepOrientation) }
  if (type === 'png') return { type, ...stripPngSel(b, opts) }
  if (type === 'webp') return { type, ...stripWebpSel(b, opts) }
  return { type, data: null, removed: [] }
}

function stripJpegSel(b, o, keepOrientation) {
  const out = [b.subarray(0, 2)]
  const removed = []
  let orientation = 1
  let i = 2
  while (i + 1 < b.length) {
    if (b[i] !== 0xff) { out.push(b.subarray(i)); break }
    const m = b[i + 1]
    if (m === 0xff) { i++; continue }
    if (m === 0xd9) { out.push(b.subarray(i, i + 2)); break }
    if (m === 0x01 || (m >= 0xd0 && m <= 0xd8)) { out.push(b.subarray(i, i + 2)); i += 2; continue }
    const len = (b[i + 2] << 8) | b[i + 3]
    const end = i + 2 + len
    if (m === 0xda) {
      let j = end
      while (j + 1 < b.length && !(b[j] === 0xff && b[j + 1] === 0xd9)) j++
      out.push(b.subarray(i, Math.min(j + 2, b.length)))
      if (j + 2 < b.length && o.other) removed.push('Data appended after image end')
      else if (j + 2 < b.length) out.push(b.subarray(j + 2))
      break
    }
    const seg = b.subarray(i, end)
    const head = ascii(b, i + 4, Math.min(end, i + 32))
    let keep = true
    let label = ''
    if (m === 0xe1 && head.startsWith('Exif')) {
      if (o.exif) {
        keep = false
        label = 'EXIF'
        const t = openTiff(seg.subarray(10))
        if (t) {
          const e0 = t.readIfd(t.u32(4)).entries.find((e) => e.tag === 0x0112)
          if (e0) orientation = t.u16(e0.entryOff + 8) || 1
        }
      } else if (o.gps || o.thumbnail) {
        const copy = seg.slice()
        const t = copy.subarray(10)
        if (o.gps && zeroGps(t)) removed.push('GPS location')
        if (o.thumbnail && zeroThumb(t)) removed.push('Embedded thumbnail')
        out.push(copy)
        i = end
        continue
      }
    } else if (m === 0xe1 && head.includes('ns.adobe.com/xap')) {
      if (o.xmp) { keep = false; label = 'XMP' }
      else if (o.gps) {
        const nul = head.indexOf('\0') + 1
        const xml = new TextDecoder().decode(b.subarray(i + 4 + nul, end))
        const clean = scrubXmpGps(xml)
        if (clean !== xml) { out.push(xmpSeg(clean)); removed.push('GPS in XMP'); i = end; continue }
      }
    } else if (m === 0xe1) { keep = !o.other; label = 'APP1 data' }
    else if (m === 0xed) { keep = !o.iptc; label = 'IPTC / Photoshop' }
    else if (m === 0xeb) { keep = !o.c2pa; label = 'C2PA content credentials' }
    else if (m === 0xfe) { keep = !o.comments; label = 'Comment' }
    else if (m === 0xe2 && head.startsWith('ICC_PROFILE')) { keep = !o.icc; label = 'ICC colour profile' }
    else if (m === 0xe2 && head.startsWith('MPF')) { keep = !o.other; label = 'Multi-picture data' }
    else if (m >= 0xe3 && m <= 0xef && m !== 0xee && m !== 0xeb && m !== 0xed) { keep = !o.other; label = `APP${m - 0xe0} data` }
    if (keep) out.push(seg)
    else removed.push(label)
    i = end
  }
  if (orientation > 1 && keepOrientation) {
    insertJpeg(out, [exifSeg(orientationTiff(orientation))])
    removed.push('(orientation kept so the photo stays upright)')
  }
  return { data: concat(out), removed, orientation }
}

const pngChunk = (type, data) => {
  const body = concat([enc.encode(type), data])
  const crc = new Uint8Array(4)
  new DataView(crc.buffer).setUint32(0, crc32(body))
  const len = new Uint8Array(4)
  new DataView(len.buffer).setUint32(0, data.length)
  return concat([len, body, crc])
}

const PNG_KEEP = new Set(['IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS', 'gAMA', 'cHRM', 'sRGB', 'sBIT', 'bKGD', 'hIST', 'pHYs', 'sPLT', 'acTL', 'fcTL', 'fdAT', 'cICP', 'mDCV', 'cLLI'])

function stripPngSel(b, o) {
  const out = [b.subarray(0, 8)]
  const removed = []
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength)
  let i = 8
  while (i + 8 <= b.length) {
    const len = dv.getUint32(i)
    const type = ascii(b, i + 4, i + 8)
    const end = i + 12 + len
    if (end > b.length) break
    const chunk = b.subarray(i, end)
    const data = b.subarray(i + 8, i + 8 + len)
    let keep = PNG_KEEP.has(type)
    let label = ''
    if (type === 'tEXt' || type === 'zTXt' || type === 'iTXt') {
      const isXmp = ascii(data, 0, 17) === 'XML:com.adobe.xmp'
      if (isXmp) {
        if (o.xmp) { keep = false; label = 'XMP' }
        else if (o.gps && type === 'iTXt') {
          // uncompressed iTXt only
          let z = 0
          while (data[z] !== 0) z++
          if (data[z + 1] === 0) {
            let p = z + 3
            while (data[p] !== 0) p++
            p++
            while (data[p] !== 0) p++
            p++
            const xml = new TextDecoder().decode(data.subarray(p))
            const clean = scrubXmpGps(xml)
            if (clean !== xml) {
              out.push(pngChunk('iTXt', concat([data.subarray(0, p), enc.encode(clean)])))
              removed.push('GPS in XMP')
              i = end
              continue
            }
          }
          keep = true
        } else keep = true
      } else {
        let z = 0
        while (z < data.length && data[z] !== 0) z++
        keep = !o.text
        label = `Text: ${ascii(data, 0, Math.min(z, 60)) || 'untitled'}`
      }
    } else if (type === 'eXIf') {
      if (o.exif) { keep = false; label = 'EXIF' }
      else if (o.gps || o.thumbnail) {
        const copy = data.slice()
        if (o.gps && zeroGps(copy)) removed.push('GPS location')
        if (o.thumbnail && zeroThumb(copy)) removed.push('Embedded thumbnail')
        out.push(pngChunk('eXIf', copy))
        i = end
        continue
      } else keep = true
    } else if (type === 'caBX') { keep = !o.c2pa; label = 'C2PA content credentials' }
    else if (type === 'iCCP') { keep = !o.icc; label = 'ICC colour profile' }
    else if (type === 'tIME') { keep = !o.other; label = 'Modification time' }
    else if (!keep) { keep = !o.other; label = `Chunk ${type}` }
    if (keep) out.push(chunk)
    else removed.push(label)
    i = end
    if (type === 'IEND') {
      if (i < b.length && o.other) removed.push('Data appended after image end')
      else if (i < b.length) out.push(b.subarray(i))
      break
    }
  }
  return { data: concat(out), removed }
}

function stripWebpSel(b, o) {
  const out = [b.subarray(0, 12)]
  const removed = []
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength)
  let flags = 0
  let i = 12
  while (i + 8 <= b.length) {
    const type = ascii(b, i, i + 4)
    const len = dv.getUint32(i + 4, true)
    const end = Math.min(i + 8 + len + (len & 1), b.length)
    if (type === 'EXIF') {
      if (o.exif) { removed.push('EXIF'); flags |= 0x08 }
      else if (o.gps || o.thumbnail) {
        const c = b.slice(i, end)
        const off = ascii(c, 8, 14) === 'Exif\0\0' ? 14 : 8
        const t = c.subarray(off)
        if (o.gps && zeroGps(t)) removed.push('GPS location')
        if (o.thumbnail && zeroThumb(t)) removed.push('Embedded thumbnail')
        out.push(c)
      } else out.push(b.subarray(i, end))
    } else if (type === 'XMP ') {
      if (o.xmp) { removed.push('XMP'); flags |= 0x04 } else out.push(b.subarray(i, end))
    } else if (type === 'C2PA') {
      if (o.c2pa) removed.push('C2PA content credentials'); else out.push(b.subarray(i, end))
    } else if (type === 'ICCP') {
      if (o.icc) { removed.push('ICC colour profile'); flags |= 0x20 } else out.push(b.subarray(i, end))
    } else if (type === 'VP8X') {
      out.push(b.slice(i, end))
    } else out.push(b.subarray(i, end))
    i = end
  }
  const data = concat(out)
  if (flags) {
    // locate VP8X in the output and clear flags for removed chunks
    let p = 12
    while (p + 8 <= data.length) {
      if (ascii(data, p, p + 4) === 'VP8X') { data[p + 8] &= ~flags; break }
      p += 8 + new DataView(data.buffer).getUint32(p + 4, true) + (data[p + 4] & 1)
    }
  }
  new DataView(data.buffer).setUint32(4, data.length - 8, true)
  return { data, removed }
}

/* ---------- XMP writer ---------- */
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const xmlName = (k) => k.replace(/[^A-Za-z0-9_.-]/g, '_').replace(/^([^A-Za-z_])/, '_$1')
const alt = (v) => `<rdf:Alt><rdf:li xml:lang="x-default">${esc(v)}</rdf:li></rdf:Alt>`
const list = (kind, arr) => `<rdf:${kind}>${arr.map((x) => `<rdf:li>${esc(x)}</rdf:li>`).join('')}</rdf:${kind}>`

export function buildXmp(f) {
  const rows = []
  if (f.title) rows.push(`<dc:title>${alt(f.title)}</dc:title>`)
  if (f.author) rows.push(`<dc:creator>${list('Seq', [f.author])}</dc:creator>`)
  if (f.description) rows.push(`<dc:description>${alt(f.description)}</dc:description>`)
  if (f.copyright) rows.push(`<dc:rights>${alt(f.copyright)}</dc:rights>`)
  if (f.keywords?.length) rows.push(`<dc:subject>${list('Bag', f.keywords)}</dc:subject>`)
  if (f.date) rows.push(`<xmp:CreateDate>${esc(f.date.length === 16 ? f.date + ':00' : f.date)}</xmp:CreateDate>`)
  if (f.software) rows.push(`<xmp:CreatorTool>${esc(f.software)}</xmp:CreatorTool>`)
  for (const c of f.custom || []) if (c.key && c.value) rows.push(`<mw:${xmlName(c.key)}>${esc(c.value)}</mw:${xmlName(c.key)}>`)
  if (!rows.length) return null
  return `<?xpacket begin="\ufeff" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmlns:mw="https://aimetawipe.app/ns/1.0/">${rows.join('')}</rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>`
}

const latin1Ok = (s) => [...s].every((c) => c.charCodeAt(0) < 256)

function pngText(key, value) {
  const k = key.slice(0, 79)
  if (latin1Ok(value) && latin1Ok(k)) {
    const kb = new Uint8Array([...k].map((c) => c.charCodeAt(0)))
    const vb = new Uint8Array([...value].map((c) => c.charCodeAt(0)))
    return pngChunk('tEXt', concat([kb, new Uint8Array([0]), vb]))
  }
  return pngChunk('iTXt', concat([enc.encode(k), new Uint8Array([0, 0, 0, 0, 0]), enc.encode(value)]))
}

const exifDate = (d) => (d ? d.replace(/-/g, ':').replace('T', ' ').padEnd(19, ':00').slice(0, 19) : '')

/* Write fields into a JPEG or PNG, after removing all existing metadata. */
export function writeMetadata(bytes, f) {
  const base = selectiveStrip(bytes, { ...ALL_OPTS, icc: false }, { keepOrientation: false })
  if (base.type !== 'jpeg' && base.type !== 'png') throw new Error('Metadata can be written to JPEG and PNG files')
  const xml = buildXmp(f)
  if (base.type === 'jpeg') {
    const entries = []
    if (f.description) entries.push({ tag: 0x010e, type: 2, value: f.description })
    if (f.author) entries.push({ tag: 0x013b, type: 2, value: f.author })
    if (f.copyright) entries.push({ tag: 0x8298, type: 2, value: f.copyright })
    if (f.software) entries.push({ tag: 0x0131, type: 2, value: f.software })
    if (f.date) entries.push({ tag: 0x0132, type: 2, value: exifDate(f.date) })
    if (base.orientation > 1) entries.push({ tag: 0x0112, type: 3, value: base.orientation })
    const extra = []
    if (entries.length) extra.push(exifSeg(buildTiff(entries)))
    if (xml) extra.push(xmpSeg(xml))
    const d = base.data
    // split into SOI + rest so insertion logic can find JFIF
    const parts = [d.subarray(0, 2)]
    if (d[2] === 0xff && d[3] === 0xe0) {
      const l = (d[4] << 8) | d[5]
      parts.push(d.subarray(2, 4 + l), d.subarray(4 + l))
    } else parts.push(d.subarray(2))
    insertJpeg(parts, extra)
    return concat(parts)
  }
  const chunks = []
  const add = (k, v) => v && chunks.push(pngText(k, v))
  add('Title', f.title)
  add('Author', f.author)
  add('Description', f.description)
  add('Copyright', f.copyright)
  add('Creation Time', f.date)
  add('Software', f.software)
  if (f.keywords?.length) add('Keywords', f.keywords.join(', '))
  for (const c of f.custom || []) if (c.key && c.value) add(c.key, c.value)
  if (xml) chunks.push(pngChunk('iTXt', concat([enc.encode('XML:com.adobe.xmp'), new Uint8Array([0, 0, 0, 0, 0]), enc.encode(xml)])))
  const d = base.data
  return concat([d.subarray(0, 33), ...chunks, d.subarray(33)])
}
