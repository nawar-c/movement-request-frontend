import { useEffect, useRef, useState } from 'react'
import { useDebouncedItemSearch } from '../../hooks/useDebouncedItemSearch.js'

export function ItemSearchCombobox({ organizationCode, displayLabel, onSelect, disabled, hasError }) {
  const [term, setTerm] = useState(displayLabel || '')
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)
  const { results, loading, minChars } = useDebouncedItemSearch(organizationCode, open ? term : '')

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

  function handleSelect(item) {
    onSelect(item)
    setTerm(`${item.itemNumber} - ${item.description}`)
    setOpen(false)
  }

  const showMenu = open && term.trim().length > 0

  return (
    <div className="combobox" ref={containerRef}>
      <input
        type="text"
        className={`form-input${hasError ? ' has-error' : ''}`}
        placeholder="Search item by number or description..."
        value={term}
        disabled={disabled || !organizationCode}
        onChange={(e) => {
          setTerm(e.target.value)
          setOpen(true)
          if (!e.target.value) onSelect(null)
        }}
        onFocus={() => setOpen(true)}
      />
      {!organizationCode ? (
        <div className="form-hint">Select an organization first.</div>
      ) : null}
      {showMenu ? (
        <div className="combobox__menu">
          {term.trim().length < minChars ? (
            <div className="combobox__status">Type at least {minChars} characters to search.</div>
          ) : loading ? (
            <div className="combobox__status">Searching...</div>
          ) : results.length === 0 ? (
            <div className="combobox__status">No items found.</div>
          ) : (
            results.map((item) => (
              <div
                key={item.itemNumber}
                className="combobox__option"
                onMouseDown={() => handleSelect(item)}
              >
                <span className="combobox__option-primary">{item.itemNumber}</span>
                <span className="combobox__option-secondary">
                  {item.description} · {item.primaryUom}
                </span>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}
