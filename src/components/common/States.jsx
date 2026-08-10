export function LoadingState({ label = 'Loading...' }) {
  return (
    <div className="state-block">
      <div className="spinner" />
      <span>{label}</span>
    </div>
  )
}

export function EmptyState({ title = 'Nothing here yet', message, action }) {
  return (
    <div className="state-block">
      <div className="state-block__title">{title}</div>
      {message ? <div>{message}</div> : null}
      {action}
    </div>
  )
}

export function ErrorState({ title = 'Something went wrong', message, onRetry }) {
  return (
    <div className="state-block state-block--error">
      <div className="state-block__title">{title}</div>
      {message ? <div>{message}</div> : null}
      {onRetry ? (
        <button type="button" className="btn btn-sm" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  )
}

export function InlineError({ message, details }) {
  if (!message) return null
  return (
    <div className="inline-error">
      <div>{message}</div>
      {Array.isArray(details) && details.length > 0 ? (
        <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
          {details.map((d, i) => (
            <li key={i}>
              {d.field ? <strong>{d.field}: </strong> : null}
              {d.message}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export function InlineNotice({ children }) {
  return <div className="inline-notice">{children}</div>
}
