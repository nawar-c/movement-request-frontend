export function DashboardSkeleton() {
  return (
    <div>
      <div className="card skeleton skeleton-op-health" style={{ marginBottom: 20 }} />
      <div className="kpi-grid">
        <div className="card skeleton skeleton-kpi" />
        <div className="card skeleton skeleton-kpi" />
        <div className="card skeleton skeleton-kpi" />
        <div className="card skeleton skeleton-kpi" />
      </div>
      <div className="chart-row">
        <div className="card skeleton chart-skeleton" />
        <div className="card skeleton chart-skeleton" />
      </div>
      <div className="card skeleton chart-skeleton--slim" />
    </div>
  )
}
