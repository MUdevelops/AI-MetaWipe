import { useCallback, useEffect, useRef, useState } from 'react'
import { readMetadata } from './lib/meta.js'
import { analyzeRisks, privacyScore } from './lib/privacy.js'
import { ALL_OPTS, NONE_OPTS } from './lib/edit.js'
import { CATS, toolById } from './lib/tools.js'
import { IMG_EXT } from './components/ui.jsx'
import { Icon } from './components/Icon.jsx'
import { useToast } from './components/Toast.jsx'
import { Confirm } from './components/Confirm.jsx'
import Topbar from './components/shell/Topbar.jsx'
import Sidebar from './components/shell/Sidebar.jsx'
import Footer from './components/shell/Footer.jsx'
import SettingsModal from './components/shell/SettingsModal.jsx'
import Overview from './components/pages/Overview.jsx'
import ToolsDirectory from './components/pages/ToolsDirectory.jsx'
import Workflows from './components/pages/Workflows.jsx'
import Help from './components/pages/Help.jsx'
import Library from './components/Library.jsx'
import Viewer from './components/Viewer.jsx'
import Compare from './components/Compare.jsx'
import Remover from './components/Remover.jsx'
import Editor from './components/Editor.jsx'
import Optimize from './components/Optimize.jsx'
import Crop from './components/Crop.jsx'
import Background from './components/Background.jsx'
import Palette from './components/Palette.jsx'
import Duplicates from './components/Duplicates.jsx'
import Privacy from './components/Privacy.jsx'
import Agent from './components/Agent.jsx'

const UI_KEY = 'metawipe.ui'
const loadUi = () => { try { return { theme: 'dark', collapsed: false, ...JSON.parse(localStorage.getItem(UI_KEY) || '{}') } } catch { return { theme: 'dark', collapsed: false } } }
const PRESETS = { all: { ...NONE_OPTS, ...ALL_OPTS }, gps: { ...NONE_OPTS, gps: true }, ai: { ...NONE_OPTS, text: true, xmp: true, c2pa: true } }
const hasGps = (m) => !!(m.gps || m.hasGpsTags)

