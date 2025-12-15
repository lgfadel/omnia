import { describe, expect, it } from 'vitest'

import { convertMentionsToIds, getMentionState } from '@/lib/mentions'

describe('mentions', () => {
  describe('getMentionState', () => {
    it('returns null when there is no @ before caret', () => {
      expect(getMentionState('hello', 5)).toBeNull()
    })

    it('returns state when @ is preceded by whitespace', () => {
      expect(getMentionState('oi @gus', 7)).toEqual({ start: 3, end: 7, query: 'gus' })
    })

    it('returns null when @ is in the middle of a word', () => {
      expect(getMentionState('email@gus', 9)).toBeNull()
    })

    it('returns null when mention already looks like @[id]', () => {
      expect(getMentionState('teste @[', 8)).toBeNull()
    })

    it('returns null when the mention contains whitespace', () => {
      expect(getMentionState('oi @gus ta', 9)).toBeNull()
    })
  })

  describe('convertMentionsToIds', () => {
    it('replaces @Name tokens with @[userId] when mapped', () => {
      const map = new Map<string, string>([['Gustavo', '11111111-1111-1111-1111-111111111111']])
      expect(convertMentionsToIds('oi @Gustavo', map)).toBe('oi @[11111111-1111-1111-1111-111111111111]')
    })

    it('does not replace partial words', () => {
      const map = new Map<string, string>([['Ana', '22222222-2222-2222-2222-222222222222']])
      expect(convertMentionsToIds('bananas @Ana', map)).toBe('bananas @[22222222-2222-2222-2222-222222222222]')
      expect(convertMentionsToIds('bananas@Ana', map)).toBe('bananas@Ana')
    })

    it('supports names with regex characters', () => {
      const map = new Map<string, string>([['A+B', '33333333-3333-3333-3333-333333333333']])
      expect(convertMentionsToIds('oi @A+B', map)).toBe('oi @[33333333-3333-3333-3333-333333333333]')
    })
  })
})
