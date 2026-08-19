// Shared empty/error presentation for the Phase 2 charts — each chart calls its own reporting
// endpoint independently, so a failure here never blanks the rest of the dashboard.

export function ChartEmptyState({ message }) {
  return <div className="chart-empty">{message}</div>
}

export function ChartError({ message, onRetry }) {
  return (
    <div className="chart-empty chart-empty--error">
      <div>{message}</div>
      {onRetry ? (
        <button type="button" className="btn btn-sm" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  )
}
