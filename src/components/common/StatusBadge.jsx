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

// Oracle Workflow Status — the 9 confirmed values (Incomplete/Pending approval/Approved/Rejected/
// Closed/Canceled/Preapproved/Partially approved/Canceled by source) get distinct styling; any
// other value Oracle returns (including future ones we don't know about yet) safely falls back to
// the neutral "pending" style with its raw label.
const ORACLE_STATUS_STYLES = {
  Incomplete: { className: 'status-badge--muted', label: 'Incomplete' },
  'Pending approval': { className: 'status-badge--pending', label: 'Pending Approval' },
  Approved: { className: 'status-badge--ready', label: 'Approved' },
  Rejected: { className: 'status-badge--danger', label: 'Rejected' },
  Closed: { className: 'status-badge--muted', label: 'Closed' },
  Canceled: { className: 'status-badge--danger', label: 'Canceled' },
  Preapproved: { className: 'status-badge--ready', label: 'Preapproved' },
  'Partially approved': { className: 'status-badge--pending', label: 'Partially approved' },
  'Canceled by source': { className: 'status-badge--danger', label: 'Canceled by source' },
}

export function OracleStatusBadge({ status }) {
  if (!status) {
    return <span className="status-badge status-badge--muted">Not Submitted</span>
  }
  const style = ORACLE_STATUS_STYLES[status] || { className: 'status-badge--pending', label: status }
  return <span className={`status-badge ${style.className}`}>{style.label}</span>
}

// Line Closure — an application-derived summary of how many lines Oracle has closed, distinct
// from both Application Status and Oracle Header Status. Never merged with either.
const LINE_CLOSURE_STYLES = {
  ALL_LINES_CLOSED: { className: 'status-badge--ready', label: 'All Lines Closed' },
  PARTIALLY_CLOSED: { className: 'status-badge--pending', label: 'Partially Closed' },
  NOT_CLOSED: { className: 'status-badge--muted', label: 'Not Closed' },
  NOT_AVAILABLE: { className: 'status-badge--muted', label: 'Not Available' },
}

export function LineClosureBadge({ status }) {
  if (!status) {
    return <span className="status-badge status-badge--muted">Not Available</span>
  }
  const style = LINE_CLOSURE_STYLES[status] || { className: 'status-badge--muted', label: status }
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

// Pure data exports (no rendering change to any badge above) — reused by the Dashboard filter bar
// so filter option lists stay a single source of truth with the badges instead of being
// re-hardcoded per screen.
export const LOCAL_STATUS_OPTIONS = Object.entries(LOCAL_STATUS_STYLES).map(([value, s]) => ({
  value,
  label: s.label,
}))

export const LINE_CLOSURE_OPTIONS = Object.entries(LINE_CLOSURE_STYLES).map(([value, s]) => ({
  value,
  label: s.label,
}))

// Oracle's confirmed status codes (from Oracle Fusion, not invented here) paired with the exact
// label OracleStatusBadge already renders for that value.
const ORACLE_STATUS_CODES = {
  Incomplete: 1,
  'Pending approval': 2,
  Approved: 3,
  Rejected: 4,
  Closed: 5,
  Canceled: 6,
  Preapproved: 7,
  'Partially approved': 8,
  'Canceled by source': 9,
}

export const ORACLE_STATUS_CODE_OPTIONS = Object.entries(ORACLE_STATUS_STYLES).map(([key, s]) => ({
  code: ORACLE_STATUS_CODES[key],
  label: s.label,
}))

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
