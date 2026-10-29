/**
 * Pure calculator engine. The UI dispatches `Action`s into `reduce` and renders
 * whatever comes back, so all behaviour lives here and is unit-tested.
 */

export type Op = '+' | '-' | '×' | '÷'

export type Token = { t: 'num'; v: string } | { t: 'op'; v: Op }

export interface State {
  tokens: Token[]
  /** Set after `=`; the expression that produced the current result. */
  history: string | null
  /** Set after `=`; the formatted result shown as the main value. */
  result: string | null
  error: boolean
  /** Remembered so repeated `=` re-applies the last operation (5 + 2 = = → 9). */
  repeat: { op: Op; operand: string } | null
}

export type Action =
  | { type: 'digit'; d: string }
  | { type: 'dot' }
  | { type: 'op'; op: Op }
  | { type: 'equals' }
  | { type: 'clear' }
  | { type: 'backspace' }
  | { type: 'negate' }
  | { type: 'percent' }

export const initialState: State = {
  tokens: [],
  history: null,
  result: null,
  error: false,
  repeat: null,
}

const MAX_DIGITS = 15
const PRECEDENCE: Record<Op, number> = { '+': 1, '-': 1, '×': 2, '÷': 2 }

export class MathError extends Error {}

/** Round away float noise (0.1 + 0.2) and pick a readable notation. */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) throw new MathError('Not a number')
  const rounded = Number(n.toPrecision(12))
  if (rounded === 0) return '0'
  const abs = Math.abs(rounded)
  if (abs >= 1e15 || abs < 1e-7) {
    return rounded
      .toExponential(8)
      .replace(/\.?0+e/, 'e')
      .replace('e+', 'e')
  }
  return String(rounded)
}

function apply(a: number, op: Op, b: number): number {
  switch (op) {
    case '+':
      return a + b
    case '-':
      return a - b
    case '×':
      return a * b
    case '÷':
      if (b === 0) throw new MathError("Can't divide by zero")
      return a / b
  }
}

/** Evaluates a token list with standard precedence (× ÷ before + −). */
export function evaluate(tokens: Token[]): number {
  const values: number[] = []
  const ops: Op[] = []
  const reduceTop = () => {
    const b = values.pop()!
    const a = values.pop()!
    values.push(apply(a, ops.pop()!, b))
  }
  for (const tok of tokens) {
    if (tok.t === 'num') {
      values.push(Number(tok.v))
      continue
    }
    while (ops.length && PRECEDENCE[ops[ops.length - 1]] >= PRECEDENCE[tok.v]) reduceTop()
    ops.push(tok.v)
  }
  while (ops.length) reduceTop()
  return values[0] ?? 0
}

/** Drops a trailing operator / dangling decimal point so the list can be evaluated. */
function complete(tokens: Token[]): Token[] {
  const out = tokens.slice()
  if (out.at(-1)?.t === 'op') out.pop()
  const last = out.at(-1)
  if (last?.t === 'num' && last.v.endsWith('.')) out[out.length - 1] = { t: 'num', v: last.v.slice(0, -1) }
  return out
}

/** Live "= …" preview while typing; null when there is nothing worth previewing. */
export function preview(state: State): string | null {
  if (state.result !== null) return null
  const tokens = complete(state.tokens)
  if (!tokens.some((t) => t.t === 'op')) return null
  try {
    return formatNumber(evaluate(tokens))
  } catch {
    return null
  }
}

/** Adds thousands separators to plain decimals; exponent forms pass through untouched. */
export function group(v: string): string {
  if (v.includes('e')) return v
  const [int, frac] = v.split('.')
  const sign = int.startsWith('-') ? '−' : ''
  const digits = int.replace('-', '').replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return sign + digits + (frac !== undefined ? '.' + frac : '')
}

export function describe(tokens: Token[]): string {
  return tokens.map((t) => (t.t === 'num' ? group(t.v) : t.v === '-' ? '−' : t.v)).join(' ')
}