export default function App() {
  const toast = useToast()
  const [items, setItems] = useState([])
  const [selId, setSelId] = useState(null)
  const [view, setViewRaw] = useState('overview')
  const [removeOpts, setRemoveOpts] = useState(PRESETS.all)
  const [loading, setLoading] = useState(0)
  const [lastVerify, setLastVerify] = useState(null)
  const [agentSeed, setAgentSeed] = useState(null)
  const [ui, setUi] = useState(loadUi)
  const [sysDark, setSysDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true)
  const [drawer, setDrawer] = useState(false)
  const [settings, setSettings] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const idRef = useRef(0)
  const urls = useRef(new Map())
  const main = useRef(null)
  const first = useRef(true)

  const resolved = ui.theme === 'system' ? (sysDark ? 'dark' : 'light') : ui.theme
  const sel = items.find((i) => i.id === selId) || items[0]

  useEffect(() => { document.documentElement.dataset.theme = resolved }, [resolved])
  useEffect(() => { try { localStorage.setItem(UI_KEY, JSON.stringify(ui)) } catch { /* storage blocked */ } }, [ui])
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!mq) return undefined
    const f = (e) => setSysDark(e.matches)
    mq.addEventListener('change', f)
    return () => mq.removeEventListener('change', f)
  }, [])
  useEffect(() => {
    if (first.current) { first.current = false; return }
    main.current?.focus({ preventScroll: true })
    window.scrollTo({ top: 0 })
  }, [view])
  useEffect(() => {
    if (!drawer) return undefined
    const k = (e) => e.key === 'Escape' && setDrawer(false)
    document.addEventListener('keydown', k)
    return () => document.removeEventListener('keydown', k)
  }, [drawer])

  const setView = useCallback((v) => { setViewRaw(v); setDrawer(false) }, [])

  const addFiles = useCallback(async (list) => {
    const files = [...list].filter((f) => f.type.startsWith('image/') || IMG_EXT.test(f.name))
    if (!files.length) return toast('No image files found in that selection.', 'info')
    setLoading((n) => n + files.length)
    let added = 0
    for (const file of files) {
      const id = ++idRef.current
      try {
        const meta = await readMetadata(file)
        const risks = analyzeRisks(meta)
        const { score, label } = privacyScore(risks)
        const url = URL.createObjectURL(file)
        urls.current.set(id, url)
        setItems((s) => [...s, { id, file, meta, risks, score, label, url }])
        setSelId((cur) => cur ?? id)
        added++
      } catch (e) {
        toast(`Could not read ${file.name}: ${e.message}`, 'danger')
      }
      setLoading((n) => n - 1)
    }
    if (added) toast(`${added} image${added > 1 ? 's' : ''} added to your workspace.`)
  }, [toast])

  const removeItems = useCallback((ids) => {
    ids.forEach((id) => { URL.revokeObjectURL(urls.current.get(id)); urls.current.delete(id) })
    setItems((s) => s.filter((i) => !ids.includes(i.id)))
  }, [])

  const askClear = () => setConfirm({
    title: 'Clear the whole workspace?',
    body: `This removes ${items.length} image${items.length > 1 ? 's' : ''} from the list. Your original files on disk are not touched.`,
    confirmLabel: 'Clear workspace', danger: true,
    run: () => { removeItems(items.map((i) => i.id)); toast('Workspace cleared.', 'info') },
  })
  const askRemoveMany = (ids) => setConfirm({
    title: `Remove ${ids.length} image${ids.length > 1 ? 's' : ''} from the list?`,
    body: 'They are only taken out of this workspace. Your files on disk are not touched.',
    confirmLabel: 'Remove from list', danger: true,
    run: () => { removeItems(ids); toast(`${ids.length} image${ids.length > 1 ? 's' : ''} removed from the list.`, 'info') },
  })

  const openTool = (id, preset) => {
    if (preset) setRemoveOpts(preset.__all ? PRESETS.all : { ...NONE_OPTS, ...preset })
    setView(id)
  }
  const onStep = (s) => {
    if (s.preset) setRemoveOpts(PRESETS[s.preset])
    setView(s.tool)
  }
  const onInspect = (id, tool) => { setSelId(id); setView(tool) }
  const onAgentPrompt = (text) => { setAgentSeed({ text, n: Date.now() }); setView('agent') }
  const onAction = (a) => {
    if (a.type === 'sanitize') {
      setRemoveOpts({ ...NONE_OPTS, ...a.options })
      setView('remove')
      toast('The agent filled in the options. Review them, then press Clean now.', 'info')
    } else setView(a.tab)
  }

  const gps = items.filter((i) => hasGps(i.meta)).length
  const status = loading
    ? { tone: 'busy', text: `Reading ${loading}…` }
    : !items.length ? { tone: 'idle', text: 'Workspace empty' }
      : { tone: gps ? 'warn' : 'ok', text: `${items.length} image${items.length > 1 ? 's' : ''}${gps ? ` · ${gps} with GPS` : ''}` }
  const badges = {
    library: items.length ? { text: String(items.length), tone: 'info' } : null,
    privacy: gps ? { text: 'GPS', tone: 'warn' } : null,
  }

  const common = { items, sel, onSel: setSelId }
  const tool = toolById(view)
  const cat = tool && CATS.find((c) => c.id === tool.cat)

  let page
  if (view === 'overview') page = <Overview items={items} loading={loading} lastVerify={lastVerify} onAdd={addFiles} setView={setView} openTool={openTool} onInspect={onInspect} onAgentPrompt={onAgentPrompt} />
  else if (view === 'tools') page = <ToolsDirectory onOpen={openTool} total={items.length} />
  else if (view === 'workflows') page = <Workflows onStep={onStep} total={items.length} />
  else if (view === 'help') page = <Help onOpen={openTool} />
  else if (tool) {
    page = (
      <div className="page tool-page">
        <div className="crumbs">
          <button className="linkish" onClick={() => setView('tools')}>Tools</button><Icon name="right" size={14} />
          <span>{cat.label}</span><Icon name="right" size={14} /><b>{tool.name}</b>
        </div>
        <div className="tool-banner">
          <span className="tool-ico"><Icon name={tool.icon} size={24} /></span>
          <div><h1>{tool.name}</h1><p className="sub">{tool.desc}</p></div>
        </div>
        {view === 'library' && <Library items={items} sel={sel} onSelect={setSelId} onAdd={addFiles} onRemove={(ids) => { removeItems(ids); toast('Image removed from the list.', 'info') }} onClear={askClear} setTab={setView} loading={loading} />}
        {view === 'viewer' && <Viewer sel={sel} />}
        {view === 'compare' && <Compare items={items} sel={sel} />}
        {view === 'remove' && <Remover {...common} opts={removeOpts} setOpts={setRemoveOpts} />}
        {view === 'editor' && <Editor {...common} />}
        {view === 'optimize' && <Optimize {...common} />}
        {view === 'crop' && <Crop {...common} />}
        {view === 'background' && <Background {...common} />}
        {view === 'palette' && <Palette {...common} />}
        {view === 'duplicates' && <Duplicates items={items} onRemove={askRemoveMany} />}
        {view === 'privacy' && <Privacy {...common} onVerified={setLastVerify} />}
        {view === 'agent' && <Agent items={items} sel={sel} onAction={onAction} seed={agentSeed} />}
      </div>
    )
  }

  return (
    <div className={`app ${ui.collapsed ? 'is-collapsed' : ''}`}>
      <a className="skip" href="#main">Skip to content</a>
      <Topbar view={view} setView={setView} onMenu={() => setDrawer(true)} theme={ui.theme} resolved={resolved} onTheme={() => setUi((u) => ({ ...u, theme: resolved === 'dark' ? 'light' : 'dark' }))} onSettings={() => setSettings(true)} status={status} />
      <div className="body">
        <Sidebar view={view} setView={setView} collapsed={ui.collapsed} onToggle={() => setUi((u) => ({ ...u, collapsed: !u.collapsed }))} open={drawer} onClose={() => setDrawer(false)} onSettings={() => setSettings(true)} badges={badges} />
        <main id="main" ref={main} tabIndex={-1}>
          {gps > 0 && view !== 'privacy' && (
            <div className="flash danger" role="alert">
              <Icon name="pin" size={18} /><span><b>GPS alert.</b> {gps} loaded image{gps > 1 ? 's contain' : ' contains'} location data.</span>
              <button className="btn small" onClick={() => setView('privacy')}>Open Privacy Center</button>
            </div>
          )}
          <div key={view} className="page-anim">{page}</div>
          <Footer openTool={openTool} setView={setView} />
        </main>
      </div>
      <Confirm open={!!confirm} title={confirm?.title} body={confirm?.body} confirmLabel={confirm?.confirmLabel} danger={confirm?.danger} onCancel={() => setConfirm(null)} onConfirm={() => { confirm.run(); setConfirm(null) }} />
      <SettingsModal
        open={settings} onClose={() => setSettings(false)} theme={ui.theme} setTheme={(theme) => setUi((u) => ({ ...u, theme }))} collapsed={ui.collapsed} setCollapsed={(collapsed) => setUi((u) => ({ ...u, collapsed }))} total={items.length}
        onResetTemplates={() => { setSettings(false); setConfirm({ title: 'Delete saved templates?', body: 'Your metadata templates will be removed from this browser. This cannot be undone.', confirmLabel: 'Delete templates', danger: true, run: () => { try { localStorage.removeItem('metawipe.templates') } catch { /* blocked */ } toast('Saved templates deleted.', 'info') } }) }}
        onResetUi={() => { setUi({ theme: 'dark', collapsed: false }); toast('Interface preferences reset.', 'info') }}
      />
    </div>
  )
}
