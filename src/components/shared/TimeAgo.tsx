const UNITS: [string, number][] = [
  ['年', 31536000],
  ['个月', 2592000],
  ['天', 86400],
  ['小时', 3600],
  ['分钟', 60],
]

export function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)

  if (seconds < 60) return '刚刚'

  for (const [label, value] of UNITS) {
    const count = Math.floor(seconds / value)
    if (count >= 1) return `${count}${label}前`
  }

  return '刚刚'
}
