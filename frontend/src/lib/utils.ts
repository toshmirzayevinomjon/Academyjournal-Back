const AVATAR_GRADIENTS = [
  'from-emerald-500 to-teal-600',
  'from-blue-500 to-cyan-600',
  'from-purple-500 to-pink-600',
  'from-rose-500 to-pink-600',
  'from-amber-500 to-orange-600',
  'from-cyan-500 to-blue-600',
  'from-violet-500 to-purple-600',
  'from-teal-500 to-emerald-600',
]

const AVATAR_COLORS = [
  'text-emerald-700 dark:text-emerald-400',
  'text-blue-700 dark:text-blue-400',
  'text-purple-700 dark:text-purple-400',
  'text-rose-700 dark:text-rose-400',
  'text-amber-700 dark:text-amber-400',
  'text-cyan-700 dark:text-cyan-400',
  'text-violet-700 dark:text-violet-400',
  'text-teal-700 dark:text-teal-400',
]

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

export function getAvatarGradient(name: string): string {
  const index = hashString(name) % AVATAR_GRADIENTS.length
  return AVATAR_GRADIENTS[index]
}

export function getAvatarColor(name: string): string {
  const index = hashString(name) % AVATAR_COLORS.length
  return AVATAR_COLORS[index]
}

export function getAvatarStyle(name: string): { gradient: string; color: string } {
  const index = hashString(name) % AVATAR_GRADIENTS.length
  return { gradient: AVATAR_GRADIENTS[index], color: AVATAR_COLORS[index] }
}
