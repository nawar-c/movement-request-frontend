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
