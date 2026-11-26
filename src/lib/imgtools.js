// Canvas based image tools. Browser only.
export const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' }
export const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }

export async function loadBitmap(file) {
  return createImageBitmap(file)
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w))
  c.height = Math.max(1, Math.round(h))
  return c
}

export function toBlob(canvas, mime = 'image/png', q = 0.92) {
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Could not encode image'))), mime, q))
}

export async function drawToCanvas(file, { w, h, flatten } = {}) {
  const bmp = await loadBitmap(file)
  const c = makeCanvas(w || bmp.width, h || bmp.height)
  const ctx = c.getContext('2d')
  if (flatten) {
    ctx.fillStyle = flatten
    ctx.fillRect(0, 0, c.width, c.height)
  }
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bmp, 0, 0, c.width, c.height)
  bmp.close?.()
  return c
}

export const baseName = (n) => n.replace(/\.[^.]+$/, '')

/* PNG compression: re-encode, with optional colour reduction (lossy below 256). */
export async function compressPng(file, levels = 256) {
  const c = await drawToCanvas(file)
  if (levels < 256) {
    const ctx = c.getContext('2d')
    const img = ctx.getImageData(0, 0, c.width, c.height)
    const d = img.data
    const step = 255 / (levels - 1)
    for (let i = 0; i < d.length; i += 4) {
      d[i] = Math.round(Math.round(d[i] / step) * step)
      d[i + 1] = Math.round(Math.round(d[i + 1] / step) * step)
      d[i + 2] = Math.round(Math.round(d[i + 2] / step) * step)
    }
    ctx.putImageData(img, 0, 0)
  }
  return toBlob(c, 'image/png')
}

export async function convertImage(file, mime, q, flatten = '#ffffff') {
  const c = await drawToCanvas(file, { flatten: mime === 'image/jpeg' ? flatten : null })
  return toBlob(c, mime, q)
}

export async function resizeImage(file, w, h, mime, q) {
  const c = await drawToCanvas(file, { w, h, flatten: mime === 'image/jpeg' ? '#ffffff' : null })
  return toBlob(c, mime, q)
}

export async function cropImage(file, r, mime, q) {
  const bmp = await loadBitmap(file)
  const c = makeCanvas(r.w, r.h)
  const ctx = c.getContext('2d')
  if (mime === 'image/jpeg') {
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, c.width, c.height)
  }
  ctx.drawImage(bmp, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h)
  bmp.close?.()
  return toBlob(c, mime, q)
}

/* Background removal: flood fill from the image border over pixels close to the background colour. */
export async function removeBackground(file, { tolerance = 30, erode = 0, color = null }) {
  const c = await drawToCanvas(file)
  const ctx = c.getContext('2d')
  const img = ctx.getImageData(0, 0, c.width, c.height)
  const { width: W, height: H, data: d } = img
  const px = (x, y) => (y * W + x) * 4
  let bg = color
  if (!bg) {
    const pts = [[0, 0], [W - 1, 0], [0, H - 1], [W - 1, H - 1]].map(([x, y]) => [d[px(x, y)], d[px(x, y) + 1], d[px(x, y) + 2]])
    bg = pts[0]
    let best = -1
    for (const p of pts) {
      const n = pts.filter((q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) < 40).length
      if (n > best) { best = n; bg = p }
    }
  }
  const lim = tolerance * 4.41
  const near = (i) => Math.hypot(d[i] - bg[0], d[i + 1] - bg[1], d[i + 2] - bg[2]) <= lim
  const seen = new Uint8Array(W * H)
  const stack = []
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return
    const k = y * W + x
    if (seen[k]) return
    if (!near(k * 4)) return
    seen[k] = 1
    stack.push(k)
  }
  for (let x = 0; x < W; x++) { push(x, 0); push(x, H - 1) }
  for (let y = 0; y < H; y++) { push(0, y); push(W - 1, y) }
  while (stack.length) {
    const k = stack.pop()
    const x = k % W
    const y = (k / W) | 0
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1)
  }
  for (let n = 0; n < erode; n++) {
    const edge = []
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const k = y * W + x
      if (seen[k]) continue
      if ((x > 0 && seen[k - 1]) || (x < W - 1 && seen[k + 1]) || (y > 0 && seen[k - W]) || (y < H - 1 && seen[k + W])) edge.push(k)
    }
    for (const k of edge) seen[k] = 1
  }
  let removed = 0
  for (let k = 0; k < seen.length; k++) if (seen[k]) { d[k * 4 + 3] = 0; removed++ }
  ctx.putImageData(img, 0, 0)
  return { blob: await toBlob(c, 'image/png'), removedPct: (removed / seen.length) * 100, bg }
}

