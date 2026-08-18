import { useEffect, useRef, useState } from 'react'
import { InfoIcon } from '../common/icons.jsx'
import { SyncStatusBadge } from '../common/StatusBadge.jsx'
import { formatDateTime } from '../../utils/formatters.js'

const DOMAIN_LABELS = {
  ORGANIZATION: 'Organizations',
  SUBINVENTORY: 'Subinventories',
  UOM: 'Units of Measure',
  REASON: 'Reasons',
  COST_CENTER: 'Cost Centers',
  ITEM: 'Items',
  DESTINATION_ACCOUNT: 'Destination Accounts',
}

// Freshness is intentionally a small disclosure, not a dashboard card — and it degrades
// independently of the rest of the page: a failed fetch here simply renders nothing rather than
// blocking or erroring the dashboard (dashboard-summary is the only thing that must succeed).
export function DataFreshness({ freshness, loading, error }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  if (loading) {
    return <span className="text-faint" style={{ fontSize: 12 }}>Checking data freshness…</span>
  }

  if (error || !freshness) {
    return null
  }

  const observedAt = formatDateTime(freshness.lastOracleStatusObservedAt)
  const isApproximate = freshness.lastOracleStatusObservedAtIsApproximate

  return (
    <div className="dashboard-freshness" ref={ref}>
      <button
        type="button"
        className="freshness-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="View data freshness details"
      >
        <InfoIcon width={14} height={14} />
        {observedAt ? (
          <span>
            Latest Oracle status observed: {observedAt}
            {isApproximate ? ' (approximate)' : ''}
          </span>
        ) : (
          <span>Oracle status freshness unavailable</span>
        )}
      </button>

      {open ? (
        <div className="freshness-popover" role="dialog" aria-label="Data freshness detail">
          <div className="freshness-popover__title">Oracle Status</div>
          <div className="freshness-popover__row">
            <span className="freshness-popover__domain">Latest observed</span>
            <span className="freshness-popover__time">
              {observedAt || 'Unavailable'}
              {isApproximate ? ' · approx.' : ''}
            </span>
          </div>

          <div className="freshness-popover__title" style={{ marginTop: 14 }}>
            Master Data Sync
          </div>
          {(freshness.masterDataSync?.domains || []).map((d) => (
            <div className="freshness-popover__row" key={d.domain}>
              <span className="freshness-popover__domain">{DOMAIN_LABELS[d.domain] || d.domain}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="freshness-popover__time">{formatDateTime(d.lastCompletedAt) || '—'}</span>
                <SyncStatusBadge status={d.lastStatus} isRunning={d.isRunning} />
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
