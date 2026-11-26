// AI agent via the Pollinations OpenAI-compatible endpoint.
export const DEFAULT_CFG = { endpoint: 'https://gen.pollinations.ai/v1/chat/completions', model: 'openai', key: '' }

export const ACTION_KEYS = ['exif', 'gps', 'thumbnail', 'iptc', 'xmp', 'text', 'c2pa', 'comments', 'icc']
export const TABS = ['library', 'viewer', 'compare', 'remove', 'editor', 'optimize', 'crop', 'background', 'palette', 'duplicates', 'privacy']

const SYSTEM = `You are the assistant inside AI MetaWipe, a browser tool for viewing, removing and editing image metadata and for simple PNG and image tasks.
You get a JSON summary of the images the user has loaded. Explain what the metadata means, point out privacy risks in plain language, and suggest the next step.
Be short and direct. Never invent metadata that is not in the summary. Say so when you do not know.
You cannot see the pixels. Invisible pixel watermarks (such as SynthID) are not metadata and this tool cannot remove them.
When you recommend something the user can apply, finish your answer with one fenced block named actions, containing a JSON array. Allowed items:
{"type":"sanitize","label":"short button text","options":{"gps":true}} where option keys are only: ${ACTION_KEYS.join(', ')}
{"type":"open","label":"short button text","tab":"one of: ${TABS.join(', ')}"}
Example:
\`\`\`actions
[{"type":"sanitize","label":"Remove GPS","options":{"gps":true}}]
\`\`\`
Only add actions that match what you just said. Skip the block when no action is needed.`

export function buildContext(items, selectedId, includeValues) {
  const summary = items.slice(0, 12).map((it) => {
    const m = it.meta
    const o = {
      id: it.id, name: m.name, selected: it.id === selectedId, format: m.format, size: m.size,
      width: m.width, height: m.height, hasExif: !!m.exif, hasGps: !!(m.gps || m.hasGpsTags),
      hasIptc: !!m.iptc, hasXmp: !!m.xmp, hasThumbnail: !!m.thumbBytes, hasC2pa: !!m.c2pa,
      pngTextKeywords: (m.pngText || []).map((t) => t.keyword), appendedBytes: m.appended || 0,
      possibleAi: m.ai, privacyScore: it.score, risks: it.risks.map((r) => `${r.level}: ${r.title}`),
    }
    if (includeValues) {
      o.exif = m.exif ? { ...m.exif.ifd0, ...m.exif.exif } : undefined
      o.gps = m.gps || undefined
      o.xmp = m.xmp?.fields
      o.pngText = (m.pngText || []).map((t) => ({ keyword: t.keyword, text: t.text.slice(0, 600) }))
    }
    return o
  })
  return JSON.stringify(summary)
}

export async function askAgent({ cfg, history, context, signal }) {
  const messages = [
    { role: 'system', content: `${SYSTEM}\n\nLoaded images (JSON):\n${context}` },
    ...history.map((h) => ({ role: h.role, content: h.content })),
  ]
  const headers = { 'Content-Type': 'application/json' }
  if (cfg.key) headers.Authorization = `Bearer ${cfg.key}`
  let res
  try {
    res = await fetch(cfg.endpoint, { method: 'POST', headers, body: JSON.stringify({ model: cfg.model, messages, temperature: 0.4 }), signal })
  } catch (e) {
    if (e.name === 'AbortError') throw e
    throw new Error('Could not reach the Pollinations API. Check your internet connection and the endpoint in Settings.')
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    if (res.status === 401 || res.status === 403) throw new Error('Pollinations rejected the request. Add a valid API key in Settings (get one at enter.pollinations.ai).')
    if (res.status === 402 || res.status === 429) throw new Error('Pollinations limit reached or no credit left. Try again later or use another key.')
    throw new Error(`Pollinations error ${res.status}. ${body.slice(0, 160)}`)
  }
  const data = await res.json()
  const text = data?.choices?.[0]?.message?.content
  if (!text) throw new Error('The model returned an empty answer.')
  return text
}

export function parseActions(text) {
  const m = /```actions\s*([\s\S]*?)```/.exec(text)
  const clean = text.replace(/```actions[\s\S]*?```/g, '').trim()
  if (!m) return { clean, actions: [] }
  try {
    const arr = JSON.parse(m[1])
    const actions = (Array.isArray(arr) ? arr : []).slice(0, 4).flatMap((a) => {
      if (a?.type === 'sanitize' && a.options && typeof a.options === 'object') {
        const options = {}
        for (const k of ACTION_KEYS) if (a.options[k] === true) options[k] = true
        return Object.keys(options).length ? [{ type: 'sanitize', label: String(a.label || 'Apply').slice(0, 40), options }] : []
      }
      if (a?.type === 'open' && TABS.includes(a.tab)) return [{ type: 'open', label: String(a.label || 'Open').slice(0, 40), tab: a.tab }]
      return []
    })
    return { clean, actions }
  } catch {
    return { clean, actions: [] }
  }
}
