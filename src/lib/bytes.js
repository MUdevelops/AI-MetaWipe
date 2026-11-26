export const latin1 = new TextDecoder('latin1')
export const utf8 = new TextDecoder('utf-8')
export const enc = new TextEncoder()
export const ascii = (b, s, e) => latin1.decode(b.subarray(s, e))

export function concat(parts) {
  const total = parts.reduce((n, p) => n + p.length, 0)
  const out = new Uint8Array(total)
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

export const hex = (u8, max = 16) =>
  [...u8.subarray(0, max)].map((x) => x.toString(16).padStart(2, '0')).join(' ')

export async function inflate(u8) {
  const ds = new DecompressionStream('deflate')
  const stream = new Blob([u8]).stream().pipeThrough(ds)
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

export function fmtSize(n) {
  if (n >= 1048576) return `${(n / 1048576).toFixed(2)} MB`
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${n} B`
}
