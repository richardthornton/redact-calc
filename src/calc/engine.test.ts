import { describe, expect, it } from 'vitest'
import { type Action, type State, formatNumber, group, initialState, preview, reduce } from './engine'

/** Feeds a keystroke string like "12+3×4=" through the reducer. */
function press(keys: string, from: State = initialState): State {
  const map: Record<string, Action> = {
    '.': { type: 'dot' },
    '+': { type: 'op', op: '+' },
    '-': { type: 'op', op: '-' },
    '×': { type: 'op', op: '×' },
    '÷': { type: 'op', op: '÷' },
    '=': { type: 'equals' },
    '<': { type: 'backspace' },
    '±': { type: 'negate' },
    '%': { type: 'percent' },
    C: { type: 'clear' },
  }
  return [...keys].reduce((s, k) => reduce(s, /\d/.test(k) ? { type: 'digit', d: k } : map[k]), from)
}

describe('arithmetic', () => {
  it.each([
    ['1+2=', '3'],
    ['2+3×4=', '14'],
    ['10-4÷2=', '8'],
    ['8÷2×4=', '16'],
    ['0.1+0.2=', '0.3'],
    ['1÷3=', '0.333333333333'],
    ['7-9=', '-2'],
    ['99999999×99999999=', '9.9999998e15'],
    ['1÷8=', '0.125'],
  ])('%s → %s', (keys, expected) => {
    expect(press(keys).result).toBe(expected)
  })

  it('reports division by zero as an error', () => {
    const s = press('5÷0=')
    expect(s.error).toBe(true)
    expect(s.result).toBe("Can't divide by zero")
  })

  it('repeats the last operation on repeated equals', () => {
    expect(press('5+2===').result).toBe('11')
  })

  it('ignores a trailing operator on equals', () => {
    expect(press('5+=').result).toBe('5')
  })
})

describe('entry', () => {
  it('replaces a leading zero', () => {
    expect(press('007').tokens).toEqual([{ t: 'num', v: '7' }])
  })

  it('allows only one decimal point', () => {
    expect(press('1..5.').tokens).toEqual([{ t: 'num', v: '1.5' }])
  })

  it('starts a decimal with 0.', () => {
    expect(press('.5').tokens).toEqual([{ t: 'num', v: '0.5' }])
  })

  it('swaps operators instead of stacking them', () => {
    expect(press('5+×').tokens).toEqual([
      { t: 'num', v: '5' },
      { t: 'op', v: '×' },
    ])
  })

  it('caps the number of digits', () => {
    expect(press('1234567890123456789').tokens[0]).toEqual({ t: 'num', v: '123456789012345' })
  })

  it('backspaces digits then operators', () => {
    expect(press('12+3<<<').tokens).toEqual([{ t: 'num', v: '1' }])
  })

  it('negates the current number', () => {
    expect(press('5±').tokens).toEqual([{ t: 'num', v: '-5' }])
    expect(press('5±±').tokens).toEqual([{ t: 'num', v: '5' }])
    expect(press('3+±4=').result).toBe('-1')
  })

  it('applies percent', () => {
    expect(press('50%').tokens).toEqual([{ t: 'num', v: '0.5' }])
  })

  it('clears everything', () => {
    expect(press('12+3C')).toEqual(initialState)
  })
})

describe('after a result', () => {
  it('continues from the result with an operator', () => {
    expect(press('2+3=×2=').result).toBe('10')
  })

  it('starts fresh with a digit', () => {
    expect(press('2+3=7').tokens).toEqual([{ t: 'num', v: '7' }])
  })

  it('does not continue from an error', () => {
    expect(press('1÷0=+2=').result).toBe('2')
  })
})

describe('display helpers', () => {
  it('previews the running total', () => {
    expect(preview(press('2+3×'))).toBe('5')
    expect(preview(press('12'))).toBeNull()
  })

  it('groups thousands', () => {
    expect(group('1234567.891')).toBe('1,234,567.891')
    expect(group('-1000')).toBe('−1,000')
    expect(group('12.')).toBe('12.')
  })

  it('formats tiny and huge numbers in exponent form', () => {
    expect(formatNumber(1e-9)).toBe('1e-9')
    expect(formatNumber(-0)).toBe('0')
  })
})
