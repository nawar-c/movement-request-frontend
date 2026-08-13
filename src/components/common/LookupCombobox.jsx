import { useEffect, useRef, useState } from 'react'

const DEBOUNCE_MS = 300

// onSearch(term, { offset }) must resolve to { items, hasMore }. For lookups small enough that a
// single request always returns every match (e.g. Cost Center), hasMore can simply be false.
export function LookupCombobox({
  displayLabel,
  onSelect,
  onSearch,
  renderOption,
  getOptionKey,
  minChars = 3,
  placeholder = 'Search...',
  disabled,
  hasError,
}) {
  const [term, setTerm] = useState(displayLabel || '')
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const containerRef = useRef(null)
  const requestId = useRef(0)

  useEffect(() => {
    setTerm(displayLabel || '')
  }, [displayLabel])

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!open) return undefined

    const trimmed = term.trim()
    if (trimmed.length < minChars) {
      setResults([])
      setHasMore(false)
      setLoading(false)
      return undefined
    }

    const currentRequest = ++requestId.current
    setLoading(true)

    const timeout = setTimeout(() => {
      onSearch(trimmed, { offset: 0 })
        .then(({ items, hasMore: more }) => {
          if (currentRequest !== requestId.current) return
          setResults(items)
          setHasMore(Boolean(more))
          setLoading(false)
        })
        .catch(() => {
          if (currentRequest !== requestId.current) return
          setResults([])
          setHasMore(false)
          setLoading(false)
        })
    }, DEBOUNCE_MS)

    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, open, minChars])

  function handleSelect(item) {
    onSelect(item)
    setOpen(false)
  }

  function handleLoadMore() {
    const currentRequest = requestId.current
    setLoadingMore(true)
    onSearch(term.trim(), { offset: results.length })
      .then(({ items, hasMore: more }) => {
        if (currentRequest !== requestId.current) return
        setResults((prev) => [...prev, ...items])
        setHasMore(Boolean(more))
        setLoadingMore(false)
      })
      .catch(() => {
        if (currentRequest !== requestId.current) return
        setLoadingMore(false)
      })
  }

  const showMenu = open && term.trim().length > 0

  return (
    <div className="combobox" ref={containerRef}>
      <input
        type="text"
        className={`form-input${hasError ? ' has-error' : ''}`}
        placeholder={placeholder}
        value={term}
        disabled={disabled}
        onChange={(e) => {
          setTerm(e.target.value)
          setOpen(true)
          if (!e.target.value) onSelect(null)
        }}
        onFocus={() => setOpen(true)}
      />
      {showMenu ? (
        <div className="combobox__menu">
          {term.trim().length < minChars ? (
            <div className="combobox__status">Type at least {minChars} characters to search.</div>
          ) : loading ? (
            <div className="combobox__status">Searching...</div>
          ) : results.length === 0 ? (
            <div className="combobox__status">No results found.</div>
          ) : (
            <>
              {results.map((item) => (
                <div
                  key={getOptionKey(item)}
                  className="combobox__option"
                  onMouseDown={() => handleSelect(item)}
                >
                  {renderOption(item)}
                </div>
              ))}
              {hasMore ? (
                <div
                  className="combobox__status"
                  style={{ cursor: loadingMore ? 'default' : 'pointer', color: 'var(--color-primary)' }}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    if (!loadingMore) handleLoadMore()
                  }}
                >
                  {loadingMore ? 'Loading more...' : 'Load more results...'}
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}
