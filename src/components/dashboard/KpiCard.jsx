export function KpiCard({ title, value, description, icon: Icon, accent = 'neutral' }) {
  return (
    <div className={`card kpi-card kpi-card--${accent}`}>
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
    </div>
  )
}
