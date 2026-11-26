import { selectiveStrip } from './edit.js'
import { processFile } from './strip.js'

/* Remove metadata with chosen options. Falls back to a canvas redraw for formats we cannot rewrite. */
export async function cleanFile(file, bytes, { opts, redraw, quality = 0.95, otherFormat = 'image/png' }) {
  const base = file.name.replace(/\.[^.]+$/, '')
  if (!redraw) {
    const r = selectiveStrip(bytes, opts)
    if (r.data) {
      const ext = { jpeg: 'jpg', png: 'png', webp: 'webp' }[r.type]
      const mime = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[r.type]
      return { name: `${base}-clean.${ext}`, blob: new Blob([r.data], { type: mime }), removed: r.removed, note: '', originalSize: file.size, newSize: r.data.length }
    }
  }
  const r = await processFile(file, { mode: 'reencode', quality, otherFormat })
  return { ...r, note: r.type === 'other' ? 'Converted. All embedded metadata dropped.' : 'Redrawn from pixels. All metadata dropped.' }
}
