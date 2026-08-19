import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { ChartEmptyState, ChartError } from './ChartStates.jsx'

// Reuses the semantic intent of OracleStatusBadge (StatusBadge.jsx) without coupling chart
// rendering to a fixed allowlist — any status not in this map still renders, just with a
// deterministic fallback color instead of failing or being dropped.
const KNOWN_ORACLE_COLORS = {
  'Pending approval': 'var(--color-warning-text)',
  Approved: 'var(--color-success-text)',
  Rejected: 'var(--color-danger)',
  Closed: 'var(--color-neutral-text)',
  Canceled: 'var(--color-danger)',
  Preapproved: 'var(--color-success-text)',
  'Partially approved': 'var(--color-warning-text)',
  'Canceled by source': 'var(--color-danger)',
}

const FALLBACK_PALETTE = ['var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

// Deterministic (not random) color for any future Oracle status this map doesn't yet know about —
// the same unknown label always gets the same color across renders and sessions.
function hashColor(label) {
  let hash = 0
  for (let i = 0; i < label.length; i++) hash = (hash * 31 + label.charCodeAt(i)) | 0
  return FALLBACK_PALETTE[Math.abs(hash) % FALLBACK_PALETTE.length]
}

function colorForStatus(status) {
  if (!status) return 'var(--color-border-strong)'
  return KNOWN_ORACLE_COLORS[status] || hashColor(status)
}

function DonutTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null
  const item = payload[0].payload
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip__title">{item.label}</div>
      <div className="chart-tooltip__row">
        <span>Count</span>
        <strong>{item.count}</strong>
      </div>
      <div className="chart-tooltip__row">
        <span>Share</span>
        <strong>{item.percent}%</strong>
      </div>
    </div>
  )
}

// Clicking a segment sets the existing oracleStatusCode filter (a number — the backend does not
// accept Oracle status text). The "Not Submitted" segment (statusCode null) has no honest
// single-filter equivalent, so it is displayed but not clickable.
export function OracleStatusDonut({ data, loading, hasLoadedOnce, error, onRetry, selectedCode, onSegmentClick }) {
  const showSkeleton = loading && !hasLoadedOnce
  const rows = data || []
  const total = rows.reduce((sum, r) => sum + r.count, 0)

  const items = rows.map((r) => ({
    key: r.statusCode ?? 'not-submitted',
    label: r.status || 'Not Submitted',
    statusCode: r.statusCode,
    count: r.count,
    percent: total > 0 ? Math.round((r.count / total) * 100) : 0,
    color: colorForStatus(r.status),
  }))

  function handleSliceClick(item) {
    if (item.statusCode == null) return
    onSegmentClick(item.statusCode)
  }

  return (
    <div className="card chart-card">
      <div className="card__header">
        <h2 className="card__title">Oracle Status Distribution</h2>
      </div>
      <div className="card__body">
        {showSkeleton ? (
          <div className="skeleton chart-skeleton" />
        ) : error && !hasLoadedOnce ? (
          <ChartError message={error.message} onRetry={onRetry} />
        ) : items.length === 0 || total === 0 ? (
          <ChartEmptyState message="No Oracle status data for the selected filters." />
        ) : (
          <>
            {error ? (
              <div className="chart-inline-error">{error.message} Showing the last known values.</div>
            ) : null}
            <div className="donut-layout">
              <ResponsiveContainer width={150} height={150}>
                <PieChart>
                  <Pie
                    data={items}
                    dataKey="count"
                    nameKey="label"
                    innerRadius={44}
                    outerRadius={70}
                    paddingAngle={2}
                    isAnimationActive={false}
                    onClick={handleSliceClick}
                  >
                    {items.map((item) => (
                      <Cell
                        key={item.key}
                        fill={item.color}
                        stroke="var(--color-surface)"
                        strokeWidth={2}
                        opacity={selectedCode && String(item.statusCode) !== String(selectedCode) ? 0.35 : 1}
                        style={{ cursor: item.statusCode != null ? 'pointer' : 'default' }}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<DonutTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <ul className="chart-legend">
                {items.map((item) => (
                  <li key={item.key}>
                    <button
                      type="button"
                      className={`chart-legend__item${item.statusCode != null ? ' chart-legend__item--clickable' : ''}${
                        selectedCode && String(item.statusCode) === String(selectedCode) ? ' chart-legend__item--active' : ''
                      }`}
                      onClick={() => handleSliceClick(item)}
                      disabled={item.statusCode == null}
                    >
                      <i style={{ background: item.color }} />
                      <span className="chart-legend__label">{item.label}</span>
                      <span className="chart-legend__value">{item.count}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
