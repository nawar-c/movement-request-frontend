const LOCAL_STATUS_STYLES = {
  DRAFT: { className: 'status-badge--draft', label: 'Draft' },
  READY_TO_SUBMIT: { className: 'status-badge--ready', label: 'Ready to Submit' },
}

export function LocalStatusBadge({ status }) {
  const style = LOCAL_STATUS_STYLES[status] || { className: 'status-badge--draft', label: status || 'Unknown' }
  return <span className={`status-badge ${style.className}`}>{style.label}</span>
}

export function OracleStatusBadge({ status }) {
  if (!status) {
    return <span className="status-badge status-badge--muted">Not Submitted</span>
  }
  return <span className="status-badge status-badge--pending">{status}</span>
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
