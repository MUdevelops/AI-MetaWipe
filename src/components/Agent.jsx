import { useEffect, useRef, useState } from 'react'
import { Panel, Flash } from './ui.jsx'
import { DEFAULT_CFG, buildContext, askAgent, parseActions } from '../lib/agent.js'

const KEY = 'metawipe.agent'
const QUICK = [
  'Explain the metadata in my selected image in simple words.',
  'Is it safe to share this image publicly?',
  'What exactly should I remove, and what can I keep?',
  'Does this image look AI generated? What in the metadata says so?',
]

function load() { try { return { ...DEFAULT_CFG, ...JSON.parse(localStorage.getItem(KEY) || '{}') } } catch { return DEFAULT_CFG } }

function Rich({ text }) {
  const lines = text.split('\n')
  const out = []
  let list = []
  const inline = (s, k) => s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) => (p.startsWith('**') ? <b key={`${k}${i}`}>{p.slice(2, -2)}</b> : p.startsWith('`') ? <code key={`${k}${i}`}>{p.slice(1, -1)}</code> : p))
  const flush = () => { if (list.length) { out.push(<ul key={`u${out.length}`}>{list}</ul>); list = [] } }
  lines.forEach((l, i) => {
    const t = l.trim()
    if (/^[-*•]\s+/.test(t)) list.push(<li key={i}>{inline(t.replace(/^[-*•]\s+/, ''), i)}</li>)
    else { flush(); if (t) out.push(<p key={i}>{inline(t, i)}</p>) }
  })
  flush()
  return <>{out}</>
}

export default function Agent({ items, sel, onAction, seed }) {
  const [cfg, setCfg] = useState(load)
  const [showCfg, setShowCfg] = useState(false)
  const [values, setValues] = useState(false)
  const [chat, setChat] = useState([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const end = useRef(null)
  const ctl = useRef(null)
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }) }, [chat, busy])
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(cfg)) } catch { /* blocked */ } }, [cfg])

  useEffect(() => { if (seed?.text) send(seed.text) }, [seed?.n]) // eslint-disable-line react-hooks/exhaustive-deps

  async function send(text) {
    const q = (text ?? input).trim()
    if (!q || busy) return
    const history = [...chat, { role: 'user', content: q }]
    setChat(history); setInput(''); setErr(''); setBusy(true)
    ctl.current = new AbortController()
    try {
      const raw = await askAgent({ cfg, history: history.slice(-10), context: buildContext(items, sel?.id, values), signal: ctl.current.signal })
      const { clean, actions } = parseActions(raw)
      setChat((c) => [...c, { role: 'assistant', content: clean || raw, actions }])
    } catch (e) {
      if (e.name !== 'AbortError') setErr(e.message)
    }
    setBusy(false)
  }

  return (
    <Panel
      title="AI Agent"
      hint="Ask about your images. The agent reads a summary of the loaded files and can suggest actions you approve with one click."
      actions={<button className="btn" onClick={() => setShowCfg((v) => !v)} aria-expanded={showCfg}>Settings</button>}
    >
      {showCfg && (
        <div className="card">
          <label className="field">Pollinations API key<input type="password" autoComplete="off" value={cfg.key} placeholder="Paste your key (optional)" onChange={(e) => setCfg({ ...cfg, key: e.target.value.trim() })} /></label>
          <p className="meta">Get a key at enter.pollinations.ai. It is saved only in this browser. Do not use a key you cannot afford to expose, because browser apps can always be inspected.</p>
          <div className="two">
            <label className="field">Model<input value={cfg.model} onChange={(e) => setCfg({ ...cfg, model: e.target.value.trim() })} /></label>
            <label className="field">Endpoint<input value={cfg.endpoint} onChange={(e) => setCfg({ ...cfg, endpoint: e.target.value.trim() })} /></label>
          </div>
          <button className="btn small" onClick={() => setCfg(DEFAULT_CFG)}>Reset to defaults</button>
        </div>
      )}

      <Flash kind="info">
        Privacy: the agent runs on the Pollinations service, so the questions you type and a summary of your metadata are sent to it. Pixels are never sent.
        <label className="check inline"><input type="checkbox" checked={values} onChange={(e) => setValues(e.target.checked)} /><span><b>Also share field values</b><small>Camera names, GPS coordinates, prompts and text. Off by default, so the agent only sees which kinds of data exist.</small></span></label>
      </Flash>

      {!items.length && <p className="empty">Add images first so the agent has something to look at. You can still ask general questions.</p>}

      <div className="chat" aria-live="polite">
        {!chat.length && (
          <div className="presets">{QUICK.map((q) => <button key={q} className="chip" onClick={() => send(q)}>{q}</button>)}</div>
        )}
        {chat.map((c, i) => (
          <div key={i} className={`msg ${c.role}`}>
            <Rich text={c.content} />
            {c.actions?.length > 0 && (
              <div className="row">
                {c.actions.map((a, k) => <button key={k} className="btn small primary" onClick={() => onAction(a)}>{a.label}</button>)}
              </div>
            )}
          </div>
        ))}
        {busy && <div className="msg assistant"><span className="spin" /> Thinking…</div>}
        <div ref={end} />
      </div>
      {err && <Flash kind="danger">{err}</Flash>}
      <form className="row" onSubmit={(e) => { e.preventDefault(); send() }}>
        <input className="grow" aria-label="Message" placeholder="Ask about metadata, privacy or what to clean…" value={input} onChange={(e) => setInput(e.target.value)} />
        {busy ? <button type="button" className="btn" onClick={() => ctl.current?.abort()}>Stop</button> : <button className="btn primary" disabled={!input.trim()}>Send</button>}
        {chat.length > 0 && <button type="button" className="btn" onClick={() => { setChat([]); setErr('') }}>New chat</button>}
      </form>
    </Panel>
  )
}
