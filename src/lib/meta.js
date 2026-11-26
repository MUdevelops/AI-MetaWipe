// Metadata reader: JPEG, PNG, WebP. Pure byte parsing (browser APIs only for dimensions of other formats).
import { detectType } from './strip.js'
import { ascii, utf8, latin1, inflate } from './bytes.js'

const T0 = {
  0x010e: 'ImageDescription', 0x010f: 'Make', 0x0110: 'Model', 0x0112: 'Orientation',
  0x011a: 'XResolution', 0x011b: 'YResolution', 0x0128: 'ResolutionUnit', 0x0131: 'Software',
  0x0132: 'DateTime', 0x013b: 'Artist', 0x8298: 'Copyright', 0xc62f: 'CameraSerialNumber',
}
const TE = {
  0x829a: 'ExposureTime', 0x829d: 'FNumber', 0x8822: 'ExposureProgram', 0x8827: 'ISO',
  0x9000: 'ExifVersion', 0x9003: 'DateTimeOriginal', 0x9004: 'DateTimeDigitized',
  0x9201: 'ShutterSpeedValue', 0x9202: 'ApertureValue', 0x9204: 'ExposureBias',
  0x9207: 'MeteringMode', 0x9209: 'Flash', 0x920a: 'FocalLength', 0x927c: 'MakerNote',
  0x9286: 'UserComment', 0xa001: 'ColorSpace', 0xa002: 'PixelXDimension', 0xa003: 'PixelYDimension',
  0xa402: 'ExposureMode', 0xa403: 'WhiteBalance', 0xa405: 'FocalLengthIn35mmFilm',
  0xa406: 'SceneCaptureType', 0xa430: 'CameraOwnerName', 0xa431: 'BodySerialNumber',
  0xa432: 'LensSpecification', 0xa433: 'LensMake', 0xa434: 'LensModel', 0xa435: 'LensSerialNumber',
}
const TG = {
  0: 'GPSVersionID', 1: 'GPSLatitudeRef', 2: 'GPSLatitude', 3: 'GPSLongitudeRef', 4: 'GPSLongitude',
  5: 'GPSAltitudeRef', 6: 'GPSAltitude', 7: 'GPSTimeStamp', 12: 'GPSSpeedRef', 13: 'GPSSpeed',
  16: 'GPSImgDirectionRef', 17: 'GPSImgDirection', 29: 'GPSDateStamp',
}
const TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 }

export function openTiff(t) {
  if (t.length < 8) return null
  const le = t[0] === 0x49 && t[1] === 0x49
  if (!le && !(t[0] === 0x4d && t[1] === 0x4d)) return null
  const dv = new DataView(t.buffer, t.byteOffset, t.byteLength)
  const u16 = (o) => dv.getUint16(o, le)
  const u32 = (o) => dv.getUint32(o, le)
  const readIfd = (off) => {
    const entries = []
    if (!off || off + 2 > t.length) return { entries, next: 0, nextPos: -1 }
    const n = u16(off)
    for (let i = 0; i < n; i++) {
      const e = off + 2 + i * 12
      if (e + 12 > t.length) break
      const tag = u16(e)
      const type = u16(e + 2)
      const count = u32(e + 4)
      const size = (TYPE_SIZE[type] || 1) * count
      entries.push({ tag, type, count, size, vo: size <= 4 ? e + 8 : u32(e + 8), entryOff: e })
    }
    const nextPos = off + 2 + n * 12
    return { entries, next: nextPos + 4 <= t.length ? u32(nextPos) : 0, nextPos, off }
  }
  const value = (en) => {
    const { type, count, vo, size, tag } = en
    if (vo + size > t.length || size > 1 << 20) return null
    if (type === 2) return utf8.decode(t.subarray(vo, vo + count)).replace(/\0+$/, '').trim()
    if (tag === 0x9000) return ascii(t, vo, vo + count)
    if (tag === 0x9286) return utf8.decode(t.subarray(vo + 8, vo + count)).replace(/\0+/g, '').trim()
    if (tag === 0x927c) return `(${count} bytes of maker data)`
    const out = []
    for (let i = 0; i < Math.min(count, 32); i++) {
      if (type === 1 || type === 7 || type === 6) out.push(t[vo + i])
      else if (type === 3) out.push(u16(vo + i * 2))
      else if (type === 4) out.push(u32(vo + i * 4))
      else if (type === 8) out.push(dv.getInt16(vo + i * 2, le))
      else if (type === 9) out.push(dv.getInt32(vo + i * 4, le))
      else if (type === 5) { const d = u32(vo + i * 8 + 4); out.push(d ? u32(vo + i * 8) / d : 0) }
      else if (type === 10) { const d = dv.getInt32(vo + i * 8 + 4, le); out.push(d ? dv.getInt32(vo + i * 8, le) / d : 0) }
      else if (type === 11) out.push(dv.getFloat32(vo + i * 4, le))
      else if (type === 12) out.push(dv.getFloat64(vo + i * 8, le))
    }
    return out.length === 1 ? out[0] : out
  }
  return { t, le, dv, u16, u32, readIfd, value }
}