export async function alphaStats(file) {
  const c = await drawToCanvas(file)
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
  let clear = 0
  let semi = 0
  const total = d.length / 4
  for (let i = 3; i < d.length; i += 4) {
    if (d[i] === 0) clear++
    else if (d[i] < 255) semi++
  }
  return { total, clear, semi, opaque: total - clear - semi, clearPct: (clear / total) * 100, semiPct: (semi / total) * 100 }
}

const hex2 = (n) => n.toString(16).padStart(2, '0')

export async function extractPalette(file, n = 8) {
  const bmp = await loadBitmap(file)
  const s = Math.min(1, 160 / Math.max(bmp.width, bmp.height))
  const c = makeCanvas(bmp.width * s, bmp.height * s)
  const ctx = c.getContext('2d')
  ctx.drawImage(bmp, 0, 0, c.width, c.height)
  bmp.close?.()
  const d = ctx.getImageData(0, 0, c.width, c.height).data
  const buckets = new Map()
  let total = 0
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue
    const key = ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4)
    const b = buckets.get(key) || { r: 0, g: 0, b: 0, n: 0 }
    b.r += d[i]; b.g += d[i + 1]; b.b += d[i + 2]; b.n++
    buckets.set(key, b)
    total++
  }
  const all = [...buckets.values()].sort((a, b) => b.n - a.n).map((b) => ({ r: Math.round(b.r / b.n), g: Math.round(b.g / b.n), b: Math.round(b.b / b.n), n: b.n }))
  const picked = []
  for (const c1 of all) {
    if (picked.every((p) => Math.hypot(p.r - c1.r, p.g - c1.g, p.b - c1.b) > 48)) picked.push(c1)
    if (picked.length >= n) break
  }
  return picked.map((p) => ({ hex: `#${hex2(p.r)}${hex2(p.g)}${hex2(p.b)}`.toUpperCase(), rgb: `${p.r}, ${p.g}, ${p.b}`, pct: (p.n / total) * 100 }))
}

export async function sha256(u8) {
  const h = await crypto.subtle.digest('SHA-256', u8)
  return [...new Uint8Array(h)].map(hex2).join('')
}

export async function dHash(file) {
  const bmp = await loadBitmap(file)
  const c = makeCanvas(9, 8)
  const ctx = c.getContext('2d')
  ctx.drawImage(bmp, 0, 0, 9, 8)
  bmp.close?.()
  const d = ctx.getImageData(0, 0, 9, 8).data
  const g = (x, y) => { const i = (y * 9 + x) * 4; return d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114 }
  let bits = ''
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += g(x, y) > g(x + 1, y) ? '1' : '0'
  return bits
}

export const hamming = (a, b) => { let n = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++; return n }

/* Hash of decoded pixels, used to prove a lossless clean did not change the picture. */
export async function pixelHash(blobOrFile) {
  const bmp = await createImageBitmap(blobOrFile)
  const s = Math.min(1, 4096 / Math.max(bmp.width, bmp.height))
  const c = makeCanvas(bmp.width * s, bmp.height * s)
  const ctx = c.getContext('2d')
  ctx.drawImage(bmp, 0, 0, c.width, c.height)
  const w = bmp.width
  const h = bmp.height
  bmp.close?.()
  const data = ctx.getImageData(0, 0, c.width, c.height).data
  return { hash: await sha256(new Uint8Array(data.buffer)), w, h }
}
