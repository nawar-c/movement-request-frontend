export function formatDate(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export function formatDateTime(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function toDateInputValue(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

// LOCAL calendar date (getFullYear/getMonth/getDate), never UTC — toISOString() converts through
// the UTC offset first, which can shift the reported date backward or forward by a day depending
// on the browser's timezone and time of day. Extracted from dateRangePresets.js's equivalent
// private helper so both call sites share one implementation instead of duplicating it.
export function toLocalDateInputValue(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatCount(value) {
  return typeof value === 'number' ? String(value) : null
}

export function truncate(text, maxLength) {
  if (!text) return text
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text
}