function named(tiff, entries, names) {
  const out = {}
  for (const en of entries) {
    const v = tiff.value(en)
    if (v === null || v === '') continue
    out[names[en.tag] || `Tag 0x${en.tag.toString(16).padStart(4, '0')}`] = v
  }
  return out
}

const dms = (a, ref) => {
  if (!Array.isArray(a) || a.length < 3) return null
  const v = a[0] + a[1] / 60 + a[2] / 3600
  return ref === 'S' || ref === 'W' ? -v : v
}

export function parseTiff(t) {
  const tiff = openTiff(t)
  if (!tiff) return null
  const ifd0 = tiff.readIfd(tiff.u32(4))
  const res = { ifd0: named(tiff, ifd0.entries.filter((e) => e.tag !== 0x8769 && e.tag !== 0x8825), T0), exif: {}, gps: {}, thumb: null }
  const ptr = (tag) => ifd0.entries.find((e) => e.tag === tag)
  const ex = ptr(0x8769)
  if (ex) {
    const ifd = tiff.readIfd(tiff.u32(ex.entryOff + 8))
    res.exif = named(tiff, ifd.entries.filter((e) => e.tag !== 0xa005), TE)
  }
  const gp = ptr(0x8825)
  if (gp) {
    const ifd = tiff.readIfd(tiff.u32(gp.entryOff + 8))
    res.gps = named(tiff, ifd.entries, TG)
  }
  if (ifd0.next) {
    const ifd1 = tiff.readIfd(ifd0.next)
    const o = ifd1.entries.find((e) => e.tag === 0x0201)
    const l = ifd1.entries.find((e) => e.tag === 0x0202)
    if (o && l) {
      const off = tiff.value(o)
      const len = tiff.value(l)
      if (off && len && off + len <= t.length) res.thumb = t.slice(off, off + len)
    }
  }
  const g = res.gps
  if (g.GPSLatitude && g.GPSLongitude) {
    const lat = dms(g.GPSLatitude, g.GPSLatitudeRef)
    const lon = dms(g.GPSLongitude, g.GPSLongitudeRef)
    if (lat !== null && lon !== null) res.coords = { lat, lon, alt: typeof g.GPSAltitude === 'number' ? g.GPSAltitude : null }
  }
  res.orientation = Number(res.ifd0.Orientation) || 1
  return res
}

/* ---------- IPTC / XMP ---------- */
const IPTC = { 5: 'Title', 25: 'Keywords', 55: 'DateCreated', 80: 'Byline', 90: 'City', 101: 'Country', 105: 'Headline', 110: 'Credit', 115: 'Source', 116: 'Copyright', 120: 'Caption' }

function parseIptc(seg) {
  // seg: APP13 payload after the 2 length bytes
  const head = 'Photoshop 3.0\0'
  if (ascii(seg, 0, head.length) !== head) return null
  const fields = []
  let i = head.length
  while (i + 12 <= seg.length && ascii(seg, i, i + 4) === '8BIM') {
    const id = (seg[i + 4] << 8) | seg[i + 5]
    let p = i + 6
    const nl = seg[p]
    p += 1 + nl + (((1 + nl) & 1) ? 1 : 0)
    const size = new DataView(seg.buffer, seg.byteOffset + p, 4).getUint32(0)
    p += 4
    if (id === 0x0404) {
      let q = p
      while (q + 5 <= p + size) {
        if (seg[q] !== 0x1c) break
        const rec = seg[q + 1]
        const ds = seg[q + 2]
        const len = (seg[q + 3] << 8) | seg[q + 4]
        if (rec === 2 && IPTC[ds]) fields.push({ name: IPTC[ds], value: utf8.decode(seg.subarray(q + 5, q + 5 + len)) })
        q += 5 + len
      }
    }
    i = p + size + (size & 1)
  }
  return { fields, present: true }
}

