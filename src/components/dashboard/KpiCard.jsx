// `onClick` is only passed for KPIs with an honest single-filter mapping (Pending Approval,
// All Lines Closed). Approved Not Fully Closed and Attention Required are compound conditions the
// current filter contract can't express as one filter value, so they stay static — see
// DashboardPage.jsx for the mapping and reasoning.
export function KpiCard({ title, value, description, icon: Icon, accent = 'neutral', onClick, active }) {
  const interactive = typeof onClick === 'function'
  const Tag = interactive ? 'button' : 'div'

  return (
    <Tag
      type={interactive ? 'button' : undefined}
      className={`card kpi-card kpi-card--${accent}${interactive ? ' kpi-card--clickable' : ''}${active ? ' kpi-card--active' : ''}`}
      onClick={onClick}
      aria-pressed={interactive ? Boolean(active) : undefined}
    >
      <div className="kpi-card__top">
        <div className="kpi-card__title">{title}</div>
        {Icon ? (
          <div className="kpi-card__icon">
            <Icon width={16} height={16} />
          </div>
        ) : null}
      </div>
      <div className="kpi-card__value">{value}</div>
      <div className="kpi-card__desc">{description}</div>
    </Tag>
  )
}
