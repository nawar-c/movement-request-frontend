export const DATE_PRESETS = [
  { value: 'last30', label: 'Last 30 Days' },
  { value: 'last90', label: 'Last 90 Days' },
  { value: 'thisQuarter', label: 'This Quarter' },
  { value: 'allTime', label: 'All Time' },
]

export const DEFAULT_DATE_PRESET = 'allTime'

// Formats using the browser's LOCAL calendar date, not toISOString()'s UTC conversion — the latter
// silently shifts the date backward or forward by a day for any timezone ahead of/behind UTC,
// which is exactly wrong for a human-facing "this quarter starts on the 1st" boundary.
function toISODate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Resolves a preset into the dateFrom/dateTo shape the backend accepts (YYYY-MM-DD). "All Time"
// resolves to no bounds at all rather than an arbitrarily old dateFrom.
export function resolveDatePreset(preset) {
  const now = new Date()

  if (preset === 'last30') {
    const from = new Date(now)
    from.setDate(from.getDate() - 30)
    return { dateFrom: toISODate(from), dateTo: toISODate(now) }
  }

  if (preset === 'last90') {
    const from = new Date(now)
    from.setDate(from.getDate() - 90)
    return { dateFrom: toISODate(from), dateTo: toISODate(now) }
  }

  if (preset === 'thisQuarter') {
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3
    const from = new Date(now.getFullYear(), quarterStartMonth, 1)
    return { dateFrom: toISODate(from), dateTo: toISODate(now) }
  }

  return { dateFrom: null, dateTo: null }
}
