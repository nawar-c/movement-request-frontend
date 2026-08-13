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

export function MovementRequestViewPage() {
  const { id } = useParams()
  const location = useLocation()
  const { data: mr, loading, error, refresh } = useMovementRequest(id)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

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
      <InlineError message={submitError?.message} details={submitError?.details} />

      <div className="card">
        <div className="card__header">
          <h2 className="card__title">Header</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            {requestKind === 'Mixed' ? <span className="status-badge status-badge--muted">Mixed Request</span> : null}
            <LocalStatusBadge status={mr.localStatus} />
            <OracleStatusBadge status={mr.oracleStatus} />
          </div>
        </div>
        <div className="card__body">
          <div className="detail-grid">
            <DetailField label="Inventory Organization" value={mr.inventoryOrganization} />
            <DetailField label="Movement Request Type" value={mr.movementRequestType} />
            <DetailField label="Required Date" value={formatDate(mr.requiredDate)} />
            <DetailField label="Cost Center" value={mr.costCenter} />
            <DetailField label="Oracle Request Number" value={mr.oracleRequestNumber} />
            <DetailField label="Oracle Header ID" value={mr.oracleHeaderId} />
            <DetailField label="Created" value={formatDateTime(mr.createdAt)} />
            <DetailField label="Last Updated" value={formatDateTime(mr.updatedAt)} />
            <DetailField label="Description" value={mr.description} span={3} />
          </div>
        </div>
      </div>

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
