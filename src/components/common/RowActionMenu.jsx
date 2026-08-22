import { useEffect, useRef, useState } from 'react'

// Compact "⋯" overflow menu for secondary table-row actions (Phase G1C). No generic menu/dropdown
// component existed anywhere in the app before this — the closest precedent is
// DataFreshness.jsx's freshness popover (open state + ref + outside-click-close useEffect,
// absolute-positioned floating panel using the same border/radius/shadow tokens as
// .freshness-popover/.combobox__menu). This component reuses that exact interaction pattern and
// visual language rather than introducing a new one or a UI framework.
//
// Each row renders its own independent RowActionMenu instance with its own local `open` state - no
// shared "which menu is open" state is lifted to a parent. This still yields "only one menu open at
// a time" behavior for free: opening menu B's toggle button is a click OUTSIDE menu A's own ref, so
// menu A's outside-click handler closes it on the same click that opens B (mousedown fires before
// click), with no coordination needed between rows.
//
// `items`: [{ label, onSelect, disabled }]. This component owns only open/close/positioning - all
// business logic (what an action actually does) stays with the caller, unchanged.
export function RowActionMenu({ label, items }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    function handleClickOutside(event) {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  function handleSelect(item) {
    if (item.disabled) return
    setOpen(false)
    item.onSelect()
  }

  return (
    <div className="action-menu" ref={ref}>
      <button
        type="button"
        className="btn btn-sm action-menu__toggle"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={label}
      >
        &#8942;
      </button>
      {open ? (
        <div className="action-menu__panel" role="menu">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className="action-menu__item"
              onClick={() => handleSelect(item)}
              disabled={item.disabled}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
