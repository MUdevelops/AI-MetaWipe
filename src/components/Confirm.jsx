import { useEffect, useRef } from 'react'

export function Modal({ open, title, onClose, children, wide }) {
  const box = useRef(null)
  const prev = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    prev.current = document.activeElement
    const first = box.current?.querySelector('[data-autofocus], button, input, select')
    first?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Tab') {
        const f = [...box.current.querySelectorAll('button:not([disabled]), input, select, a[href], [tabindex]:not([tabindex="-1"])')]
        if (!f.length) return
        const a = f[0]
        const z = f[f.length - 1]
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus() }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); prev.current?.focus?.() }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div ref={box} className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  )
}

export function Confirm({ open, title, body, confirmLabel = 'Confirm', danger, onConfirm, onCancel }) {
  return (
    <Modal open={open} title={title} onClose={onCancel}>
      <p className="modal-body">{body}</p>
      <div className="row end">
        <button className="btn" data-autofocus onClick={onCancel}>Cancel</button>
        <button className={`btn ${danger ? 'danger' : 'primary'}`} onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </Modal>
  )
}
