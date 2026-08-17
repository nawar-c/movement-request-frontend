import { useMemo, useState } from 'react'
import { useParams, useLocation, Link } from 'react-router-dom'
import { PageHeader } from '../components/layout/PageHeader.jsx'
import { DetailField } from '../components/common/DetailField.jsx'
import { LocalStatusBadge, OracleStatusBadge } from '../components/common/StatusBadge.jsx'
import { LoadingState, ErrorState, InlineError, InlineNotice } from '../components/common/States.jsx'
import { MovementRequestLinesTable } from '../components/movement-request/MovementRequestLinesTable.jsx'
import { ConfirmDialog } from '../components/common/Modal.jsx'
import { useMovementRequest } from '../hooks/useMovementRequest.js'
import { movementRequestsApi } from '../api/movementRequestsApi.js'
import { formatDate, formatDateTime } from '../utils/formatters.js'

function friendlySubmitError(err) {
  if (err.code === 'NO_APPROVAL_SUBMISSION_NOT_CONFIGURED') {
    return 'This destination is configured as not requiring approval, but direct Oracle submission for this configuration is not enabled yet.'
  }
  if (err.code === 'EMPLOYEE_NAME_NOT_SYNCED') {
    return 'Your employee information has not been synchronized from Oracle. Please contact the administrator.'
  }
  if (err.code === 'INVALID_EMPLOYEE_ID_FOR_ORACLE') {
    return 'Your Employee ID is not valid for Oracle submission. Please contact the administrator.'
  }
  return err.message
}

// Business requester identity is the Movement Request creator's Employee ID + Employee Name —
// never oracleRequesterId or the Oracle line RequesterId/RequesterName (technical DFF concepts).
function requestedByDisplay(mr) {
  if (!mr.createdByUsername && !mr.createdByEmployeeName) return 'Not available'
  if (mr.createdByUsername && mr.createdByEmployeeName) return `${mr.createdByUsername} — ${mr.createdByEmployeeName}`
  return mr.createdByUsername || mr.createdByEmployeeName
}

function friendlyRefreshStatusError(err) {
  if (err.code === 'NO_ORACLE_HEADER') {
    return 'This request has not been submitted to Oracle Fusion yet, so there is no status to refresh.'
  }
  if (err.code === 'ORACLE_ERROR' || err.status === 502) {
    return 'Unable to refresh Oracle status. The last known status has been preserved.'
  }
  return err.message
}

export function MovementRequestViewPage() {
  const { id } = useParams()
  const location = useLocation()
  const { data: mr, loading, error, refresh } = useMovementRequest(id)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [refreshingStatus, setRefreshingStatus] = useState(false)
  const [refreshStatusError, setRefreshStatusError] = useState(null)

  const requestKind = useMemo(() => {
    if (!mr) return null
    const types = new Set(mr.lines.map((l) => l.transactionType).filter(Boolean))
    if (types.size > 1) return 'Mixed'
    if (types.has('Movement Request Issue')) return 'Issue'
    if (types.has('Movement Request Transfer')) return 'Transfer'
    return null
  }, [mr])

  if (loading) return <LoadingState label="Loading movement request..." />
  if (error) return <ErrorState message={error.message} />
  if (!mr) return null

  const isDraft = mr.localStatus === 'DRAFT'

  async function handleConfirmSubmit() {
    setSubmitting(true)
    setSubmitError(null)
    try {
      // TODO(security/approval-routing): once user roles exist, a Nurse-created request should
      // land in a "Pending Approval" state requiring explicit approval, while a non-Nurse creator's
      // request should be auto-approved. Not implemented yet — every submission currently follows
      // whatever status Oracle Fusion (mock) returns, with no role-based branching in the frontend.
      await movementRequestsApi.submit(id)
      await refresh()
      setConfirmOpen(false)
    } catch (err) {
      setSubmitError(err)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRefreshStatus() {
    setRefreshingStatus(true)
    setRefreshStatusError(null)
    try {
      await movementRequestsApi.refreshOracleStatus(id)
      // Re-fetches the record in place (no full browser reload) so the new status shows immediately.
      await refresh()
    } catch (err) {
      // Deliberately do not touch `mr` here — the backend preserves the last known Oracle status on
      // a failed refresh, and the frontend must not erase what's currently displayed either.
      setRefreshStatusError(err)
    } finally {
      setRefreshingStatus(false)
    }
  }

  return (
    <div>
      <PageHeader
        title={mr.internalDraftNumber}
        subtitle={mr.description || 'No description provided.'}
        actions={
          <>
            <Link to="/movement-requests" className="btn">
              Back to List
            </Link>
            {isDraft ? (
              <Link to={`/movement-requests/${id}/edit`} className="btn">
                Edit
              </Link>
            ) : null}
            {isDraft ? (
              <button type="button" className="btn btn-primary" onClick={() => setConfirmOpen(true)}>
                Submit to Oracle Fusion
              </button>
            ) : null}
          </>
        }
      />

      {location.state?.notice ? <InlineNotice>{location.state.notice}</InlineNotice> : null}
      <InlineError message={submitError ? friendlySubmitError(submitError) : null} details={submitError?.details} />

      <div className="card">
        <div className="card__header">
          <h2 className="card__title">Header</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            {requestKind === 'Mixed' ? <span className="status-badge status-badge--muted">Mixed Request</span> : null}
            <LocalStatusBadge status={mr.localStatus} />
          </div>
        </div>
        <div className="card__body">
          <div className="detail-grid">
            <DetailField label="Inventory Organization" value={mr.inventoryOrganization} />
            <DetailField label="Movement Request Type" value={mr.movementRequestType} />
            <DetailField label="Required Date" value={formatDate(mr.requiredDate)} />
            <DetailField label="Cost Center" value={mr.costCenter} />
            <DetailField label="Requested By" value={requestedByDisplay(mr)} />
            <DetailField label="Created" value={formatDateTime(mr.createdAt)} />
            <DetailField label="Last Updated" value={formatDateTime(mr.updatedAt)} />
            <DetailField label="Description" value={mr.description} span={3} />
          </div>
        </div>
      </div>

      {mr.oracleHeaderId ? (
        <div className="card">
          <div className="card__header">
            <h2 className="card__title">Oracle Fusion</h2>
            <OracleStatusBadge status={mr.oracleStatus} />
          </div>
          <div className="card__body">
            <InlineError message={refreshStatusError ? friendlyRefreshStatusError(refreshStatusError) : null} />
            <div className="detail-grid">
              <DetailField label="Oracle Request Number" value={mr.oracleRequestNumber} />
              <DetailField label="Oracle Header ID" value={mr.oracleHeaderId} />
              <DetailField label="Oracle Status Code" value={mr.oracleStatusCode != null ? String(mr.oracleStatusCode) : null} />
            </div>
            <div style={{ marginTop: 14 }}>
              <button type="button" className="btn btn-sm" onClick={handleRefreshStatus} disabled={refreshingStatus}>
                {refreshingStatus ? 'Refreshing...' : 'Refresh Oracle Status'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <MovementRequestLinesTable lines={mr.lines} disabled />

      {confirmOpen ? (
        <ConfirmDialog
          title="Submit to Oracle Fusion?"
          message="This will submit the request to Oracle Fusion. Depending on approval routing, it may move directly to an approved state or require approval. You will not be able to edit it after this step."
          confirmLabel="Submit"
          busy={submitting}
          onConfirm={handleConfirmSubmit}
          onCancel={() => setConfirmOpen(false)}
        />
      ) : null}
    </div>
  )
}
