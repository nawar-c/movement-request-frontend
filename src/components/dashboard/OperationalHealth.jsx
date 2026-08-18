// The four Phase 1 metrics are not a clean partition of totalRequests (attentionRequired overlaps
// with pendingApproval/approvedNotFullyClosed conceptually), so this deliberately renders them as
// independent stats rather than a summed/stacked composition bar — a stacked bar would visually
// imply a percentage-of-whole relationship the backend contract doesn't actually guarantee.
export function OperationalHealth({ summary, periodLabel }) {
  const stats = [
    { label: 'Pending Approval', value: summary.pendingApproval, className: 'stat-warning' },
    { label: 'Approved, Open', value: summary.approvedNotFullyClosed, className: 'stat-neutral' },
    { label: 'All Lines Closed', value: summary.allLinesClosed, className: 'stat-success' },
    { label: 'Attention Required', value: summary.attentionRequired, className: 'stat-danger' },
  ]

  return (
    <div className="card op-health">
      <div className="op-health__body">
        <div>
          <div className="op-health__eyebrow">Operational Health</div>
          <div className="op-health__total">{summary.totalRequests}</div>
          <div className="op-health__total-label">Movement Requests</div>
          <div className="op-health__period">{periodLabel}</div>
        </div>
        <div className="op-health__stats">
          {stats.map((s) => (
            <div key={s.label}>
              <div className={`op-health__stat-value ${s.className}`}>{s.value}</div>
              <div className="op-health__stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
