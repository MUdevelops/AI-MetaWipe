import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { Icon } from './Icon.jsx'

const Ctx = createContext(() => {})
export const useToast = () => useContext(Ctx)

export function ToastProvider({ children }) {
  const [list, setList] = useState([])
  const id = useRef(0)
  const dismiss = useCallback((i) => setList((l) => l.filter((t) => t.id !== i)), [])
  const push = useCallback((text, kind = 'ok') => {
    const i = ++id.current
    setList((l) => [...l.slice(-3), { id: i, text, kind }])
    setTimeout(() => dismiss(i), kind === 'danger' ? 8000 : 4500)
  }, [dismiss])
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {list.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            <Icon name={t.kind === 'danger' ? 'alert' : t.kind === 'info' ? 'info' : 'check'} size={18} />
            <span>{t.text}</span>
            <button className="toast-x" onClick={() => dismiss(t.id)} aria-label="Dismiss notification"><Icon name="x" size={16} /></button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}
