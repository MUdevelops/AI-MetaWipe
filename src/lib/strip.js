// Metadata removal engine.
//  - lossless: rewrites the file container and drops metadata segments/chunks. Pixels are untouched.
//  - reencode: redraws pixels on a canvas, which drops everything the browser does not carry over.
// Pure byte logic lives at the top so it can be tested without a DOM.

const latin1 = new TextDecoder('latin1')
const ascii = (b, s, e) => latin1.decode(b.subarray(s, e))

function concat(parts) {
  const total = parts.reduce((n, p) => n + p.length, 0)
  const out = new Uint8Array(total)
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

export function detectType(b) {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg'
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png'
  if (b.length > 12 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP') return 'webp'
  return 'other'
}

/* ---------------- JPEG ---------------- */

function exifOrientation(seg) {
  // seg starts at FF E1; "Exif\0\0" at 4..10; TIFF header at 10
  const t = 10
  if (seg.length < t + 8) return 1
  const le = seg[t] === 0x49
  const dv = new DataView(seg.buffer, seg.byteOffset, seg.byteLength)
  const u16 = (o) => dv.getUint16(o, le)
  const u32 = (o) => dv.getUint32(o, le)
  let ifd = t + u32(t + 4)
  if (ifd + 2 > seg.length) return 1
  const n = u16(ifd)
  for (let i = 0; i < n; i++) {
    const e = ifd + 2 + i * 12
    if (e + 12 > seg.length) break
    if (u16(e) === 0x0112) return u16(e + 8) || 1
  }
  return 1
}

function jpegLabel(m, seg) {
  const head = ascii(seg, 4, Math.min(seg.length, 32))
  if (m === 0xe1) {
    if (head.startsWith('Exif')) return 'EXIF'
    if (head.includes('ns.adobe.com/xap')) return 'XMP'
    return 'APP1 data'
  }
  if (m === 0xeb) return 'C2PA / JUMBF content credentials'
  if (m === 0xed) return 'Photoshop / IPTC'
  if (m === 0xfe) return 'Comment'
  if (m === 0xe2) return head.startsWith('MPF') ? 'Multi-picture data' : 'APP2 data'
  return `APP${m - 0xe0} data`
}

function keepJpegSegment(m, seg) {
  if (m === 0xe0) return true // JFIF
  if (m === 0xee) return true // Adobe colour transform, needed to decode correctly
  if (m === 0xe2 && ascii(seg, 4, 15) === 'ICC_PROFILE') return true
  if (m >= 0xe0 && m <= 0xef) return false
  if (m === 0xfe) return false
  return true
}

export function stripJpeg(b) {
  const out = [b.subarray(0, 2)]
  const removed = []
  let orientation = 1
  let i = 2
  while (i + 1 < b.length) {
    if (b[i] !== 0xff) {
      out.push(b.subarray(i))
      break
    }
    const m = b[i + 1]
    if (m === 0xff) {
      i++
      continue
    }
    if (m === 0xd9) {
      out.push(b.subarray(i, i + 2))
      break
    }
    if (m === 0x01 || (m >= 0xd0 && m <= 0xd8)) {
      out.push(b.subarray(i, i + 2))
      i += 2
      continue
    }
    const len = (b[i + 2] << 8) | b[i + 3]
    const end = i + 2 + len
    if (m === 0xda) {
      // Scan data: copy up to and including the first real EOI (drops anything appended after it).
      let j = end
      while (j + 1 < b.length && !(b[j] === 0xff && b[j + 1] === 0xd9)) j++
      out.push(b.subarray(i, Math.min(j + 2, b.length)))
      if (j + 2 < b.length) removed.push('Data appended after image end')
      break
    }
    const seg = b.subarray(i, end)
    if (keepJpegSegment(m, seg)) out.push(seg)
    else {
      if (m === 0xe1 && ascii(seg, 4, 8) === 'Exif') orientation = exifOrientation(seg)
      removed.push(jpegLabel(m, seg))
    }
    i = end
  }
  return { data: concat(out), removed, orientation }
}

/* ---------------- PNG ---------------- */

const PNG_KEEP = new Set([
  'IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS', 'gAMA', 'cHRM', 'sRGB', 'iCCP', 'sBIT',
  'bKGD', 'hIST', 'pHYs', 'sPLT', 'acTL', 'fcTL', 'fdAT', 'cICP', 'mDCV', 'cLLI',
])

function pngLabel(type, data) {
  if (type === 'tEXt' || type === 'zTXt' || type === 'iTXt') {
    let z = 0
    while (z < data.length && z < 80 && data[z] !== 0) z++
    return `Text: ${ascii(data, 0, z) || 'untitled'}`
  }
  if (type === 'eXIf') return 'EXIF'
  if (type === 'caBX') return 'C2PA content credentials'
  if (type === 'tIME') return 'Modification time'
  return `Chunk ${type}`
}

export function stripPng(b) {
  const out = [b.subarray(0, 8)]
  const removed = []
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength)
  let i = 8
  while (i + 8 <= b.length) {
    const len = dv.getUint32(i)
    const type = ascii(b, i + 4, i + 8)
    const end = i + 12 + len
    if (end > b.length) break
    if (PNG_KEEP.has(type)) out.push(b.subarray(i, end))
    else removed.push(pngLabel(type, b.subarray(i + 8, i + 8 + len)))
    i = end
    if (type === 'IEND') {
      if (i < b.length) removed.push('Data appended after image end')
      break
    }
  }
  return { data: concat(out), removed }
}

/* ---------------- WebP ---------------- */

export function stripWebp(b) {
  const out = [b.subarray(0, 12)]
  const removed = []
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength)
  let i = 12
  while (i + 8 <= b.length) {
    const type = ascii(b, i, i + 4)
    const len = dv.getUint32(i + 4, true)
    const end = Math.min(i + 8 + len + (len & 1), b.length)
    if (type === 'EXIF') removed.push('EXIF')
    else if (type === 'XMP ') removed.push('XMP')
    else if (type === 'C2PA') removed.push('C2PA content credentials')
    else if (type === 'VP8X') {
      const c = b.slice(i, end)
      c[8] &= ~(0x08 | 0x04) // clear EXIF + XMP flags
      out.push(c)
    } else out.push(b.subarray(i, end))
    i = end
  }
  const data = concat(out)
  new DataView(data.buffer).setUint32(4, data.length - 8, true)
  return { data, removed }
}

