import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/layout/PageHeader.jsx'
import { LocalStatusBadge, OracleStatusBadge } from '../components/common/StatusBadge.jsx'
import { LoadingState, EmptyState, ErrorState } from '../components/common/States.jsx'
import { movementRequestsApi } from '../api/movementRequestsApi.js'
import { formatDate, formatDateTime } from '../utils/formatters.js'

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SUBMITTED', label: 'Submitted' },
]

export function MovementRequestListPage() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  function load() {
    setLoading(true)
    setError(null)
    movementRequestsApi
      .list({ pageSize: 100 })
      .then((data) => setRequests(data.items))
      .catch((err) => setError(err))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return requests.filter((mr) => {
      if (statusFilter && mr.localStatus !== statusFilter) return false
      if (!term) return true
      return [mr.internalDraftNumber, mr.oracleRequestNumber, mr.description, mr.inventoryOrganization]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(term))
    })
  }, [requests, searchTerm, statusFilter])

  return (
    <div>
      <PageHeader
        title="Movement Requests"
        subtitle="Inventory movement requests created outside Oracle Fusion, pending submission."
        actions={
          <Link to="/movement-requests/new" className="btn btn-primary">
            + New Movement Request
          </Link>
        }
      />

      <div className="card">
        <div className="card__body">
          <div className="toolbar">
            <input
              type="text"
              className="form-input"
              placeholder="Search draft #, Oracle #, description, org..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <select
              className="form-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <span className="text-faint" style={{ fontSize: 12 }}>
              {filtered.length} of {requests.length}
            </span>
          </div>

          {loading ? (
            <LoadingState label="Loading movement requests..." />
          ) : error ? (
            <ErrorState message={error.message} onRetry={load} />
          ) : filtered.length === 0 ? (
            <EmptyState
              title={requests.length === 0 ? 'No movement requests yet' : 'No results match your filters'}
              message={requests.length === 0 ? 'Create your first movement request to get started.' : null}
            />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Draft #</th>
                    <th>Oracle #</th>
                    <th>Organization</th>
                    <th>Required Date</th>
                    <th>Description</th>
                    <th>Local Status</th>
                    <th>Oracle Status</th>
                    <th>Created</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((mr) => (
                    <tr key={mr.id}>
                      <td>{mr.internalDraftNumber}</td>
                      <td>{mr.oracleRequestNumber || <span className="text-faint">—</span>}</td>
                      <td>{mr.inventoryOrganization}</td>
                      <td>{formatDate(mr.requiredDate) || '—'}</td>
                      <td>{mr.description || <span className="text-faint">—</span>}</td>
                      <td><LocalStatusBadge status={mr.localStatus} /></td>
                      <td><OracleStatusBadge status={mr.oracleStatus} /></td>
                      <td className="text-muted">{formatDateTime(mr.createdAt)}</td>
                      <td>
                        <div className="row-actions">
                          <Link className="btn btn-sm" to={`/movement-requests/${mr.id}`}>
                            View
                          </Link>
                          {mr.localStatus === 'DRAFT' ? (
                            <Link className="btn btn-sm" to={`/movement-requests/${mr.id}/edit`}>
                              Edit
                            </Link>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
