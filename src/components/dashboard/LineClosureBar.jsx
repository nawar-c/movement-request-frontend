import { ChartEmptyState, ChartError } from './ChartStates.jsx'

// Deliberately a plain stacked bar, not a donut — Oracle Status and Line Closure are different
// concepts and must not look like two equivalent circular status systems (see StatusBadge.jsx).
// NOT_CLOSED and NOT_AVAILABLE both map to LineClosureBadge's "muted" treatment, but a bar showing
// both at once needs two distinguishable tones within that same muted family.
const SEGMENTS = [
  { key: 'ALL_LINES_CLOSED', label: 'All Lines Closed', color: 'var(--color-success-text)' },
  { key: 'PARTIALLY_CLOSED', label: 'Partially Closed', color: 'var(--color-warning-text)' },
  { key: 'NOT_CLOSED', label: 'Not Closed', color: 'var(--color-neutral-text)' },
  { key: 'NOT_AVAILABLE', label: 'Not Available', color: 'var(--color-border-strong)' },
]

export function LineClosureBar({ data, loading, hasLoadedOnce, error, onRetry, selected, onSegmentClick }) {
  const showSkeleton = loading && !hasLoadedOnce
  const total = data ? Object.values(data).reduce((sum, v) => sum + v, 0) : 0

  return (
    <div className="card chart-card">
      <div className="card__header">
        <h2 className="card__title">Line Closure</h2>
      </div>
      <div className="card__body">
        {showSkeleton ? (
          <div className="skeleton chart-skeleton chart-skeleton--slim" />
        ) : error && !hasLoadedOnce ? (
          <ChartError message={error.message} onRetry={onRetry} />
        ) : !data || total === 0 ? (
          <ChartEmptyState message="No line-closure data for the selected filters." />
        ) : (
          <>
            {error ? (
              <div className="chart-inline-error">{error.message} Showing the last known values.</div>
            ) : null}
            <div className="closure-bar" role="group" aria-label="Line closure breakdown">
              {SEGMENTS.filter((s) => data[s.key] > 0).map((s) => {
                const count = data[s.key]
                const pct = Math.round((count / total) * 100)
                const isSelected = selected === s.key
                return (
                  <button
                    key={s.key}
                    type="button"
                    className={`closure-bar__segment${isSelected ? ' closure-bar__segment--active' : ''}`}
                    style={{
                      width: `${pct}%`,
                      background: s.color,
                      opacity: selected && !isSelected ? 0.4 : 1,
                    }}
                    onClick={() => onSegmentClick(s.key)}
                    title={`${s.label}: ${count} (${pct}%)`}
                    aria-pressed={isSelected}
                  />
                )
              })}
            </div>
            <ul className="chart-legend chart-legend--row">
              {SEGMENTS.map((s) => {
                const count = data[s.key] || 0
                const isSelected = selected === s.key
                return (
                  <li key={s.key}>
                    <button
                      type="button"
                      className={`chart-legend__item chart-legend__item--clickable${
                        isSelected ? ' chart-legend__item--active' : ''
                      }`}
                      onClick={() => onSegmentClick(s.key)}
                      aria-pressed={isSelected}
                    >
                      <i style={{ background: s.color }} />
                      <span className="chart-legend__label">{s.label}</span>
                      <span className="chart-legend__value">{count}</span>
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
