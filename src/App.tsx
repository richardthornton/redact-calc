import { type CSSProperties, useEffect, useReducer, useRef, useState } from 'react'
import { type Action, type Op, describe, group, initialState, preview, reduce } from './calc/engine'

type Kind = 'fn' | 'num' | 'op' | 'eq'

interface Key {
  id: string
  label: string
  aria: string
  kind: Kind
  action: Action
}

const op = (o: Op, label: string, aria: string): Key => ({ id: o, label, aria, kind: 'op', action: { type: 'op', op: o } })
const digit = (d: string): Key => ({ id: d, label: d, aria: d, kind: 'num', action: { type: 'digit', d } })

const KEYS: Key[] = [
  { id: 'clear', label: 'AC', aria: 'All clear', kind: 'fn', action: { type: 'clear' } },
  { id: 'negate', label: '±', aria: 'Toggle sign', kind: 'fn', action: { type: 'negate' } },
  { id: 'percent', label: '%', aria: 'Percent', kind: 'fn', action: { type: 'percent' } },
  op('÷', '÷', 'Divide'),
  digit('7'),
  digit('8'),
  digit('9'),
  op('×', '×', 'Multiply'),
  digit('4'),
  digit('5'),
  digit('6'),
  op('-', '−', 'Subtract'),
  digit('1'),
  digit('2'),
  digit('3'),
  op('+', '+', 'Add'),
  { id: 'backspace', label: '⌫', aria: 'Delete', kind: 'fn', action: { type: 'backspace' } },
  digit('0'),
  { id: 'dot', label: '.', aria: 'Decimal point', kind: 'num', action: { type: 'dot' } },
  { id: 'equals', label: '=', aria: 'Equals', kind: 'eq', action: { type: 'equals' } },
]

/** Physical keyboard → key id. */
const KEYBOARD: Record<string, string> = {
  '+': '+',
  '-': '-',
  '*': '×',
  x: '×',
  '/': '÷',
  '=': 'equals',
  Enter: 'equals',
  '.': 'dot',
  ',': 'dot',
  '%': 'percent',
  Backspace: 'backspace',
  Delete: 'clear',
  Escape: 'clear',
  F9: 'negate',
}
for (let d = 0; d <= 9; d++) KEYBOARD[String(d)] = String(d)

const BY_ID = new Map(KEYS.map((k) => [k.id, k]))

export function App() {
  const [state, dispatch] = useReducer(reduce, initialState)
  const [flash, setFlash] = useState<string | null>(null)
  const [wipes, setWipes] = useState(0)
  const [copied, setCopied] = useState(false)
  const timers = useRef<{ flash?: number; copied?: number }>({})

  const press = (key: Key) => {
    if (key.id === 'clear' && (state.tokens.length || state.result !== null)) setWipes((n) => n + 1)
    dispatch(key.action)
  }

  // Keep the latest `press` reachable from the one-time keyboard listener.
  const pressRef = useRef(press)
  pressRef.current = press

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const key = BY_ID.get(KEYBOARD[e.key])
      if (!key) return
      e.preventDefault()
      pressRef.current(key)
      setFlash(key.id)
      clearTimeout(timers.current.flash)
      timers.current.flash = window.setTimeout(() => setFlash(null), 120)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const live = preview(state)
  const main = state.result !== null ? (state.error ? state.result : group(state.result)) : state.tokens.length ? describe(state.tokens) : '0'
  const sub = state.result !== null ? `${state.history} =` : live !== null ? `= ${group(live)}` : ''
  const pendingOp = state.tokens.at(-1)?.t === 'op' ? state.tokens.at(-1)!.v : null
  const copyable = state.result !== null && !state.error ? state.result : (live ?? null)
  const hasInput = state.tokens.length > 0 || state.result !== null

  const copy = async () => {
    if (copyable === null) return
    try {
      await navigator.clipboard.writeText(copyable)
      setCopied(true)
      clearTimeout(timers.current.copied)
      timers.current.copied = window.setTimeout(() => setCopied(false), 1400)
    } catch {
      // Clipboard can be unavailable (permissions, insecure context); copying is a nicety.
    }
  }

  return (
    <main className="shell">
      <section className="calc" aria-label="Calculator">
        <header className="bar">
          <span className="brand">
            <span className="redacted" aria-label="redact">
              redact
            </span>
            <span className="slash">/</span>calc
          </span>
          <span className={'chip' + (copied ? ' chip--on' : '')} role="status">
            {copied ? 'Copied' : ''}
          </span>
        </header>

        <button
          type="button"
          className={'display' + (state.error ? ' display--error' : '') + (state.result !== null ? ' display--result' : '')}
          onClick={copy}
          disabled={copyable === null}
          aria-label={copyable !== null ? `Result ${copyable}. Click to copy.` : `Display ${main}`}
        >
          <span className="sub" aria-hidden="true">
            <span>{sub}</span>
          </span>
          <output className="main" aria-live="polite" style={{ '--chars': main.length } as CSSProperties} key={state.result !== null ? `r${state.history}` : 'live'}>
            {main}
          </output>
          {wipes > 0 && <span className="wipe" key={wipes} aria-hidden="true" />}
        </button>

        <div className="keys">
          {KEYS.map((key) => (
            <button
              key={key.id}
              type="button"
              className={`key key--${key.kind}`}
              aria-label={key.id === 'clear' && hasInput ? 'Clear' : key.aria}
              aria-pressed={key.kind === 'op' ? pendingOp === key.id : undefined}
              data-active={flash === key.id ? '' : undefined}
              onClick={() => press(key)}
            >
              {key.id === 'backspace' ? <BackspaceIcon /> : key.id === 'clear' && hasInput ? 'C' : key.label}
            </button>
          ))}
        </div>
      </section>

      <footer className="foot">
        <p>
          Type to calculate · <kbd>Esc</kbd> clears · tap the display to copy
        </p>
        <p>
          Rendered by{' '}
          <a href="https://tanstack.com/blog/introducing-tanstack-redact" rel="noopener noreferrer" target="_blank">
            TanStack Redact
          </a>{' '}
          — no React in the bundle.
        </p>
      </footer>
    </main>
  )
}

function BackspaceIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6-7z" />
      <path d="m12 9.5 5 5m0-5-5 5" />
    </svg>
  )
}
