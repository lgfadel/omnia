// Utility for generating consistent user colors
export const USER_COLOR_PALETTE = [
  '#ef4444', // red
  '#f97316', // orange  
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#d946ef', // fuchsia
  '#ec4899', // pink
  '#f43f5e', // rose
  '#84cc16', // lime
  '#10b981', // emerald
  '#0ea5e9', // sky
  '#7c3aed', // purple
  '#059669'  // teal
]

/**
 * Generates a consistent color for a user based on their ID or name
 */
export function generateUserColor(userId: string | null | undefined, fallbackName?: string): string {
  if (!userId && !fallbackName) return USER_COLOR_PALETTE[0]
  
  const input = userId || fallbackName || ''
  
  // Simple hash function to generate consistent index
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  
  const index = Math.abs(hash) % USER_COLOR_PALETTE.length
  return USER_COLOR_PALETTE[index]
}

/**
 * Gets the initials from a user's name
 */
export function getUserInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}