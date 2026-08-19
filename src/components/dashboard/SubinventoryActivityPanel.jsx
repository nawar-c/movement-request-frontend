import { ChartEmptyState, ChartError } from './ChartStates.jsx'

// Shared visual for Destination Activity and Source Activity (Phase 3) — both endpoints return
// the identical { organizationCode, subinventoryCode, requestCount, lineCount } shape, so one
// component renders both rather than duplicating near-identical markup.
export function SubinventoryActivityPanel({
  title,
  data,
  loading,
  hasLoadedOnce,
  error,
  onRetry,
  selectedValue,
  onItemClick,
}) {
  const showSkeleton = loading && !hasLoadedOnce
  const rows = data || []
  const maxCount = rows.reduce((max, r) => Math.max(max, r.requestCount), 0) || 1

  return (
    <div className="card chart-card">
      <div className="card__header">
        <h2 className="card__title">{title}</h2>
      </div>
      <div className="card__body">
        {showSkeleton ? (
          <div className="skeleton chart-skeleton--activity" />
        ) : error && !hasLoadedOnce ? (
          <ChartError message={error.message} onRetry={onRetry} />
        ) : rows.length === 0 ? (
          <ChartEmptyState message="No activity for the selected filters." />
        ) : (
          <>
            {error ? (
              <div className="chart-inline-error">{error.message} Showing the last known values.</div>
            ) : null}
            <ul className="activity-list">
              {rows.map((row) => {
                const isActive = selectedValue === row.subinventoryCode
                const widthPct = Math.round((row.requestCount / maxCount) * 100)
                return (
                  <li key={`${row.organizationCode}:${row.subinventoryCode}`}>
                    <button
                      type="button"
                      className={`activity-row${isActive ? ' activity-row--active' : ''}`}
                      onClick={() => onItemClick(row.subinventoryCode)}
                      aria-pressed={isActive}
                    >
                      <span className="activity-row__label">{row.subinventoryCode}</span>
                      <span className="activity-row__bar-track">
                        <span className="activity-row__bar-fill" style={{ width: `${widthPct}%` }} />
                      </span>
                      <span className="activity-row__count">
                        {row.requestCount}
                        {row.lineCount !== row.requestCount ? (
                          <span className="activity-row__linecount"> · {row.lineCount} lines</span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}