function xmpValues(raw, tag) {
  const attr = new RegExp(`${tag}="([^"]*)"`).exec(raw)
  if (attr) return [attr[1]]
  const el = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`).exec(raw)
  if (!el) return []
  const lis = [...el[1].matchAll(/<rdf:li[^>]*>([\s\S]*?)<\/rdf:li>/g)].map((m) => m[1].trim())
  return lis.length ? lis : [el[1].replace(/<[^>]+>/g, '').trim()].filter(Boolean)
}

const unesc = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')

export function parseXmp(raw) {
  const f = {}
  const keys = ['dc:title', 'dc:creator', 'dc:description', 'dc:rights', 'dc:subject', 'xmp:CreateDate', 'xmp:ModifyDate', 'xmp:CreatorTool', 'photoshop:City', 'photoshop:Country', 'photoshop:Credit', 'exif:GPSLatitude', 'exif:GPSLongitude', 'tiff:Make', 'tiff:Model', 'aux:SerialNumber', 'aux:Lens']
  for (const k of keys) {
    const v = xmpValues(raw, k)
    if (v.length) f[k] = v.map(unesc).join(', ')
  }
  for (const m of raw.matchAll(/<mw:([\w.-]+)>([^<]*)<\/mw:\1>/g)) f[`mw:${m[1]}`] = unesc(m[2])
  return { raw, fields: f }
}

/* ---------- format scanners ---------- */
function scanJpeg(b, m) {
  m.segments = []
  m.comments = []
  let i = 2
  let sawEOI = false
  while (i + 3 < b.length) {
    if (b[i] !== 0xff) break
    const mk = b[i + 1]
    if (mk === 0xff) { i++; continue }
    if (mk === 0xd9) { sawEOI = true; i += 2; break }
    if (mk === 0x01 || (mk >= 0xd0 && mk <= 0xd8)) { i += 2; continue }
    const len = (b[i + 2] << 8) | b[i + 3]
    const end = i + 2 + len
    const payload = b.subarray(i + 4, end)
    let name = `0x${mk.toString(16).toUpperCase()}`
    if (mk >= 0xe0 && mk <= 0xef) {
      name = `APP${mk - 0xe0}`
      const head = ascii(b, i + 4, Math.min(end, i + 32))
      if (mk === 0xe0) name += ' JFIF'
      else if (mk === 0xe1 && head.startsWith('Exif')) {
        name += ' EXIF'
        const t = b.subarray(i + 10, end)
        m.exifRaw = parseTiff(t)
      } else if (mk === 0xe1 && head.includes('ns.adobe.com/xap')) {
        name += ' XMP'
        m.xmp = parseXmp(utf8.decode(b.subarray(i + 4 + head.indexOf('\0') + 1, end)))
      } else if (mk === 0xe2 && head.startsWith('ICC_PROFILE')) { name += ' ICC profile'; m.icc = true }
      else if (mk === 0xe2 && head.startsWith('MPF')) name += ' Multi-picture'
      else if (mk === 0xeb) { name += ' JUMBF / C2PA'; m.c2pa = true }
      else if (mk === 0xed) { name += ' Photoshop / IPTC'; m.iptc = parseIptc(payload) }
      else if (mk === 0xee) name += ' Adobe'
    } else if (mk === 0xfe) {
      name = 'COM Comment'
      m.comments.push(utf8.decode(payload).trim())
    } else if (mk === 0xdb) name = 'DQT'
    else if (mk === 0xc4) name = 'DHT'
    else if (mk === 0xdd) name = 'DRI'
    else if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(mk)) {
      name = `SOF${mk - 0xc0}`
      m.height = (b[i + 5] << 8) | b[i + 6]
      m.width = (b[i + 7] << 8) | b[i + 8]
      m.bitDepth = b[i + 4]
      m.progressive = mk === 0xc2
    }
    if (mk === 0xda) {
      m.segments.push({ name: 'SOS Scan data', offset: i, size: 0 })
      let j = end
      while (j + 1 < b.length && !(b[j] === 0xff && b[j + 1] === 0xd9)) j++
      m.segments[m.segments.length - 1].size = j - i
      sawEOI = j + 1 < b.length
      i = j + 2
      break
    }
    m.segments.push({ name, offset: i, size: len + 2 })
    i = end
  }
  m.appended = sawEOI && i < b.length ? b.length - i : 0
}

const PNG_COLOR = { 0: 'Grayscale', 2: 'RGB', 3: 'Indexed', 4: 'Grayscale + alpha', 6: 'RGBA' }

async function scanPng(b, m) {
  m.chunks = []
  m.pngText = []
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength)
  let i = 8
  while (i + 8 <= b.length) {
    const len = dv.getUint32(i)
    const type = ascii(b, i + 4, i + 8)
    const data = b.subarray(i + 8, Math.min(i + 8 + len, b.length))
    m.chunks.push({ name: type, offset: i, size: len + 12 })
    if (type === 'IHDR') {
      m.width = dv.getUint32(i + 8)
      m.height = dv.getUint32(i + 12)
      m.bitDepth = b[i + 16]
      m.colorType = PNG_COLOR[b[i + 17]] || String(b[i + 17])
      m.interlaced = b[i + 20] === 1
      m.alphaChannel = b[i + 17] === 4 || b[i + 17] === 6
    } else if (type === 'tRNS') m.hasTrns = true
    else if (type === 'iCCP') m.icc = true
    else if (type === 'caBX') m.c2pa = true
    else if (type === 'acTL') m.animated = true
    else if (type === 'pHYs' && len >= 9) m.dpi = Math.round(dv.getUint32(i + 8) * 0.0254)
    else if (type === 'eXIf') m.exifRaw = parseTiff(data)
    else if (type === 'tIME' && len === 7) m.pngTime = `${(data[0] << 8) | data[1]}-${String(data[2]).padStart(2, '0')}-${String(data[3]).padStart(2, '0')} ${String(data[4]).padStart(2, '0')}:${String(data[5]).padStart(2, '0')}:${String(data[6]).padStart(2, '0')}`
    else if (type === 'tEXt' || type === 'zTXt' || type === 'iTXt') {
      let z = 0
      while (z < data.length && data[z] !== 0) z++
      const keyword = latin1.decode(data.subarray(0, z))
      try {
        let text = ''
        let compressed = false
        if (type === 'tEXt') text = latin1.decode(data.subarray(z + 1))
        else if (type === 'zTXt') { compressed = true; text = latin1.decode(await inflate(data.subarray(z + 2))) }
        else {
          const flag = data[z + 1]
          let p = z + 3
          while (p < data.length && data[p] !== 0) p++
          p++
          while (p < data.length && data[p] !== 0) p++
          p++
          const body = data.subarray(p)
          compressed = flag === 1
          text = utf8.decode(compressed ? await inflate(body) : body)
        }
        if (keyword === 'XML:com.adobe.xmp') m.xmp = parseXmp(text)
        else m.pngText.push({ keyword, text, kind: type, compressed })
      } catch {
        m.pngText.push({ keyword, text: '(could not decode)', kind: type })
      }
    }
    i += 12 + len
    if (type === 'IEND') break
  }
  m.appended = i < b.length ? b.length - i : 0
}

function scanWebp(b, m) {
  m.chunks = []
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength)
  let i = 12
  while (i + 8 <= b.length) {
    const type = ascii(b, i, i + 4)
    const len = dv.getUint32(i + 4, true)
    const d = i + 8
    m.chunks.push({ name: type, offset: i, size: len + 8 })
    if (type === 'VP8X') {
      const f = b[d]
      m.alphaChannel = !!(f & 0x10)
      m.animated = !!(f & 0x02)
      if (f & 0x20) m.icc = true
      m.width = 1 + (b[d + 4] | (b[d + 5] << 8) | (b[d + 6] << 16))
      m.height = 1 + (b[d + 7] | (b[d + 8] << 8) | (b[d + 9] << 16))
    } else if (type === 'VP8 ' && !m.width) {
      m.width = dv.getUint16(d + 6, true) & 0x3fff
      m.height = dv.getUint16(d + 8, true) & 0x3fff
    } else if (type === 'VP8L' && !m.width) {
      const bits = dv.getUint32(d + 1, true)
      m.width = (bits & 0x3fff) + 1
      m.height = ((bits >> 14) & 0x3fff) + 1
      m.alphaChannel = !!((bits >> 28) & 1)
    } else if (type === 'EXIF') {
      const off = ascii(b, d, d + 6) === 'Exif\0\0' ? 6 : 0
      m.exifRaw = parseTiff(b.subarray(d + off, d + len))
    } else if (type === 'XMP ') m.xmp = parseXmp(utf8.decode(b.subarray(d, d + len)))
    else if (type === 'ICCP') m.icc = true
    else if (type === 'C2PA') m.c2pa = true
    i = d + len + (len & 1)
  }
}

const AI_PATTERNS = [
  [/automatic1111|stable diffusion|sd-webui|steps:\s*\d+,\s*sampler/i, 'Stable Diffusion (A1111 style)'],
  [/comfyui|"class_type"/i, 'ComfyUI'],
  [/novelai/i, 'NovelAI'],
  [/invokeai/i, 'InvokeAI'],
  [/fooocus/i, 'Fooocus'],
  [/midjourney/i, 'Midjourney'],
  [/dall[-·\s]?e/i, 'OpenAI DALL·E'],
  [/firefly/i, 'Adobe Firefly'],
  [/leonardo\.ai/i, 'Leonardo'],
]

function detectAi(m) {
  const hits = new Set()
  const texts = []
  for (const t of m.pngText || []) {
    texts.push(t.keyword, t.text)
    if (t.keyword === 'parameters') hits.add('Stable Diffusion prompt block')
    if (t.keyword === 'prompt' || t.keyword === 'workflow') hits.add('ComfyUI workflow data')
    if (t.keyword === 'invokeai_metadata') hits.add('InvokeAI')
  }
  const ex = m.exif
  if (ex) texts.push(ex.ifd0.Software, ex.ifd0.ImageDescription, ex.exif.UserComment)
  if (m.xmp) texts.push(m.xmp.raw.slice(0, 20000))
  for (const c of m.comments || []) texts.push(c)
  const blob = texts.filter(Boolean).join('\n')
  for (const [re, label] of AI_PATTERNS) if (re.test(blob)) hits.add(label)
  if (m.c2pa) hits.add('C2PA content credentials')
  return [...hits]
}

export async function readMetadata(file) {
  const b = new Uint8Array(await file.arrayBuffer())
  const type = detectType(b)
  const m = {
    name: file.name, size: file.size, type, mime: file.type || '', modified: file.lastModified,
    format: { jpeg: 'JPEG', png: 'PNG', webp: 'WebP', other: (file.type || 'image').replace('image/', '').toUpperCase() }[type],
    comments: [], pngText: [], chunks: [], segments: [], appended: 0, bytes: b,
  }
  try {
    if (type === 'jpeg') scanJpeg(b, m)
    else if (type === 'png') await scanPng(b, m)
    else if (type === 'webp') scanWebp(b, m)
  } catch (e) {
    m.parseError = e.message
  }
  if (!m.width) {
    try {
      const bmp = await createImageBitmap(file)
      m.width = bmp.width
      m.height = bmp.height
      bmp.close?.()
    } catch { /* unsupported */ }
  }
  if (m.exifRaw) {
    m.exif = m.exifRaw
    m.gps = m.exifRaw.coords || null
    m.thumbBytes = m.exifRaw.thumb
    m.orientation = m.exifRaw.orientation
    delete m.exif.coords
  }
  m.hasGpsTags = !!(m.exif && Object.keys(m.exif.gps).length)
  if (m.xmp && m.xmp.fields['exif:GPSLatitude'] && !m.gps) m.hasGpsTags = true
  m.ai = detectAi(m)
  return m
}
