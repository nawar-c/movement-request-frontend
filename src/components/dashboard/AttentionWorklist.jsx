import { useNavigate } from 'react-router-dom'
import { OracleStatusBadge, LineClosureBadge } from '../common/StatusBadge.jsx'
import { ChartEmptyState, ChartError } from './ChartStates.jsx'
import { PaginationBar } from './PaginationBar.jsx'
import { formatSubinventoryDisplay } from '../../utils/formatters.js'

// Known reason values confirmed against the live /api/reports/attention contract (or named in the
// approved Phase 3 design). This is a presentation lookup only — formatReason() below always falls
// back to a generic readable label for anything not in this map, so a future/unknown reason still
// renders safely instead of disappearing or crashing.
const REASON_LABELS = {
  PENDING_APPROVAL: 'Pending Approval',
  APPROVED_NOT_FULLY_CLOSED: 'Approved — Not Fully Closed',
  APPROVED_LINE_STATUS_UNAVAILABLE: 'Approved — Line Status Unavailable',
  PARTIALLY_CLOSED: 'Partially Closed',
  REJECTED: 'Rejected',
}

function formatReason(reason) {
  return (
    REASON_LABELS[reason] ||
    reason
      .split('_')
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ')
  )
}

export function AttentionWorklist({ data, loading, hasLoadedOnce, error, onRetry, onPageChange }) {
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
        <h2 className="card__title">Attention Required</h2>
      </div>
      <div className="card__body">
        {showSkeleton ? (
          <div className="skeleton chart-skeleton--table" />
        ) : error && !hasLoadedOnce ? (
          <ChartError message={error.message} onRetry={onRetry} />
        ) : items.length === 0 ? (
          <ChartEmptyState message="Nothing needs attention for the selected filters." />
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
                    <th>Reason</th>
                    <th>Oracle Status</th>
                    <th>Line Closure</th>
                    <th>Request Age</th>
                    <th>Organization</th>
                    <th>Source</th>
                    <th>Destination</th>
                    <th>Requested By</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.movementRequestId}
                      tabIndex={0}
                      role="link"
                      onClick={() => goToRequest(item.movementRequestId)}
                      onKeyDown={(e) => handleRowKeyDown(e, item.movementRequestId)}
                    >
                      <td>
                        <div>{item.draftNumber}</div>
                        {item.oracleRequestNumber ? (
                          <div className="text-faint" style={{ fontSize: 11 }}>
                            {item.oracleRequestNumber}
                          </div>
                        ) : null}
                      </td>
                      <td>
                        <div className="reason-badges">
                          {item.attentionReasons.map((reason) => (
                            <span key={reason} className="status-badge status-badge--pending">
                              {formatReason(reason)}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <OracleStatusBadge status={item.oracleStatus} />
                      </td>
                      <td>
                        <LineClosureBadge status={item.lineClosure} />
                      </td>
                      <td className="num-cell">{item.requestAgeDays}d</td>
                      <td>{item.organizationCode}</td>
                      <td>{formatSubinventoryDisplay(item.sourceSubinventory, item.sourceSubinventoryMultiple)}</td>
                      <td>{formatSubinventoryDisplay(item.destinationSubinventory, item.destinationSubinventoryMultiple)}</td>
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
