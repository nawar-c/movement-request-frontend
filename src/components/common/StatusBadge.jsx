// Application Status — our own local workflow state. Distinct from, and never merged with,
// Oracle's workflow status below.
const LOCAL_STATUS_STYLES = {
  DRAFT: { className: 'status-badge--draft', label: 'Draft' },
  SUBMITTED: { className: 'status-badge--ready', label: 'Submitted' },
  SUBMIT_FAILED: { className: 'status-badge--danger', label: 'Submit Failed' },
}

export function LocalStatusBadge({ status }) {
  const style = LOCAL_STATUS_STYLES[status] || { className: 'status-badge--draft', label: status || 'Unknown' }
  return <span className={`status-badge ${style.className}`}>{style.label}</span>
}

// Oracle Workflow Status — the confirmed values (Incomplete/Pending approval/Approved/Rejected/
// Closed/Canceled) get distinct styling; any other value Oracle returns (including future ones we
// don't know about yet) safely falls back to the neutral "pending" style with its raw label.
const ORACLE_STATUS_STYLES = {
  Incomplete: { className: 'status-badge--muted', label: 'Incomplete' },
  'Pending approval': { className: 'status-badge--pending', label: 'Pending Approval' },
  Approved: { className: 'status-badge--ready', label: 'Approved' },
  Rejected: { className: 'status-badge--danger', label: 'Rejected' },
  Closed: { className: 'status-badge--muted', label: 'Closed' },
  Canceled: { className: 'status-badge--danger', label: 'Canceled' },
}

export function OracleStatusBadge({ status }) {
  if (!status) {
    return <span className="status-badge status-badge--muted">Not Submitted</span>
  }
  const style = ORACLE_STATUS_STYLES[status] || { className: 'status-badge--pending', label: status }
  return <span className={`status-badge ${style.className}`}>{style.label}</span>
}

const LINE_TRANSACTION_TYPE_STYLES = {
  'Movement Request Issue': { className: 'status-badge--pending', label: 'Issue' },
  'Movement Request Transfer': { className: 'status-badge--ready', label: 'Transfer' },
}

export function LineTransactionTypeBadge({ transactionType }) {
  const style = LINE_TRANSACTION_TYPE_STYLES[transactionType]
  if (!style) {
    return <span className="status-badge status-badge--muted">Pending</span>
  }
  return <span className={`status-badge ${style.className}`}>{style.label}</span>
}

const SYNC_STATUS_STYLES = {
  SUCCESS: { className: 'status-badge--ready', label: 'Success' },
  FAILED: { className: 'status-badge--danger', label: 'Failed' },
  RUNNING: { className: 'status-badge--pending', label: 'Running' },
}

export function SyncStatusBadge({ status, isRunning }) {
  if (isRunning) {
    return <span className="status-badge status-badge--pending">Running</span>
  }
  if (!status) {
    return <span className="status-badge status-badge--muted">Never Synced</span>
  }
  const style = SYNC_STATUS_STYLES[status] || { className: 'status-badge--muted', label: status }
  return <span className={`status-badge ${style.className}`}>{style.label}</span>
}
