import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { ChartEmptyState, ChartError } from './ChartStates.jsx'

function formatDayLabel(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function TrendTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null
  const point = payload[0].payload
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip__title">{formatDayLabel(point.period)}</div>
      <div className="chart-tooltip__row">
        <span>Request count</span>
        <strong>{point.count}</strong>
      </div>
    </div>
  )
}

// Server-provided grain (DAY or WEEK) is respected as-is — no client-side re-aggregation. Click-to-
// filter is only wired for DAY grain: a WEEK bucket's boundary convention (which day a week starts
// on) isn't confirmed by the backend contract, so guessing one risks applying a wrong date range.
// WEEK stays hover-only for Phase 2, documented rather than guessed.
// Caps how many x-axis labels render at once. At or under this many points, every point gets its
// own label (interval={0}, i.e. skip none) — this is what makes 11/16/17 Aug all readable for the
// current small dataset. Above it, Recharts spaces labels out to roughly this many so a large
// date range doesn't crowd the axis. Purely a function of the server-provided point count — never
// a hardcoded date.
const MAX_AXIS_LABELS = 8

export function RequestTrendChart({ data, loading, hasLoadedOnce, error, onRetry, selectedDay, onDayClick }) {
  const showSkeleton = loading && !hasLoadedOnce
  const points = data?.points || []
  const isDayGrain = data?.grain === 'DAY'
  const tickInterval = points.length <= MAX_AXIS_LABELS ? 0 : Math.ceil(points.length / MAX_AXIS_LABELS) - 1

  function handleChartClick(chartState) {
    if (!isDayGrain) return
    const label = chartState?.activeLabel
    if (label) onDayClick(label)
  }

  return (
    <div className="card chart-card">
      <div className="card__header">
        <h2 className="card__title">Request Trend</h2>
      </div>
      <div className="card__body">
        {showSkeleton ? (
          <div className="skeleton chart-skeleton" />
        ) : error && !hasLoadedOnce ? (
          <ChartError message={error.message} onRetry={onRetry} />
        ) : points.length === 0 ? (
          <ChartEmptyState message="No request activity for the selected filters." />
        ) : (
          <>
            {error ? (
              <div className="chart-inline-error">{error.message} Showing the last known values.</div>
            ) : null}
            <ResponsiveContainer width="100%" height={220} className={isDayGrain ? 'chart-clickable' : undefined}>
              <AreaChart data={points} margin={{ top: 8, right: 16, left: 0, bottom: 4 }} onClick={handleChartClick}>
                <defs>
                  <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.26} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--color-border)" />
                <XAxis
                  dataKey="period"
                  tickFormatter={formatDayLabel}
                  tick={{ fontSize: 11, fill: 'var(--color-text-faint)' }}
                  axisLine={{ stroke: 'var(--color-border)' }}
                  tickLine={false}
                  tickMargin={8}
                  interval={tickInterval}
                  padding={{ left: 12, right: 12 }}
                />
                <YAxis
                  allowDecimals={false}
                  width={30}
                  tick={{ fontSize: 11, fill: 'var(--color-text-faint)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<TrendTooltip />} cursor={{ stroke: 'var(--color-border-strong)' }} />
                <Area
                  type="linear"
                  dataKey="count"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  fill="url(#trendFill)"
                  dot={false}
                  activeDot={{
                    r: 4,
                    fill: 'var(--chart-1)',
                    stroke: 'var(--color-surface)',
                    strokeWidth: 2,
                  }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
            <div className="chart-caption">
              {points.length} {points.length === 1 ? (isDayGrain ? 'day' : 'period') : isDayGrain ? 'days' : 'periods'} with
              activity{isDayGrain ? ' · click a point to filter that day' : ''}
              {selectedDay ? ' · filtered to one day' : ''}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