export function inspectAndStrip(bytes) {
  const type = detectType(bytes)
  if (type === 'jpeg') return { type, ...stripJpeg(bytes) }
  if (type === 'png') return { type, ...stripPng(bytes) }
  if (type === 'webp') return { type, ...stripWebp(bytes) }
  return { type, data: null, removed: [] }
}

/* ---------------- Browser pipeline ---------------- */

const MIME = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

async function reencode(file, mime, quality) {
  const bmp = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = bmp.width
  canvas.height = bmp.height
  const ctx = canvas.getContext('2d')
  if (mime === 'image/jpeg') {
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  ctx.drawImage(bmp, 0, 0)
  bmp.close?.()
  const blob = await new Promise((r) => canvas.toBlob(r, mime, quality))
  if (!blob) throw new Error('This browser could not encode the image')
  return blob
}

function baseName(name) {
  return name.replace(/\.[^.]+$/, '')
}

export async function processFile(file, { mode, quality, otherFormat }) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const info = inspectAndStrip(bytes)
  const base = baseName(file.name)
  let blob
  let ext
  let note = ''

  const wantReencode = mode === 'reencode' || info.type === 'other' || (info.type === 'jpeg' && info.orientation > 1)

  if (!wantReencode) {
    blob = new Blob([info.data], { type: MIME[info.type] })
    ext = EXT[MIME[info.type]]
  } else {
    const mime = info.type === 'other' ? otherFormat : MIME[info.type]
    try {
      blob = await reencode(file, mime, quality)
    } catch (e) {
      throw new Error(info.type === 'other' ? 'Format not supported by this browser' : e.message)
    }
    ext = EXT[mime]
    if (info.type === 'other') note = 'Converted. All embedded metadata dropped.'
    else if (info.orientation > 1 && mode !== 'reencode') note = 'Rotated pixels baked in so the photo stays upright.'
    else note = 'Redrawn from pixels.'
  }

  return {
    name: `${base}-clean.${ext}`,
    blob,
    removed: info.removed,
    note,
    type: info.type,
    originalSize: file.size,
    newSize: blob.size,
  }
}
