import { useNavigate } from 'react-router-dom'
import { LocalStatusBadge, OracleStatusBadge, LineClosureBadge } from '../common/StatusBadge.jsx'
import { ChartEmptyState, ChartError } from './ChartStates.jsx'
import { PaginationBar } from './PaginationBar.jsx'
import { formatDate } from '../../utils/formatters.js'

// Only rendered while the Dashboard has an active analytical filter (see DashboardPage) — this is
// the drill-down surface for "what are the underlying requests behind this selection", not a
// second general-purpose request browser (that's the existing Movement Requests page).
export function MatchingRequestsTable({ data, loading, hasLoadedOnce, error, onRetry, onPageChange }) {
  const navigate = useNavigate()
  const showSkeleton = loading && !hasLoadedOnce
  const items = data?.items || []

  function goToRequest(id) {
    navigate(`/movement-requests/${id}`)
  }

  function handleRowKeyDown(e, id) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      goToRequest(id)
    }
  }

  return (
    <div className="card">
      <div className="card__header">
        <h2 className="card__title">Matching Requests</h2>
      </div>
      <div className="card__body">
        <div className="chart-caption" style={{ marginTop: 0, marginBottom: 12 }}>
          The underlying requests for the current Dashboard filters.
        </div>
        {showSkeleton ? (
          <div className="skeleton chart-skeleton--table" />
        ) : error && !hasLoadedOnce ? (
          <ChartError message={error.message} onRetry={onRetry} />
        ) : items.length === 0 ? (
          <ChartEmptyState message="No requests match the current Dashboard filters." />
        ) : (
          <>
            {error ? (
              <div className="chart-inline-error">{error.message} Showing the last known values.</div>
            ) : null}
            <div className="table-wrap">
              <table className="data-table data-table--clickable-rows">
                <thead>
                  <tr>
                    <th>Movement Request</th>
                    <th>Organization</th>
                    <th>Application Status</th>
                    <th>Oracle Status</th>
                    <th>Line Closure</th>
                    <th>Lines</th>
                    <th>Created</th>
                    <th>Requested By</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      tabIndex={0}
                      role="link"
                      onClick={() => goToRequest(item.id)}
                      onKeyDown={(e) => handleRowKeyDown(e, item.id)}
                    >
                      <td>
                        <div>{item.draftNumber}</div>
                        {item.oracleRequestNumber ? (
                          <div className="text-faint" style={{ fontSize: 11 }}>
                            {item.oracleRequestNumber}
                          </div>
                        ) : null}
                      </td>
                      <td>{item.organizationCode}</td>
                      <td>
                        <LocalStatusBadge status={item.localStatus} />
                      </td>
                      <td>
                        <OracleStatusBadge status={item.oracleStatus} />
                      </td>
                      <td>
                        <LineClosureBadge status={item.lineClosure} />
                      </td>
                      <td className="num-cell">{item.lineCount}</td>
                      <td className="text-muted">{formatDate(item.createdAt) || '—'}</td>
                      <td>{item.createdByEmployeeName || item.createdByUsername || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationBar page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={onPageChange} />
          </>
        )}
      </div>
    </div>
  )
}