/** Start a fresh expression from the shown result (e.g. pressing + after =). */
function continueFrom(state: State): Token[] {
  return state.result !== null && !state.error ? [{ t: 'num', v: state.result }] : []
}

function withLastNum(state: State, fn: (v: string) => string | null): State {
  const tokens = state.tokens.slice()
  const last = tokens.at(-1)
  if (last?.t !== 'num') return state
  const next = fn(last.v)
  if (next === null) return state
  if (next === '') tokens.pop()
  else tokens[tokens.length - 1] = { t: 'num', v: next }
  return { ...state, tokens }
}

function digitCount(v: string): number {
  return v.replace(/[-.]/g, '').length
}

export function reduce(state: State, action: Action): State {
  // Any input after a result (other than operators/negate/percent) starts over.
  const fresh = state.result !== null

  switch (action.type) {
    case 'clear':
      return initialState

    case 'digit': {
      if (fresh) return { ...initialState, tokens: [{ t: 'num', v: action.d }] }
      const last = state.tokens.at(-1)
      if (last?.t !== 'num') return { ...state, tokens: [...state.tokens, { t: 'num', v: action.d }] }
      return withLastNum(state, (v) => {
        if (v.includes('e') || digitCount(v) >= MAX_DIGITS) return null
        if (v === '0') return action.d
        if (v === '-0') return '-' + action.d
        return v + action.d
      })
    }

    case 'dot': {
      if (fresh) return { ...initialState, tokens: [{ t: 'num', v: '0.' }] }
      const last = state.tokens.at(-1)
      if (last?.t !== 'num') return { ...state, tokens: [...state.tokens, { t: 'num', v: '0.' }] }
      return withLastNum(state, (v) => (v.includes('.') || v.includes('e') ? null : v + '.'))
    }

    case 'op': {
      // complete() drops a trailing operator, so re-pressing one swaps it.
      let tokens = fresh ? continueFrom(state) : complete(state.tokens)
      if (tokens.length === 0) tokens = [{ t: 'num', v: '0' }]
      return { ...initialState, tokens: [...tokens, { t: 'op', v: action.op }] }
    }

    case 'equals': {
      let tokens: Token[]
      let repeat = state.repeat
      if (fresh) {
        if (!repeat || state.error) return state
        tokens = [{ t: 'num', v: state.result! }, { t: 'op', v: repeat.op }, { t: 'num', v: repeat.operand }]
      } else {
        tokens = complete(state.tokens)
        if (tokens.length === 0) return state
        const n = tokens.length
        repeat = n >= 3 && tokens[n - 2].t === 'op' ? { op: tokens[n - 2].v as Op, operand: tokens[n - 1].v } : null
      }
      const history = describe(tokens)
      try {
        return { tokens: [], history, result: formatNumber(evaluate(tokens)), error: false, repeat }
      } catch (e) {
        const message = e instanceof MathError ? e.message : 'Error'
        return { tokens: [], history, result: message, error: true, repeat: null }
      }
    }

    case 'backspace': {
      if (fresh) return initialState
      const last = state.tokens.at(-1)
      if (!last) return state
      if (last.t === 'op') return { ...state, tokens: state.tokens.slice(0, -1) }
      return withLastNum(state, (v) => {
        if (v.includes('e')) return ''
        const next = v.slice(0, -1)
        return next === '-' ? '' : next
      })
    }

    case 'negate': {
      if (fresh) {
        if (state.error) return state
        const v = state.result!
        return { ...initialState, tokens: [{ t: 'num', v: v.startsWith('-') ? v.slice(1) : '-' + v }] }
      }
      const last = state.tokens.at(-1)
      if (last?.t !== 'num') return { ...state, tokens: [...state.tokens, { t: 'num', v: '-0' }] }
      return withLastNum(state, (v) => (v.startsWith('-') ? v.slice(1) : '-' + v))
    }

    case 'percent': {
      if (fresh) {
        if (state.error) return state
        return { ...initialState, tokens: [{ t: 'num', v: formatNumber(Number(state.result) / 100) }] }
      }
      return withLastNum(state, (v) => formatNumber(Number(v) / 100))
    }
  }
}
