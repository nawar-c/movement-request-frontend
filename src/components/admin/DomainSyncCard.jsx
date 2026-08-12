import { DetailField } from '../common/DetailField.jsx'
import { SyncStatusBadge } from '../common/StatusBadge.jsx'
import { InlineError } from '../common/States.jsx'
import { formatCount, formatDateTime } from '../../utils/formatters.js'

export function DomainSyncCard({ label, domainStatus, busy, disabled, onSync, error }) {
  const isRunning = Boolean(domainStatus?.isRunning) || busy

  return (
    <div className="card">
      <div className="card__header">
        <h2 className="card__title">{label}</h2>
        <SyncStatusBadge status={domainStatus?.lastStatus} isRunning={isRunning} />
      </div>
      <div className="card__body">
        <div className="detail-grid">
          <DetailField
            label="Last Sync"
            value={formatDateTime(domainStatus?.lastCompletedAt || domainStatus?.lastStartedAt)}
          />
          <DetailField label="Records Seen" value={formatCount(domainStatus?.recordsSeen)} />
          <DetailField label="Upserted" value={formatCount(domainStatus?.recordsUpserted)} />
          <DetailField label="Disabled" value={formatCount(domainStatus?.recordsDisabled)} />
        </div>

        {domainStatus?.lastStatus === 'FAILED' && domainStatus?.lastErrorMessage ? (
          <div className="inline-error" style={{ marginTop: 12, marginBottom: 0 }}>
            {domainStatus.lastErrorMessage}
          </div>
        ) : null}
        <InlineError message={error} />

        <div style={{ marginTop: 14 }}>
          <button type="button" className="btn btn-primary btn-sm" onClick={onSync} disabled={disabled || isRunning}>
            {isRunning ? 'Running...' : 'Sync'}
          </button>
        </div>
      </div>
    </div>
  )
}
