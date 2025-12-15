export type MentionState = { start: number; end: number; query: string }

export const getMentionState = (text: string, caret: number | null | undefined): MentionState | null => {
  const pos = typeof caret === 'number' ? caret : text.length
  const before = text.slice(0, pos)
  const at = before.lastIndexOf('@')

  if (at === -1) return null

  const prev = at > 0 ? before[at - 1] : ' '
  if (!/\s/.test(prev)) return null

  const afterAt = before.slice(at + 1)
  if (!afterAt) return { start: at, end: pos, query: '' }
  if (afterAt.startsWith('[')) return null
  if (/\s/.test(afterAt)) return null

  return { start: at, end: pos, query: afterAt }
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const convertMentionsToIds = (text: string, mentionMap: Map<string, string>): string => {
  let result = text
  mentionMap.forEach((userId, userName) => {
    const regex = new RegExp(`(^|\\s)@${escapeRegExp(userName)}(?=\\s|$)`, 'g')
    result = result.replace(regex, `$1@[${userId}]`)
  })
  return result
}
